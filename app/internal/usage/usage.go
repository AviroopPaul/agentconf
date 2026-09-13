// Package usage extracts activity footprints from agent state directories.
// It reads counts, timestamps, and sizes. It never reads prompt text or
// transcript contents.
package usage

import (
	"bufio"
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Report is an agent's activity footprint.
type Report struct {
	DiskBytes     int64          `json:"diskBytes"`
	FileCount     int            `json:"fileCount"`
	Sessions      int            `json:"sessions,omitempty"`
	Messages      int            `json:"messages,omitempty"`
	Prompts       int            `json:"prompts,omitempty"`
	Projects      int            `json:"projects,omitempty"`
	FirstActivity *time.Time     `json:"firstActivity,omitempty"`
	LastActivity  *time.Time     `json:"lastActivity,omitempty"`
	Tokens        *TokenTotals   `json:"tokens,omitempty"`
	Extra         map[string]any `json:"extra,omitempty"`
	Notes         []string       `json:"notes,omitempty"`
}

// TokenTotals is lifetime token usage where the agent records it itself.
type TokenTotals struct {
	Total         int64 `json:"total"`
	Input         int64 `json:"input"`
	Output        int64 `json:"output"`
	CacheRead     int64 `json:"cacheRead"`
	CacheCreation int64 `json:"cacheCreation"`
	Models        int   `json:"models"`
}

// DirSize walks a directory summing regular file sizes. Symlinks are not
// followed. It stops counting after maxFiles to stay bounded.
func DirSize(root string, maxFiles int) (int64, int) {
	var size int64
	count := 0
	_ = filepath.WalkDir(root, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.Type()&os.ModeSymlink != 0 {
			return nil
		}
		if d.Type().IsRegular() {
			if info, err := d.Info(); err == nil {
				size += info.Size()
				count++
			}
			if count >= maxFiles {
				return fs.SkipAll
			}
		}
		return nil
	})
	return size, count
}

// For dispatches to an agent-specific reader and always fills disk usage.
func For(agentID, home string, t *Tree) *Report {
	r := &Report{Extra: map[string]any{}}
	if t == nil {
		t = Walk(home, 200000)
	}
	r.DiskBytes, r.FileCount = t.TotalBytes, t.TotalFiles
	switch agentID {
	case "claude":
		claude(home, r, t)
	case "codex":
		codex(home, r, t)
	case "cursor":
		cursor(home, r, t)
	case "gemini":
		gemini(home, r)
	}
	if len(r.Extra) == 0 {
		r.Extra = nil
	}
	return r
}

func countLines(path string, onLine func(line []byte)) int {
	f, err := os.Open(path)
	if err != nil {
		return 0
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 1024*1024), 16*1024*1024)
	n := 0
	for sc.Scan() {
		n++
		if onLine != nil {
			onLine(sc.Bytes())
		}
	}
	return n
}

func setTime(dst **time.Time, t time.Time, latest bool) {
	if t.IsZero() {
		return
	}
	if *dst == nil || (latest && t.After(**dst)) || (!latest && t.Before(**dst)) {
		tt := t
		*dst = &tt
	}
}

func countDirEntries(dir string) int {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0
	}
	n := 0
	for _, e := range entries {
		if !strings.HasPrefix(e.Name(), ".") {
			n++
		}
	}
	return n
}

// claude reads stats-cache.json (aggregate stats Claude Code maintains
// itself), history.jsonl (prompt count and timestamps only), and counts
// project transcript directories.
func claude(home string, r *Report, t *Tree) {
	if b, err := os.ReadFile(filepath.Join(home, "stats-cache.json")); err == nil {
		var st struct {
			LastComputedDate string           `json:"lastComputedDate"`
			DailyActivity    []map[string]any `json:"dailyActivity"`
			DailyModelTokens []struct {
				Date          string           `json:"date"`
				TokensByModel map[string]int64 `json:"tokensByModel"`
			} `json:"dailyModelTokens"`
			ModelUsage map[string]struct {
				InputTokens              int64 `json:"inputTokens"`
				OutputTokens             int64 `json:"outputTokens"`
				CacheReadInputTokens     int64 `json:"cacheReadInputTokens"`
				CacheCreationInputTokens int64 `json:"cacheCreationInputTokens"`
			} `json:"modelUsage"`
			TotalSessions    int            `json:"totalSessions"`
			TotalMessages    int            `json:"totalMessages"`
			LongestSession   map[string]any `json:"longestSession"`
			FirstSessionDate string         `json:"firstSessionDate"`
			HourCounts       map[string]any `json:"hourCounts"`
		}
		if json.Unmarshal(b, &st) == nil {
			r.Sessions = st.TotalSessions
			r.Messages = st.TotalMessages
			if t, err := time.Parse(time.RFC3339Nano, st.FirstSessionDate); err == nil {
				setTime(&r.FirstActivity, t, false)
			}
			if len(st.DailyActivity) > 90 {
				st.DailyActivity = st.DailyActivity[len(st.DailyActivity)-90:]
			}
			r.Extra["dailyActivity"] = st.DailyActivity
			r.Extra["modelUsage"] = st.ModelUsage
			if len(st.ModelUsage) > 0 {
				tt := &TokenTotals{Models: len(st.ModelUsage)}
				for _, m := range st.ModelUsage {
					tt.Input += m.InputTokens
					tt.Output += m.OutputTokens
					tt.CacheRead += m.CacheReadInputTokens
					tt.CacheCreation += m.CacheCreationInputTokens
				}
				tt.Total = tt.Input + tt.Output + tt.CacheRead + tt.CacheCreation
				r.Tokens = tt
			}
			if n := len(st.DailyModelTokens); n > 0 {
				if n > 90 {
					st.DailyModelTokens = st.DailyModelTokens[n-90:]
				}
				daily := make([]map[string]any, 0, len(st.DailyModelTokens))
				for _, d := range st.DailyModelTokens {
					var sum int64
					for _, v := range d.TokensByModel {
						sum += v
					}
					daily = append(daily, map[string]any{"date": d.Date, "tokens": sum})
				}
				r.Extra["dailyTokens"] = daily
			}
			r.Extra["hourCounts"] = st.HourCounts
			r.Extra["longestSession"] = st.LongestSession
			r.Extra["statsComputedAt"] = st.LastComputedDate
			r.Notes = append(r.Notes, "Session, message and token totals come from stats-cache.json, which Claude Code recomputes periodically (last: "+st.LastComputedDate+"). Tokens include cache reads and cache writes, matching how the API bills them.")
		}
	}
	projects := map[string]bool{}
	r.Prompts = countLines(filepath.Join(home, "history.jsonl"), func(line []byte) {
		var e struct {
			Timestamp int64  `json:"timestamp"`
			Project   string `json:"project"`
		}
		if json.Unmarshal(line, &e) != nil {
			return
		}
		if e.Project != "" {
			projects[e.Project] = true
		}
		if e.Timestamp > 0 {
			t := time.UnixMilli(e.Timestamp)
			setTime(&r.LastActivity, t, true)
			setTime(&r.FirstActivity, t, false)
		}
	})
	if r.Prompts > 0 {
		r.Notes = append(r.Notes, "Prompt count is the number of lines in history.jsonl. Prompt text is never read.")
	}
	r.Projects = countDirEntries(filepath.Join(home, "projects"))
	if r.Projects == 0 {
		r.Projects = len(projects)
	}
	if sz := t.Size(filepath.Join(home, "projects")); sz > 0 {
		r.Extra["transcriptBytes"] = sz
		r.Extra["transcriptFiles"] = t.Files(filepath.Join(home, "projects"))
	}
}

// codex reads history.jsonl (count and timestamps), session_index.jsonl,
// and counts session files.
func codex(home string, r *Report, t *Tree) {
	r.Prompts = countLines(filepath.Join(home, "history.jsonl"), func(line []byte) {
		var e struct {
			TS int64 `json:"ts"`
		}
		if json.Unmarshal(line, &e) == nil && e.TS > 0 {
			t := time.Unix(e.TS, 0)
			setTime(&r.LastActivity, t, true)
			setTime(&r.FirstActivity, t, false)
		}
	})
	r.Sessions = countLines(filepath.Join(home, "session_index.jsonl"), func(line []byte) {
		var e struct {
			UpdatedAt string `json:"updated_at"`
		}
		if json.Unmarshal(line, &e) == nil {
			if t, err := time.Parse(time.RFC3339Nano, e.UpdatedAt); err == nil {
				setTime(&r.LastActivity, t, true)
			}
		}
	})
	if sz := t.Size(filepath.Join(home, "sessions")); sz > 0 {
		r.Extra["transcriptBytes"] = sz
		r.Extra["transcriptFiles"] = t.Files(filepath.Join(home, "sessions"))
	}
	if r.Sessions > 0 {
		r.Notes = append(r.Notes, "Session count is the number of entries in session_index.jsonl.")
	}
	r.Notes = append(r.Notes, "Codex keeps token counts inside session transcripts, which agentconf never reads, so no lifetime token total is shown.")
}

func cursor(home string, r *Report, t *Tree) {
	r.Projects = countDirEntries(filepath.Join(home, "projects"))
	if sz := t.Size(filepath.Join(home, "extensions")); sz > 0 {
		r.Extra["extensionsBytes"] = sz
	}
	if sz := t.Size(filepath.Join(home, "ai-tracking")); sz > 0 {
		r.Extra["aiTrackingBytes"] = sz
	}
	if n := countDirEntries(filepath.Join(home, "plans")); n > 0 {
		r.Extra["plans"] = n
	}
	r.Notes = append(r.Notes, "Cursor keeps most usage data inside the IDE's own storage, not in ~/.cursor. Only directory footprints are shown.")
}

func gemini(home string, r *Report) {
	r.Projects = countDirEntries(filepath.Join(home, "history"))
	if b, err := os.ReadFile(filepath.Join(home, "projects.json")); err == nil {
		var m map[string]any
		if json.Unmarshal(b, &m) == nil {
			if p, ok := m["projects"].(map[string]any); ok {
				r.Projects = len(p)
			}
		}
	}
	r.Notes = append(r.Notes, "Gemini CLI stores per-project history under history/. Only counts are shown.")
}
