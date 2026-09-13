package scan

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	toml "github.com/pelletier/go-toml/v2"
)

// Entry is one leaf in a flattened config document.
type Entry struct {
	Segs  []string
	Value any
}

// Doc is a parsed config file.
type Doc struct {
	Path    string
	Base    string
	Format  string
	Raw     map[string]any
	Entries []Entry
}

// ParseConfigFile reads and parses a JSON, JSONC, or TOML file into a Doc.
func ParseConfigFile(path string) (*Doc, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	d := &Doc{Path: path, Base: filepath.Base(path)}
	ext := strings.ToLower(filepath.Ext(path))
	raw := map[string]any{}
	switch ext {
	case ".toml":
		d.Format = "toml"
		if len(strings.TrimSpace(string(b))) > 0 {
			if err := toml.Unmarshal(b, &raw); err != nil {
				return nil, fmt.Errorf("toml: %w", err)
			}
		}
	default:
		d.Format = "json"
		clean := StripJSONC(b)
		if len(strings.TrimSpace(string(clean))) > 0 {
			if err := json.Unmarshal(clean, &raw); err != nil {
				return nil, fmt.Errorf("json: %w", err)
			}
		}
	}
	d.Raw = raw
	flatten(raw, nil, &d.Entries)
	return d, nil
}

// flatten walks nested maps. Arrays and scalars are leaves; so are empty maps.
func flatten(v any, prefix []string, out *[]Entry) {
	m, ok := v.(map[string]any)
	if !ok || len(m) == 0 {
		*out = append(*out, Entry{Segs: append([]string(nil), prefix...), Value: v})
		return
	}
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		flatten(m[k], append(append([]string(nil), prefix...), k), out)
	}
}

// Lookup walks Raw by segments and returns the value if present.
func (d *Doc) Lookup(segs []string) (any, bool) {
	var cur any = d.Raw
	for _, s := range segs {
		m, ok := cur.(map[string]any)
		if !ok {
			return nil, false
		}
		cur, ok = m[s]
		if !ok {
			return nil, false
		}
	}
	return cur, true
}

var (
	reLineComment  = regexp.MustCompile(`(?m)^\s*//.*$`)
	reBlockComment = regexp.MustCompile(`(?s)/\*.*?\*/`)
	reTrailingComa = regexp.MustCompile(`,(\s*[}\]])`)
)

// StripJSONC removes comments and trailing commas so hand-edited settings
// files still parse. It is deliberately conservative: only full-line
// comments and block comments, which is what people actually write.
func StripJSONC(b []byte) []byte {
	b = []byte(strings.TrimPrefix(string(b), "\uFEFF"))
	b = reBlockComment.ReplaceAll(b, nil)
	b = reLineComment.ReplaceAll(b, nil)
	b = reTrailingComa.ReplaceAll(b, []byte("$1"))
	return b
}
