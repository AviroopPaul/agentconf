package scan

import (
	"bufio"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// readSkillsDir lists one skills directory, resolving symlinks and reading
// the SKILL.md description. managed marks vendor-owned directories.
func readSkillsDir(dir string, managed bool) []Skill {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}
	var out []Skill
	for _, e := range entries {
		name := e.Name()
		if strings.HasPrefix(name, ".") {
			continue
		}
		p := filepath.Join(dir, name)
		s := Skill{Name: name, Path: p, Managed: managed, Source: dir}
		if e.Type()&os.ModeSymlink != 0 {
			s.IsSymlink = true
			if t, err := os.Readlink(p); err == nil {
				s.Target = t
			}
		}
		real, err := filepath.EvalSymlinks(p)
		if err != nil {
			s.Broken = true
			s.RealPath = p
		} else {
			s.RealPath = real
		}
		if st, err := os.Stat(s.RealPath); err != nil || !st.IsDir() {
			if err == nil && !st.IsDir() {
				// A bare SKILL.md or other file at top level; still list it.
				s.RealPath = filepath.Dir(s.RealPath)
			}
		}
		md := filepath.Join(s.RealPath, "SKILL.md")
		if _, err := os.Stat(md); err == nil {
			s.HasSkillMD = true
			s.Description = readFrontmatterDescription(md)
		}
		out = append(out, s)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

// readFrontmatterDescription pulls `description:` from YAML frontmatter,
// or the first paragraph after the title as a fallback. Reads at most 60
// lines so huge skills stay cheap.
func readFrontmatterDescription(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 64*1024), 256*1024)
	lines := 0
	inFM := false
	fallback := ""
	for sc.Scan() && lines < 60 {
		lines++
		line := sc.Text()
		trim := strings.TrimSpace(line)
		if lines == 1 && trim == "---" {
			inFM = true
			continue
		}
		if inFM {
			if trim == "---" {
				inFM = false
				continue
			}
			if strings.HasPrefix(trim, "description:") {
				v := strings.TrimSpace(strings.TrimPrefix(trim, "description:"))
				v = strings.Trim(v, `"'`)
				if v == ">" || v == "|" || v == ">-" || v == "|-" {
					// multi-line scalar: collect indented continuation lines
					var b strings.Builder
					for sc.Scan() && lines < 60 {
						lines++
						l := sc.Text()
						if strings.TrimSpace(l) == "" || !strings.HasPrefix(l, " ") {
							break
						}
						if b.Len() > 0 {
							b.WriteByte(' ')
						}
						b.WriteString(strings.TrimSpace(l))
					}
					v = b.String()
				}
				return clip(v, 240)
			}
			continue
		}
		if fallback == "" && trim != "" && !strings.HasPrefix(trim, "#") {
			fallback = trim
		}
	}
	return clip(fallback, 240)
}

func clip(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n-1] + "…"
}

// groupSkills builds the cross-agent coverage matrix. Only agents whose pack
// declares a user-scope skills path count as "capable".
func groupSkills(reports []AgentReport) []SkillGroup {
	capable := map[string]bool{}
	for _, r := range reports {
		if !r.Installed {
			continue
		}
		for _, p := range r.Paths {
			if p.Kind == "skills" && p.Scope == "user" && p.Editable {
				capable[r.ID] = true
			}
		}
	}
	groups := map[string]*SkillGroup{}
	for _, r := range reports {
		for _, s := range r.Skills {
			if s.Managed {
				continue
			}
			key := s.RealPath
			if s.Broken {
				key = "name:" + s.Name
			}
			g, ok := groups[key]
			if !ok {
				g = &SkillGroup{Name: s.Name, RealPath: s.RealPath, Description: s.Description, Agents: map[string]SkillPresence{}}
				groups[key] = g
			}
			if g.Description == "" {
				g.Description = s.Description
			}
			kind := "dir"
			if s.IsSymlink {
				kind = "symlink"
			}
			g.Agents[r.ID] = SkillPresence{Present: true, Kind: kind, Broken: s.Broken, Path: s.Path}
		}
	}
	var out []SkillGroup
	for _, g := range groups {
		for id := range capable {
			if _, ok := g.Agents[id]; !ok {
				g.Agents[id] = SkillPresence{Present: false, Kind: "missing"}
			} else {
				g.Present++
			}
		}
		g.Capable = len(capable)
		g.Shared = g.Present > 1
		out = append(out, *g)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Present != out[j].Present {
			return out[i].Present > out[j].Present
		}
		return out[i].Name < out[j].Name
	})
	return out
}
