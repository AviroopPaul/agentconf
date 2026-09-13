// Package schema loads the embedded schema packs and offers key matching.
package schema

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"sort"
	"strings"

	"github.com/AviroopPaul/agentconf/schemas"
)

// Key describes one configurable key. Field names mirror SCHEMA.md.
type Key struct {
	Key        string   `json:"key"`
	File       string   `json:"file"`
	Type       string   `json:"type"`
	EnumValues []string `json:"enumValues,omitempty"`
	Default    any      `json:"default,omitempty"`
	Scopes     []string `json:"scopes"`
	Category   string   `json:"category"`
	Summary    string   `json:"summary"`
	Detail     string   `json:"detail,omitempty"`
	DocsURL    string   `json:"docsUrl"`
	Flags      []string `json:"flags,omitempty"`
	AddedIn    string   `json:"addedIn,omitempty"`
	RemovedIn  string   `json:"removedIn,omitempty"`
	Concept    string   `json:"concept,omitempty"`
}

// Path describes a file or directory extension point.
type Path struct {
	Path     string `json:"path"`
	Kind     string `json:"kind"`
	Scope    string `json:"scope"`
	Editable bool   `json:"editable"`
	Summary  string `json:"summary"`
	DocsURL  string `json:"docsUrl,omitempty"`
}

// Pack is one agent's complete schema.
type Pack struct {
	Agent       string   `json:"agent"`
	DisplayName string   `json:"displayName"`
	Vendor      string   `json:"vendor"`
	PackVersion string   `json:"packVersion"`
	Sources     []string `json:"sources"`
	Keys        []Key    `json:"keys"`
	Paths       []Path   `json:"paths"`
}

// HasFlag reports whether the key carries the named flag.
func (k Key) HasFlag(f string) bool {
	for _, x := range k.Flags {
		if x == f {
			return true
		}
	}
	return false
}

// Segments splits the dotted key, respecting quoted segments.
func (k Key) Segments() []string { return SplitKey(k.Key) }

// IsWildcard reports whether any segment is a placeholder like <id>.
func (k Key) IsWildcard() bool {
	for _, s := range k.Segments() {
		if IsPlaceholder(s) {
			return true
		}
	}
	return false
}

// IsPlaceholder reports whether a segment is a wildcard placeholder.
func IsPlaceholder(seg string) bool {
	return strings.HasPrefix(seg, "<") && strings.HasSuffix(seg, ">") || seg == "*"
}

// SplitKey splits a dotted path, keeping double-quoted segments intact.
func SplitKey(k string) []string {
	var out []string
	var cur strings.Builder
	inQuote := false
	for _, r := range k {
		switch {
		case r == '"':
			inQuote = !inQuote
		case r == '.' && !inQuote:
			out = append(out, cur.String())
			cur.Reset()
		default:
			cur.WriteRune(r)
		}
	}
	out = append(out, cur.String())
	return out
}

// JoinKey joins segments, quoting any that contain a dot.
func JoinKey(segs []string) string {
	parts := make([]string, len(segs))
	for i, s := range segs {
		if strings.ContainsAny(s, ". ") {
			parts[i] = `"` + s + `"`
		} else {
			parts[i] = s
		}
	}
	return strings.Join(parts, ".")
}

// Match reports whether a concrete key path matches a schema key. If the
// schema key is an object, concrete paths underneath it also match (prefix).
func Match(k Key, concrete []string) bool {
	pat := k.Segments()
	if len(concrete) < len(pat) {
		return false
	}
	if len(concrete) > len(pat) && k.Type != "object" {
		return false
	}
	for i, p := range pat {
		if IsPlaceholder(p) {
			continue
		}
		if p != concrete[i] {
			return false
		}
	}
	return true
}

// Load reads every embedded pack, keyed by agent id.
func Load() (map[string]*Pack, error) {
	entries, err := fs.ReadDir(schemas.FS, ".")
	if err != nil {
		return nil, err
	}
	out := map[string]*Pack{}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".json") {
			continue
		}
		b, err := schemas.FS.ReadFile(e.Name())
		if err != nil {
			return nil, err
		}
		var p Pack
		if err := json.Unmarshal(b, &p); err != nil {
			return nil, fmt.Errorf("schema %s: %w", e.Name(), err)
		}
		if p.Agent == "" {
			p.Agent = strings.TrimSuffix(e.Name(), ".json")
		}
		sort.SliceStable(p.Keys, func(i, j int) bool {
			if p.Keys[i].Category != p.Keys[j].Category {
				return p.Keys[i].Category < p.Keys[j].Category
			}
			return p.Keys[i].Key < p.Keys[j].Key
		})
		out[p.Agent] = &p
	}
	return out, nil
}
