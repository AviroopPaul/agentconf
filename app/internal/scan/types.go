package scan

import (
	"time"

	"github.com/AviroopPaul/agentconf/app/internal/agents"
	"github.com/AviroopPaul/agentconf/app/internal/schema"
	"github.com/AviroopPaul/agentconf/app/internal/usage"
)

// Inventory is the complete read-only picture of one machine.
type Inventory struct {
	GeneratedAt time.Time `json:"generatedAt"`
	Hostname    string    `json:"hostname"`
	UserHome    string    `json:"userHome"`
	ScanMillis  int64     `json:"scanMillis"`
	// FullScanMillis is the time of the enrichment pass (directory sizes,
	// version probes). Zero until that pass has completed.
	FullScanMillis int64               `json:"fullScanMillis,omitempty"`
	Agents         []AgentReport       `json:"agents"`
	Skills         []SkillGroup        `json:"skills"`
	MCP            []MCPGroup          `json:"mcp"`
	Packs          map[string]PackMeta `json:"packs"`
}

// PackMeta is the small part of a schema pack the UI needs up front.
type PackMeta struct {
	Agent       string   `json:"agent"`
	DisplayName string   `json:"displayName"`
	Vendor      string   `json:"vendor"`
	PackVersion string   `json:"packVersion"`
	Sources     []string `json:"sources"`
	KeyCount    int      `json:"keyCount"`
	PathCount   int      `json:"pathCount"`
}

// AgentReport is everything we know about one agent on this machine.
type AgentReport struct {
	agents.Detected
	HasPack      bool                  `json:"hasPack"`
	PackVersion  string                `json:"packVersion,omitempty"`
	Paths        []PathStatus          `json:"paths"`
	Keys         []KeyStatus           `json:"keys"`
	UnknownKeys  []UnknownKey          `json:"unknownKeys"`
	Stats        KeyStats              `json:"stats"`
	ConfigFiles  []ConfigFile          `json:"configFiles"`
	Skills       []Skill               `json:"skills"`
	MCP          []MCPServer           `json:"mcp"`
	Hooks        []HookEvent           `json:"hooks"`
	Plugins      []Plugin              `json:"plugins"`
	Extensions   map[string][]ExtEntry `json:"extensions"`
	Instructions []InstructionFile     `json:"instructions"`
	Usage        *usage.Report         `json:"usage,omitempty"`
	Errors       []string              `json:"errors,omitempty"`
}

// PathStatus is a schema path resolved against the filesystem.
type PathStatus struct {
	schema.Path
	Resolved  string     `json:"resolved"`
	Exists    bool       `json:"exists"`
	IsDir     bool       `json:"isDir"`
	IsSymlink bool       `json:"isSymlink"`
	Target    string     `json:"target,omitempty"`
	Entries   int        `json:"entries,omitempty"`
	SizeBytes int64      `json:"sizeBytes,omitempty"`
	ModTime   *time.Time `json:"modTime,omitempty"`
}

// ConfigFile is a parsed config document summary.
type ConfigFile struct {
	Path      string `json:"path"`
	Format    string `json:"format"`
	SizeBytes int64  `json:"sizeBytes"`
	LeafCount int    `json:"leafCount"`
	Error     string `json:"error,omitempty"`
}

// KeyStatus is a schema key plus whether and how it is set here.
type KeyStatus struct {
	schema.Key
	Set     bool     `json:"set"`
	Value   any      `json:"value,omitempty"`
	Masked  bool     `json:"masked,omitempty"`
	Source  string   `json:"source,omitempty"`
	Matches []string `json:"matches,omitempty"`
}

// UnknownKey is set in a config file but absent from the schema pack.
type UnknownKey struct {
	Key    string `json:"key"`
	Value  any    `json:"value,omitempty"`
	Masked bool   `json:"masked,omitempty"`
	Source string `json:"source"`
}

// KeyStats summarises the key surface for one agent.
type KeyStats struct {
	Total        int `json:"total"`
	Set          int `json:"set"`
	Unset        int `json:"unset"`
	Deprecated   int `json:"deprecatedSet"`
	Experimental int `json:"experimentalSet"`
	Unknown      int `json:"unknown"`
}

// Skill is one entry in an agent's skills directory.
type Skill struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	IsSymlink   bool   `json:"isSymlink"`
	Target      string `json:"target,omitempty"`
	RealPath    string `json:"realPath"`
	Broken      bool   `json:"broken"`
	HasSkillMD  bool   `json:"hasSkillMd"`
	Description string `json:"description,omitempty"`
	Managed     bool   `json:"managed"`
	Source      string `json:"source"`
}

// SkillGroup is one real skill seen across agents.
type SkillGroup struct {
	Name        string                   `json:"name"`
	RealPath    string                   `json:"realPath"`
	Description string                   `json:"description,omitempty"`
	Shared      bool                     `json:"shared"`
	Agents      map[string]SkillPresence `json:"agents"`
	Present     int                      `json:"present"`
	Capable     int                      `json:"capable"`
}

// SkillPresence is how one agent sees a skill.
type SkillPresence struct {
	Present bool   `json:"present"`
	Kind    string `json:"kind"` // symlink | dir | missing
	Broken  bool   `json:"broken,omitempty"`
	Path    string `json:"path,omitempty"`
}

// MCPServer is a normalised MCP server definition. Secrets never leave here:
// env and header values are dropped, only their presence is reported.
type MCPServer struct {
	Name       string   `json:"name"`
	Agent      string   `json:"agent"`
	Transport  string   `json:"transport"` // stdio | http | sse | unknown
	Command    string   `json:"command,omitempty"`
	Args       []string `json:"args,omitempty"`
	URL        string   `json:"url,omitempty"`
	EnvKeys    []string `json:"envKeys,omitempty"`
	HasHeaders bool     `json:"hasHeaders"`
	Scope      string   `json:"scope"` // user | project
	Project    string   `json:"project,omitempty"`
	Source     string   `json:"source"`
	Disabled   bool     `json:"disabled,omitempty"`
}

// MCPGroup is one server name across agents.
type MCPGroup struct {
	Name       string      `json:"name"`
	Servers    []MCPServer `json:"servers"`
	Agents     []string    `json:"agents"`
	Consistent bool        `json:"consistent"`
}

// HookEvent counts hooks registered for one lifecycle event.
type HookEvent struct {
	Event  string `json:"event"`
	Count  int    `json:"count"`
	Source string `json:"source"`
}

// Plugin is an installed or enabled plugin.
type Plugin struct {
	Name        string `json:"name"`
	Version     string `json:"version,omitempty"`
	Scope       string `json:"scope,omitempty"`
	Enabled     *bool  `json:"enabled,omitempty"`
	InstalledAt string `json:"installedAt,omitempty"`
	LastUpdated string `json:"lastUpdated,omitempty"`
	Source      string `json:"source"`
}

// ExtEntry is a file or directory inside an extension point (rules, agents,
// commands, output styles, workflows, themes).
type ExtEntry struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	IsDir     bool   `json:"isDir"`
	IsSymlink bool   `json:"isSymlink"`
	SizeBytes int64  `json:"sizeBytes"`
}

// InstructionFile is a CLAUDE.md / AGENTS.md / GEMINI.md style file.
type InstructionFile struct {
	Path            string `json:"path"`
	Exists          bool   `json:"exists"`
	SizeBytes       int64  `json:"sizeBytes,omitempty"`
	Lines           int    `json:"lines,omitempty"`
	ImportsAgentsMD bool   `json:"importsAgentsMd,omitempty"`
	IsSymlink       bool   `json:"isSymlink,omitempty"`
	Target          string `json:"target,omitempty"`
}
