package usage

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestWalkTiming(t *testing.T) {
	home, _ := os.UserHomeDir()
	for _, d := range []string{".claude", ".codex", ".cursor", ".gemini"} {
		p := filepath.Join(home, d)
		if _, err := os.Stat(p); err != nil {
			continue
		}
		s := time.Now()
		tr := Walk(p, 200000)
		t.Logf("%-8s files=%6d bytes=%11d  %v", d, tr.TotalFiles, tr.TotalBytes, time.Since(s).Round(time.Millisecond))
		if tr.Size(p) != tr.TotalBytes {
			t.Errorf("root size mismatch: %d vs %d", tr.Size(p), tr.TotalBytes)
		}
	}
}
