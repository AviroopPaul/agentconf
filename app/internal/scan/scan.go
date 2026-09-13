// Package scan builds a read-only Inventory of every agent's configuration
// on this machine. It reads only files the schema packs name, never
// credentials, and masks anything that looks like a secret.
package scan

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/AviroopPaul/agentconf/app/internal/agents"
	"github.com/AviroopPaul/agentconf/app/internal/schema"
	"github.com/AviroopPaul/agentconf/app/internal/usage"
)

// kinds of paths whose contents we parse as configuration.
var parseKinds = map[string]bool{"settings": true, "mcp": true, "hooks": true, "trust": true, "keybindings": true}

// kinds we list as extension points (name + size, no content).
var extensionKinds = map[string]bool{"rules": true, "agents": true, "commands": true, "outputStyles": true, "workflows": true, "themes": true}

var reSecretSeg = regexp.MustCompile(`(?i)(token|secret|password|passwd|api[_-]?key|authorization|headers?|credential|private[_-]?key|bearer)`)

// Options tunes a scan.
type Options struct {
	WithUsage bool
	// Probe runs `<agent> --version` for each agent. Electron and Node
	// binaries take hundreds of milliseconds to answer, so the server scans
	// without probing and fills versions in afterwards. See ProbeAll.
	Probe bool
}

// Run performs a full scan.
func Run(opts Options) (*Inventory, error) {
	start := time.Now()
	packs, err := schema.Load()
	if err != nil {
		return nil, err
	}
	userHome, _ := os.UserHomeDir()
	host, _ := os.Hostname()
	inv := &Inventory{GeneratedAt: start, Hostname: host, UserHome: userHome, Packs: map[string]PackMeta{}}
	for id, p := range packs {
		inv.Packs[id] = PackMeta{Agent: p.Agent, DisplayName: p.DisplayName, Vendor: p.Vendor, PackVersion: p.PackVersion, Sources: p.Sources, KeyCount: len(p.Keys), PathCount: len(p.Paths)}
	}

	detected := agents.Detect()
	reports := make([]AgentReport, len(detected))
	var wg sync.WaitGroup
	for i := range detected {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			// Version probes spawn processes; run them alongside the
			// filesystem scan rather than before it.
			var pw sync.WaitGroup
			if opts.Probe {
				pw.Add(1)
				go func() { defer pw.Done(); agents.Probe(&detected[i]) }()
			}
			rep := scanAgent(detected[i], packs[detected[i].ID], userHome, opts)
			pw.Wait()
			rep.Detected = detected[i]
			reports[i] = rep
		}(i)
	}
	wg.Wait()
	inv.Agents = reports
	inv.Skills = groupSkills(reports)
	inv.MCP = groupMCP(reports)
	inv.ScanMillis = time.Since(start).Milliseconds()
	return inv, nil
}

// ProbeAll fills Version and ProbeError on every installed agent. It is
// slow (it spawns processes) and meant to run in the background.
func ProbeAll(inv *Inventory) {
	var wg sync.WaitGroup
	for i := range inv.Agents {
		if !inv.Agents[i].BinaryFound {
			continue
		}
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			d := inv.Agents[i].Detected
			agents.Probe(&d)
			inv.Agents[i].Version = d.Version
			inv.Agents[i].ProbeError = d.ProbeError
		}(i)
	}
	wg.Wait()
}

func scanAgent(d agents.Detected, pack *schema.Pack, userHome string, opts Options) AgentReport {
	r := AgentReport{Detected: d, Extensions: map[string][]ExtEntry{},
		Paths: []PathStatus{}, Keys: []KeyStatus{}, UnknownKeys: []UnknownKey{}, ConfigFiles: []ConfigFile{},
		Skills: []Skill{}, MCP: []MCPServer{}, Hooks: []HookEvent{}, Plugins: []Plugin{}, Instructions: []InstructionFile{}}
	if pack != nil {
		r.HasPack = true
		r.PackVersion = pack.PackVersion
	}
	if !d.Installed {
		if pack != nil {
			r.Stats.Total = len(pack.Keys)
			r.Stats.Unset = len(pack.Keys)
		}
		return r
	}
	// One walk per agent home; every size below comes from this tree. The
	// walk is the slowest part of a scan (one lstat per file), so it is
	// skipped when usage is not requested.
	var tree *usage.Tree
	if opts.WithUsage {
		tree = usage.Walk(d.Home, 200000)
	}
	if pack == nil {
		// Minimal support: list a skills directory if present, and usage.
		if sk := filepath.Join(d.Home, "skills"); dirExists(sk) {
			r.Skills = readSkillsDir(sk, false)
			r.Paths = append(r.Paths, PathStatus{Path: schema.Path{Path: "~/skills/", Kind: "skills", Scope: "user", Editable: true, Summary: "Skills directory (no schema pack for this agent yet)."}, Resolved: sk, Exists: true, IsDir: true, Entries: len(r.Skills)})
		}
		if opts.WithUsage {
			r.Usage = usage.For(d.ID, d.Home, tree)
		}
		return r
	}

	// 1. Resolve every schema path against the filesystem.
	docs := map[string]*Doc{} // resolved path -> parsed doc
	for _, sp := range pack.Paths {
		if sp.Scope != "user" {
			continue
		}
		ps := resolvePath(sp, d.Home, tree)
		if ps.Exists && !ps.IsDir && parseKinds[sp.Kind] && sp.Editable && sp.Kind != "credential" {
			doc, err := ParseConfigFile(ps.Resolved)
			cf := ConfigFile{Path: ps.Resolved, SizeBytes: ps.SizeBytes}
			if err != nil {
				cf.Error = err.Error()
				r.Errors = append(r.Errors, fmt.Sprintf("%s: %v", ps.Resolved, err))
			} else {
				cf.Format = doc.Format
				cf.LeafCount = len(doc.Entries)
				docs[ps.Resolved] = doc
			}
			r.ConfigFiles = append(r.ConfigFiles, cf)
		}
		if ps.Exists && ps.IsDir {
			switch {
			case sp.Kind == "skills":
				r.Skills = append(r.Skills, readSkillsDir(ps.Resolved, !sp.Editable)...)
			case extensionKinds[sp.Kind]:
				r.Extensions[sp.Kind] = append(r.Extensions[sp.Kind], readExtDir(ps.Resolved)...)
			}
		}
		if sp.Kind == "instructions" {
			r.Instructions = append(r.Instructions, readInstruction(ps))
		}
		r.Paths = append(r.Paths, ps)
	}

	// 2. Match schema keys against parsed documents.
	r.Keys, r.UnknownKeys = matchKeys(pack, docs)
	r.Stats = KeyStats{Total: len(r.Keys)}
	for _, k := range r.Keys {
		if k.Set {
			r.Stats.Set++
			if k.HasFlag("deprecated") || k.HasFlag("removed") {
				r.Stats.Deprecated++
			}
			if k.HasFlag("experimental") {
				r.Stats.Experimental++
			}
		}
	}
	r.Stats.Unset = r.Stats.Total - r.Stats.Set
	r.Stats.Unknown = len(r.UnknownKeys)

	// 3. Agent-specific extras: MCP, hooks, plugins.
	switch d.ID {
	case "claude":
		claudeExtras(&r, docs, userHome)
	case "codex":
		codexExtras(&r, docs)
	case "cursor":
		cursorExtras(&r, docs)
	case "gemini":
		geminiExtras(&r, docs)
	default:
		genericMCP(&r, docs)
	}

	if opts.WithUsage {
		r.Usage = usage.For(d.ID, d.Home, tree)
	}
	if r.Keys == nil {
		r.Keys = []KeyStatus{}
	}
	if r.UnknownKeys == nil {
		r.UnknownKeys = []UnknownKey{}
	}
	return r
}

func dirExists(p string) bool {
	st, err := os.Stat(p)
	return err == nil && st.IsDir()
}

// resolvePath maps a schema path to the filesystem and stats it.
func resolvePath(sp schema.Path, home string, tree *usage.Tree) PathStatus {
	ps := PathStatus{Path: sp}
	rel := sp.Path
	switch {
	case strings.HasPrefix(rel, "~/"):
		ps.Resolved = filepath.Clean(filepath.Join(home, rel[2:]))
	case rel == "~":
		ps.Resolved = home
	default:
		ps.Resolved = rel
	}
	// Credentials: report existence only, never open.
	li, err := os.Lstat(ps.Resolved)
	if err != nil {
		return ps
	}
	ps.Exists = true
	mt := li.ModTime()
	ps.ModTime = &mt
	if li.Mode()&os.ModeSymlink != 0 {
		ps.IsSymlink = true
		if t, err := os.Readlink(ps.Resolved); err == nil {
			ps.Target = t
		}
	}
	st, err := os.Stat(ps.Resolved)
	if err != nil {
		return ps
	}
	ps.IsDir = st.IsDir()
	if sp.Kind == "credential" {
		return ps
	}
	if ps.IsDir {
		if entries, err := os.ReadDir(ps.Resolved); err == nil {
			ps.Entries = len(entries)
		}
		ps.SizeBytes = tree.Size(ps.Resolved)
	} else {
		ps.SizeBytes = st.Size()
	}
	return ps
}

func readExtDir(dir string) []ExtEntry {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var out []ExtEntry
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".") {
			continue
		}
		p := filepath.Join(dir, e.Name())
		x := ExtEntry{Name: e.Name(), Path: p, IsSymlink: e.Type()&os.ModeSymlink != 0}
		if st, err := os.Stat(p); err == nil {
			x.IsDir = st.IsDir()
			if !x.IsDir {
				x.SizeBytes = st.Size()
			}
		}
		out = append(out, x)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func readInstruction(ps PathStatus) InstructionFile {
	f := InstructionFile{Path: ps.Resolved, Exists: ps.Exists, IsSymlink: ps.IsSymlink, Target: ps.Target}
	if !ps.Exists || ps.IsDir {
		return f
	}
	f.SizeBytes = ps.SizeBytes
	fh, err := os.Open(ps.Resolved)
	if err != nil {
		return f
	}
	defer fh.Close()
	sc := bufio.NewScanner(fh)
	sc.Buffer(make([]byte, 256*1024), 4*1024*1024)
	for sc.Scan() {
		f.Lines++
		if strings.Contains(sc.Text(), "@AGENTS.md") {
			f.ImportsAgentsMD = true
		}
	}
	return f
}

// matchKeys pairs schema keys with document entries and collects unknowns.
func matchKeys(pack *schema.Pack, docs map[string]*Doc) ([]KeyStatus, []UnknownKey) {
	var keys []KeyStatus
	covered := map[string]map[int]bool{} // doc path -> entry index -> covered
	for p, d := range docs {
		covered[p] = make(map[int]bool, len(d.Entries))
	}
	for _, sk := range pack.Keys {
		ks := KeyStatus{Key: sk}
		segs := sk.Segments()
		for p, d := range docs {
			if !fileMatches(sk.File, d.Base) {
				continue
			}
			if !sk.IsWildcard() {
				if v, ok := d.Lookup(segs); ok {
					ks.Set = true
					ks.Source = p
					ks.Value, ks.Masked = maskValue(sk, segs, v)
					for i, e := range d.Entries {
						if hasPrefix(e.Segs, segs) {
							covered[p][i] = true
						}
					}
				}
				continue
			}
			for i, e := range d.Entries {
				if schema.Match(sk, e.Segs) {
					ks.Set = true
					ks.Source = p
					covered[p][i] = true
					concrete := schema.JoinKey(e.Segs[:min(len(e.Segs), len(segs))])
					if !contains(ks.Matches, concrete) {
						ks.Matches = append(ks.Matches, concrete)
					}
				}
			}
			if ks.Set && len(ks.Matches) > 0 {
				ks.Value = fmt.Sprintf("%d configured", len(ks.Matches))
			}
		}
		keys = append(keys, ks)
	}
	var unknown []UnknownKey
	for p, d := range docs {
		for i, e := range d.Entries {
			if covered[p][i] {
				continue
			}
			v, masked := maskValue(schema.Key{}, e.Segs, e.Value)
			unknown = append(unknown, UnknownKey{Key: schema.JoinKey(e.Segs), Value: v, Masked: masked, Source: p})
		}
	}
	sort.Slice(unknown, func(i, j int) bool { return unknown[i].Key < unknown[j].Key })
	return keys, unknown
}

func fileMatches(schemaFile, base string) bool {
	if schemaFile == "" {
		return true
	}
	if strings.Contains(schemaFile, "*") {
		re := regexp.MustCompile("^" + strings.ReplaceAll(regexp.QuoteMeta(schemaFile), `\*`, ".*") + "$")
		return re.MatchString(base)
	}
	return schemaFile == base
}

func hasPrefix(segs, prefix []string) bool {
	if len(segs) < len(prefix) {
		return false
	}
	for i := range prefix {
		if segs[i] != prefix[i] {
			return false
		}
	}
	return true
}

func contains(xs []string, s string) bool {
	for _, x := range xs {
		if x == s {
			return true
		}
	}
	return false
}

// maskValue hides secret-looking values. Objects are summarised so large
// nested config never floods the payload.
func maskValue(k schema.Key, segs []string, v any) (any, bool) {
	sensitive := k.HasFlag("sensitive")
	for _, s := range segs {
		if reSecretSeg.MatchString(s) {
			sensitive = true
		}
	}
	switch t := v.(type) {
	case map[string]any:
		if sensitive {
			return fmt.Sprintf("{%d keys, hidden}", len(t)), true
		}
		b, _ := json.Marshal(t)
		if len(b) > 600 {
			return fmt.Sprintf("{%d keys}", len(t)), false
		}
		return t, false
	case []any:
		if sensitive {
			return fmt.Sprintf("[%d items, hidden]", len(t)), true
		}
		if len(t) > 40 {
			return fmt.Sprintf("[%d items]", len(t)), false
		}
		return t, false
	case string:
		if sensitive && t != "" {
			return "••••••••", true
		}
		if len(t) > 400 {
			return t[:397] + "...", false
		}
		return t, false
	default:
		return v, false
	}
}

// ---- agent-specific extras ----

func findDoc(docs map[string]*Doc, base string) *Doc {
	for _, d := range docs {
		if d.Base == base {
			return d
		}
	}
	return nil
}

func hooksFromMap(source string, m map[string]any) []HookEvent {
	events := make([]string, 0, len(m))
	for k := range m {
		events = append(events, k)
	}
	sort.Strings(events)
	var out []HookEvent
	for _, ev := range events {
		n := 1
		switch t := m[ev].(type) {
		case []any:
			n = 0
			for _, item := range t {
				if im, ok := item.(map[string]any); ok {
					if hs, ok := im["hooks"].([]any); ok {
						n += len(hs)
						continue
					}
				}
				n++
			}
		case map[string]any:
			n = len(t)
		}
		out = append(out, HookEvent{Event: ev, Count: n, Source: source})
	}
	return out
}

func claudeExtras(r *AgentReport, docs map[string]*Doc, userHome string) {
	if st, p, err := readClaudeGlobal(userHome); err == nil {
		r.MCP = append(r.MCP, mcpFromMap("claude", "user", "", p, toAnyMap(st.MCPServers))...)
		projects := make([]string, 0, len(st.Projects))
		for k := range st.Projects {
			projects = append(projects, k)
		}
		sort.Strings(projects)
		trusted := 0
		for _, proj := range projects {
			pr := st.Projects[proj]
			if pr.HasTrustDialogAccepted {
				trusted++
			}
			r.MCP = append(r.MCP, mcpFromMap("claude", "project", proj, p, toAnyMap(pr.MCPServers))...)
		}
		r.Extensions["trustedProjects"] = nil
		for _, proj := range projects {
			if st.Projects[proj].HasTrustDialogAccepted {
				r.Extensions["trustedProjects"] = append(r.Extensions["trustedProjects"], ExtEntry{Name: proj, Path: proj, IsDir: true})
			}
		}
	}
	if d := findDoc(docs, "settings.json"); d != nil {
		if h, ok := d.Raw["hooks"].(map[string]any); ok {
			r.Hooks = append(r.Hooks, hooksFromMap(d.Path, h)...)
		}
		if ep, ok := d.Raw["enabledPlugins"].(map[string]any); ok {
			for name, v := range ep {
				en, _ := v.(bool)
				e := en
				r.Plugins = append(r.Plugins, Plugin{Name: name, Enabled: &e, Source: d.Path, Scope: "user"})
			}
		}
	}
	// installed_plugins.json carries versions; merge onto enabled list.
	if b, err := os.ReadFile(filepath.Join(r.Home, "plugins", "installed_plugins.json")); err == nil {
		var ip struct {
			Plugins map[string][]struct {
				Scope       string `json:"scope"`
				Version     string `json:"version"`
				InstalledAt string `json:"installedAt"`
				LastUpdated string `json:"lastUpdated"`
			} `json:"plugins"`
		}
		if json.Unmarshal(b, &ip) == nil {
			for name, installs := range ip.Plugins {
				if len(installs) == 0 {
					continue
				}
				in := installs[0]
				merged := false
				for i := range r.Plugins {
					if r.Plugins[i].Name == name {
						r.Plugins[i].Version = in.Version
						r.Plugins[i].InstalledAt = in.InstalledAt
						r.Plugins[i].LastUpdated = in.LastUpdated
						if r.Plugins[i].Scope == "" {
							r.Plugins[i].Scope = in.Scope
						}
						merged = true
					}
				}
				if !merged {
					r.Plugins = append(r.Plugins, Plugin{Name: name, Version: in.Version, Scope: in.Scope, InstalledAt: in.InstalledAt, LastUpdated: in.LastUpdated, Source: filepath.Join(r.Home, "plugins", "installed_plugins.json")})
				}
			}
		}
	}
	sort.Slice(r.Plugins, func(i, j int) bool { return r.Plugins[i].Name < r.Plugins[j].Name })
}

func codexExtras(r *AgentReport, docs map[string]*Doc) {
	if d := findDoc(docs, "config.toml"); d != nil {
		if m, ok := d.Raw["mcp_servers"].(map[string]any); ok {
			r.MCP = append(r.MCP, mcpFromMap("codex", "user", "", d.Path, m)...)
		}
		if h, ok := d.Raw["hooks"].(map[string]any); ok {
			r.Hooks = append(r.Hooks, hooksFromMap(d.Path, h)...)
		}
		if pl, ok := d.Raw["plugins"].(map[string]any); ok {
			for name, v := range pl {
				p := Plugin{Name: name, Source: d.Path, Scope: "user"}
				if pm, ok := v.(map[string]any); ok {
					if en, ok := pm["enabled"].(bool); ok {
						e := en
						p.Enabled = &e
					}
				}
				r.Plugins = append(r.Plugins, p)
			}
		}
		if pr, ok := d.Raw["projects"].(map[string]any); ok {
			names := make([]string, 0, len(pr))
			for k := range pr {
				names = append(names, k)
			}
			sort.Strings(names)
			for _, n := range names {
				if pm, ok := pr[n].(map[string]any); ok {
					if tl, _ := pm["trust_level"].(string); tl == "trusted" {
						r.Extensions["trustedProjects"] = append(r.Extensions["trustedProjects"], ExtEntry{Name: n, Path: n, IsDir: true})
					}
				}
			}
		}
	}
	if d := findDoc(docs, "hooks.json"); d != nil {
		if h, ok := d.Raw["hooks"].(map[string]any); ok {
			r.Hooks = append(r.Hooks, hooksFromMap(d.Path, h)...)
		}
	}
	sort.Slice(r.Plugins, func(i, j int) bool { return r.Plugins[i].Name < r.Plugins[j].Name })
}

func cursorExtras(r *AgentReport, docs map[string]*Doc) {
	genericMCP(r, docs)
	if d := findDoc(docs, "hooks.json"); d != nil {
		if h, ok := d.Raw["hooks"].(map[string]any); ok {
			r.Hooks = append(r.Hooks, hooksFromMap(d.Path, h)...)
		}
	}
	for _, sub := range []string{"", "local"} {
		dir := filepath.Join(r.Home, "plugins", sub)
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if !e.IsDir() || strings.HasPrefix(e.Name(), ".") || (sub == "" && e.Name() == "local") {
				continue
			}
			r.Plugins = append(r.Plugins, Plugin{Name: e.Name(), Scope: "user", Source: filepath.Join(dir, e.Name())})
		}
	}
}

func geminiExtras(r *AgentReport, docs map[string]*Doc) {
	genericMCP(r, docs)
}

// genericMCP reads a top-level mcpServers map from any parsed document.
func genericMCP(r *AgentReport, docs map[string]*Doc) {
	for _, d := range docs {
		if m, ok := d.Raw["mcpServers"].(map[string]any); ok {
			r.MCP = append(r.MCP, mcpFromMap(r.ID, "user", "", d.Path, m)...)
		}
	}
}
