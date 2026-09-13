// Package agents knows which coding agents exist, where they keep their
// configuration, and how to ask them for a version. Detection is by directory
// presence; the binary is optional.
package agents

import (
	"bytes"
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var reANSI = regexp.MustCompile(`\x1b\[[0-9;]*[A-Za-z]`)

// Agent is a static description of one coding agent.
type Agent struct {
	ID          string   `json:"id"`
	DisplayName string   `json:"displayName"`
	Vendor      string   `json:"vendor"`
	Color       string   `json:"color"`
	DocsURL     string   `json:"docsUrl"`
	HomeEnv     string   `json:"homeEnv,omitempty"`
	Binaries    []string `json:"binaries,omitempty"`

	// defaultHome is relative to $HOME unless xdg is set, in which case it is
	// relative to $XDG_CONFIG_HOME (default ~/.config).
	defaultHome string
	xdg         bool
}

// Detected is an Agent plus what we found on this machine.
type Detected struct {
	Agent
	Home        string `json:"home"`
	Installed   bool   `json:"installed"`
	BinaryFound bool   `json:"binaryFound"`
	BinaryPath  string `json:"binaryPath,omitempty"`
	Version     string `json:"version,omitempty"`
	ProbeError  string `json:"probeError,omitempty"`
}

// Registry lists every agent we know how to read. Order is display order.
var Registry = []Agent{
	{
		ID: "claude", DisplayName: "Claude Code", Vendor: "Anthropic", Color: "#D97757",
		DocsURL: "https://code.claude.com/docs", HomeEnv: "CLAUDE_CONFIG_DIR", Binaries: []string{"claude"},
		defaultHome: ".claude",
	},
	{
		ID: "codex", DisplayName: "Codex CLI", Vendor: "OpenAI", Color: "#10A37F",
		DocsURL: "https://learn.chatgpt.com/docs", HomeEnv: "CODEX_HOME", Binaries: []string{"codex"},
		defaultHome: ".codex",
	},
	{
		ID: "cursor", DisplayName: "Cursor", Vendor: "Anysphere", Color: "#E5E7EB",
		DocsURL: "https://cursor.com/docs", HomeEnv: "CURSOR_CONFIG_DIR", Binaries: []string{"cursor-agent", "cursor"},
		defaultHome: ".cursor",
	},
	{
		ID: "gemini", DisplayName: "Gemini CLI", Vendor: "Google", Color: "#4E8CF9",
		DocsURL: "https://geminicli.com/docs", Binaries: []string{"gemini"},
		defaultHome: ".gemini",
	},
	{
		ID: "opencode", DisplayName: "opencode", Vendor: "SST", Color: "#F5A524",
		DocsURL: "https://opencode.ai/docs", Binaries: []string{"opencode"},
		defaultHome: "opencode", xdg: true,
	},
	{
		ID: "continue", DisplayName: "Continue", Vendor: "Continue", Color: "#8B5CF6",
		DocsURL: "https://docs.continue.dev", Binaries: []string{"cn"},
		defaultHome: ".continue",
	},
	{
		ID: "factory", DisplayName: "Factory", Vendor: "Factory", Color: "#F472B6",
		DocsURL: "https://docs.factory.ai", Binaries: []string{"droid"},
		defaultHome: ".factory",
	},
}

// HomeDir resolves the agent's config directory on this machine.
func (a Agent) HomeDir() string {
	if a.HomeEnv != "" {
		if v := os.Getenv(a.HomeEnv); v != "" {
			return expand(v)
		}
	}
	home, _ := os.UserHomeDir()
	if a.xdg {
		base := os.Getenv("XDG_CONFIG_HOME")
		if base == "" {
			base = filepath.Join(home, ".config")
		}
		return filepath.Join(base, a.defaultHome)
	}
	return filepath.Join(home, a.defaultHome)
}

func expand(p string) string {
	if strings.HasPrefix(p, "~/") {
		home, _ := os.UserHomeDir()
		return filepath.Join(home, p[2:])
	}
	return p
}

// Detect checks directory presence and binary presence for every agent.
// It does not run anything; call Probe for versions.
func Detect() []Detected {
	out := make([]Detected, len(Registry))
	for i, a := range Registry {
		d := Detected{Agent: a, Home: a.HomeDir()}
		if st, err := os.Stat(d.Home); err == nil && st.IsDir() {
			d.Installed = true
		}
		for _, bin := range a.Binaries {
			if p, err := exec.LookPath(bin); err == nil {
				d.BinaryFound = true
				d.BinaryPath = p
				break
			}
		}
		out[i] = d
	}
	return out
}

// Probe runs `<binary> --version` with a short timeout and fills Version.
func Probe(d *Detected) {
	if !d.BinaryFound {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, d.BinaryPath, "--version")
	env := []string{"TERM=dumb", "CI=1"}
	for _, kv := range os.Environ() {
		if strings.HasPrefix(kv, "FORCE_COLOR=") || strings.HasPrefix(kv, "NO_COLOR=") {
			continue
		}
		env = append(env, kv)
	}
	cmd.Env = env
	var buf bytes.Buffer
	cmd.Stdout = &buf
	cmd.Stderr = &buf
	err := cmd.Run()
	// First meaningful line: skip blank lines and warnings, strip colour codes.
	line := ""
	for _, l := range strings.Split(reANSI.ReplaceAllString(buf.String(), ""), "\n") {
		l = strings.TrimSpace(l)
		low := strings.ToLower(l)
		if l == "" || strings.HasPrefix(low, "warning") || strings.HasPrefix(low, "(node:") || strings.HasPrefix(low, "at ") || strings.HasPrefix(low, "(use ") {
			continue
		}
		line = l
		break
	}
	if len(line) > 80 {
		line = line[:80]
	}
	if err != nil || strings.HasPrefix(line, "Error") || strings.Contains(line, "ENOENT") {
		d.ProbeError = line
		if d.ProbeError == "" && err != nil {
			d.ProbeError = err.Error()
		}
		return
	}
	d.Version = line
}
