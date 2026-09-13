// Package doctor runs read-only diagnostics over an Inventory: cross-agent
// drift, broken links, deprecated keys, housekeeping. It never changes
// anything; it only points.
package doctor

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"github.com/AviroopPaul/agentconf/app/internal/scan"
)

// Finding is one diagnostic.
type Finding struct {
	ID       string `json:"id"`
	Severity string `json:"severity"` // error | warn | info
	Check    string `json:"check"`
	Title    string `json:"title"`
	Detail   string `json:"detail"`
	Agent    string `json:"agent,omitempty"`
	Path     string `json:"path,omitempty"`
	DocsURL  string `json:"docsUrl,omitempty"`
}

// Summary counts findings by severity.
type Summary struct {
	Errors int `json:"errors"`
	Warns  int `json:"warns"`
	Infos  int `json:"infos"`
}

// Run executes every check.
func Run(inv *scan.Inventory) ([]Finding, Summary) {
	var out []Finding
	out = append(out, deprecatedKeys(inv)...)
	out = append(out, brokenSkillLinks(inv)...)
	out = append(out, skillCoverage(inv)...)
	out = append(out, skillTargetsOutside(inv)...)
	out = append(out, mcpDrift(inv)...)
	out = append(out, mcpSingleAgent(inv)...)
	out = append(out, emptyConfig(inv)...)
	out = append(out, parseErrors(inv)...)
	out = append(out, largeState(inv)...)
	out = append(out, agentsMDInterop(inv)...)
	out = append(out, unknownKeys(inv)...)
	out = append(out, brokenBinary(inv)...)
	rank := map[string]int{"error": 0, "warn": 1, "info": 2}
	sort.SliceStable(out, func(i, j int) bool {
		if rank[out[i].Severity] != rank[out[j].Severity] {
			return rank[out[i].Severity] < rank[out[j].Severity]
		}
		return out[i].Title < out[j].Title
	})
	var s Summary
	for i := range out {
		out[i].ID = fmt.Sprintf("f%03d", i+1)
		switch out[i].Severity {
		case "error":
			s.Errors++
		case "warn":
			s.Warns++
		default:
			s.Infos++
		}
	}
	return out, s
}

func deprecatedKeys(inv *scan.Inventory) []Finding {
	var out []Finding
	for _, a := range inv.Agents {
		for _, k := range a.Keys {
			if !k.Set {
				continue
			}
			if k.HasFlag("removed") {
				out = append(out, Finding{Severity: "warn", Check: "removed-key", Agent: a.ID, Path: k.Source, DocsURL: k.DocsURL,
					Title:  fmt.Sprintf("%s sets removed key %s", a.DisplayName, k.Key.Key),
					Detail: fmt.Sprintf("This key was removed%s and no longer has any effect. Safe to delete from %s.", versionSuffix(k.RemovedIn), filepath.Base(k.Source))})
			} else if k.HasFlag("deprecated") {
				out = append(out, Finding{Severity: "info", Check: "deprecated-key", Agent: a.ID, Path: k.Source, DocsURL: k.DocsURL,
					Title:  fmt.Sprintf("%s sets deprecated key %s", a.DisplayName, k.Key.Key),
					Detail: "Still honoured today but scheduled to go away. The docs link names the replacement."})
			}
		}
	}
	return out
}

func versionSuffix(v string) string {
	if v == "" {
		return ""
	}
	return " in " + v
}

func brokenSkillLinks(inv *scan.Inventory) []Finding {
	var out []Finding
	for _, a := range inv.Agents {
		for _, s := range a.Skills {
			if s.Broken {
				out = append(out, Finding{Severity: "error", Check: "broken-skill-link", Agent: a.ID, Path: s.Path,
					Title:  fmt.Sprintf("%s: skill %q is a broken symlink", a.DisplayName, s.Name),
					Detail: fmt.Sprintf("Points to %s, which does not exist. The agent will either ignore it or error when listing skills.", s.Target)})
			} else if !s.HasSkillMD && !s.Managed {
				out = append(out, Finding{Severity: "warn", Check: "skill-missing-skillmd", Agent: a.ID, Path: s.RealPath,
					Title:  fmt.Sprintf("%s: skill %q has no SKILL.md", a.DisplayName, s.Name),
					Detail: "Skills need a SKILL.md entrypoint to be discovered. This directory will be skipped."})
			}
		}
	}
	return out
}

func skillCoverage(inv *scan.Inventory) []Finding {
	var out []Finding
	for _, g := range inv.Skills {
		if g.Capable < 2 || g.Present == 0 || g.Present == g.Capable {
			continue
		}
		var missing []string
		for id, p := range g.Agents {
			if !p.Present {
				missing = append(missing, id)
			}
		}
		sort.Strings(missing)
		sev := "info"
		if g.Present >= 2 {
			// Deliberately shared with some agents but not all: more likely an oversight.
			sev = "warn"
		}
		out = append(out, Finding{Severity: sev, Check: "skill-coverage", Path: g.RealPath,
			Title:  fmt.Sprintf("Skill %q is available to %d of %d agents", g.Name, g.Present, g.Capable),
			Detail: fmt.Sprintf("Missing from: %s. If this is intentional, ignore. Otherwise a symlink into each agent's skills directory fixes it.", strings.Join(missing, ", "))})
	}
	return out
}

func skillTargetsOutside(inv *scan.Inventory) []Finding {
	var out []Finding
	shared := filepath.Join(inv.UserHome, ".agents")
	for _, a := range inv.Agents {
		for _, s := range a.Skills {
			if !s.IsSymlink || s.Broken || s.Managed {
				continue
			}
			if strings.HasPrefix(s.RealPath, shared) || strings.HasPrefix(s.RealPath, a.Home) {
				continue
			}
			out = append(out, Finding{Severity: "info", Check: "skill-link-outside", Agent: a.ID, Path: s.Path,
				Title:  fmt.Sprintf("%s: skill %q links outside the shared skills tree", a.DisplayName, s.Name),
				Detail: fmt.Sprintf("Resolves to %s. Works fine, but it will not be picked up by tools that assume ~/.agents/skills is the single source.", s.RealPath)})
		}
	}
	return out
}

func mcpDrift(inv *scan.Inventory) []Finding {
	var out []Finding
	for _, g := range inv.MCP {
		if len(g.Agents) < 2 || g.Consistent {
			continue
		}
		var shapes []string
		for _, s := range g.Servers {
			desc := s.Transport
			if s.URL != "" {
				desc += " " + s.URL
			} else if s.Command != "" {
				desc += " " + s.Command + " " + strings.Join(s.Args, " ")
			}
			shapes = append(shapes, fmt.Sprintf("%s: %s", s.Agent, strings.TrimSpace(desc)))
		}
		out = append(out, Finding{Severity: "warn", Check: "mcp-drift",
			Title:  fmt.Sprintf("MCP server %q is defined differently across agents", g.Name),
			Detail: strings.Join(shapes, "\n")})
	}
	return out
}

func mcpSingleAgent(inv *scan.Inventory) []Finding {
	installed := 0
	for _, a := range inv.Agents {
		if a.Installed && a.HasPack {
			installed++
		}
	}
	if installed < 2 {
		return nil
	}
	var out []Finding
	for _, g := range inv.MCP {
		if len(g.Agents) != 1 {
			continue
		}
		userScoped := false
		for _, s := range g.Servers {
			if s.Scope == "user" {
				userScoped = true
			}
		}
		if !userScoped {
			continue
		}
		out = append(out, Finding{Severity: "info", Check: "mcp-single-agent", Agent: g.Agents[0],
			Title:  fmt.Sprintf("MCP server %q is only configured for %s", g.Name, g.Agents[0]),
			Detail: "Your other agents cannot use it. If it is useful everywhere, the same server can be added to each agent's MCP config."})
	}
	return out
}

func emptyConfig(inv *scan.Inventory) []Finding {
	var out []Finding
	for _, a := range inv.Agents {
		for _, cf := range a.ConfigFiles {
			if cf.Error == "" && cf.SizeBytes == 0 {
				out = append(out, Finding{Severity: "info", Check: "empty-config", Agent: a.ID, Path: cf.Path,
					Title:  fmt.Sprintf("%s: %s is empty", a.DisplayName, filepath.Base(cf.Path)),
					Detail: "The file exists but has no content. Every setting is at its default."})
			}
		}
	}
	return out
}

func parseErrors(inv *scan.Inventory) []Finding {
	var out []Finding
	for _, a := range inv.Agents {
		for _, cf := range a.ConfigFiles {
			if cf.Error != "" {
				out = append(out, Finding{Severity: "error", Check: "parse-error", Agent: a.ID, Path: cf.Path,
					Title:  fmt.Sprintf("%s: %s does not parse", a.DisplayName, filepath.Base(cf.Path)),
					Detail: cf.Error + ". The agent will most likely ignore the whole file or refuse to start."})
			}
		}
	}
	return out
}

func largeState(inv *scan.Inventory) []Finding {
	var out []Finding
	const gb = 1 << 30
	for _, a := range inv.Agents {
		for _, p := range a.Paths {
			if (p.Kind == "state" || p.Kind == "logs") && p.SizeBytes > gb {
				out = append(out, Finding{Severity: "info", Check: "large-state", Agent: a.ID, Path: p.Resolved,
					Title:  fmt.Sprintf("%s: %s is %.1f GB", a.DisplayName, p.Path.Path, float64(p.SizeBytes)/gb),
					Detail: p.Summary + " Safe to prune if you do not need old transcripts; check the agent's own cleanup setting first."})
			}
		}
	}
	return out
}

func agentsMDInterop(inv *scan.Inventory) []Finding {
	var claudeMD *scan.InstructionFile
	for _, a := range inv.Agents {
		if a.ID != "claude" || !a.Installed {
			continue
		}
		for i := range a.Instructions {
			if filepath.Base(a.Instructions[i].Path) == "CLAUDE.md" && a.Instructions[i].Exists {
				claudeMD = &a.Instructions[i]
			}
		}
	}
	if claudeMD == nil || claudeMD.ImportsAgentsMD {
		return nil
	}
	others := 0
	for _, a := range inv.Agents {
		if a.Installed && a.ID != "claude" {
			others++
		}
	}
	if others == 0 {
		return nil
	}
	return []Finding{{Severity: "info", Check: "agents-md-interop", Agent: "claude", Path: claudeMD.Path,
		Title:   "Global CLAUDE.md does not import AGENTS.md",
		Detail:  "You run other agents that read AGENTS.md. Claude Code does not load AGENTS.md ambiently. A one-line `@AGENTS.md` at the top of CLAUDE.md keeps one source of truth. Only relevant if you keep a global AGENTS.md.",
		DocsURL: "https://code.claude.com/docs/en/memory"}}
}

func unknownKeys(inv *scan.Inventory) []Finding {
	var out []Finding
	for _, a := range inv.Agents {
		if len(a.UnknownKeys) == 0 {
			continue
		}
		names := make([]string, 0, len(a.UnknownKeys))
		for _, u := range a.UnknownKeys {
			names = append(names, u.Key)
		}
		if len(names) > 8 {
			names = append(names[:8], fmt.Sprintf("and %d more", len(a.UnknownKeys)-8))
		}
		out = append(out, Finding{Severity: "info", Check: "unknown-keys", Agent: a.ID,
			Title:  fmt.Sprintf("%s: %d keys set that the schema pack does not know", a.DisplayName, len(a.UnknownKeys)),
			Detail: strings.Join(names, ", ") + ". Either undocumented, very new, or typos. Worth a look."})
	}
	return out
}

func brokenBinary(inv *scan.Inventory) []Finding {
	var out []Finding
	for _, a := range inv.Agents {
		if a.Installed && a.BinaryFound && a.Version == "" && a.ProbeError != "" {
			out = append(out, Finding{Severity: "warn", Check: "binary-broken", Agent: a.ID, Path: a.BinaryPath,
				Title:  fmt.Sprintf("%s: the %s binary is on PATH but fails to run", a.DisplayName, filepath.Base(a.BinaryPath)),
				Detail: fmt.Sprintf("`--version` returned: %s. Usually a half-finished install or a missing native dependency. Reinstalling the agent normally fixes it.", a.ProbeError)})
		}
	}
	return out
}
