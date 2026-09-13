package usage

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// Tree is the result of one walk over an agent's home: the size and file
// count of every directory, so callers can ask about any subpath without
// walking again.
type Tree struct {
	Root       string
	TotalBytes int64
	TotalFiles int
	dirBytes   map[string]int64
	dirFiles   map[string]int
	Truncated  bool
}

// Walk builds a Tree. Symlinks are not followed. The walk stops after
// maxFiles regular files so a pathological directory cannot stall startup.
func Walk(root string, maxFiles int) *Tree {
	t := &Tree{Root: root, dirBytes: map[string]int64{}, dirFiles: map[string]int{}}
	_ = filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.Type()&os.ModeSymlink != 0 {
			return nil
		}
		if !d.Type().IsRegular() {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return nil
		}
		sz := info.Size()
		t.TotalBytes += sz
		t.TotalFiles++
		// attribute to every ancestor up to root
		for dir := filepath.Dir(p); ; dir = filepath.Dir(dir) {
			t.dirBytes[dir] += sz
			t.dirFiles[dir]++
			if dir == root || len(dir) <= len(root) {
				break
			}
		}
		if t.TotalFiles >= maxFiles {
			t.Truncated = true
			return fs.SkipAll
		}
		return nil
	})
	return t
}

// Size returns the byte total under a path (directory or file).
func (t *Tree) Size(p string) int64 {
	if t == nil {
		return 0
	}
	p = filepath.Clean(p)
	if v, ok := t.dirBytes[p]; ok {
		return v
	}
	if st, err := os.Stat(p); err == nil && !st.IsDir() && strings.HasPrefix(p, t.Root) {
		return st.Size()
	}
	return 0
}

// Files returns the regular-file count under a path.
func (t *Tree) Files(p string) int {
	if t == nil {
		return 0
	}
	return t.dirFiles[filepath.Clean(p)]
}
