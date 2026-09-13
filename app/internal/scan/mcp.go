package scan

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// normaliseMCP turns one raw server object into an MCPServer, dropping
// every secret-bearing value.
func normaliseMCP(name, agent, scope, project, source string, raw map[string]any) MCPServer {
	s := MCPServer{Name: name, Agent: agent, Scope: scope, Project: project, Source: source, Transport: "unknown"}
	if v, ok := raw["command"].(string); ok && v != "" {
		s.Command = v
		s.Transport = "stdio"
	}
	if v, ok := raw["args"].([]any); ok {
		for _, a := range v {
			if str, ok := a.(string); ok {
				s.Args = append(s.Args, str)
			}
		}
	}
	for _, urlKey := range []string{"url", "serverUrl", "httpUrl"} {
		if v, ok := raw[urlKey].(string); ok && v != "" {
			s.URL = v
			s.Transport = "http"
		}
	}
	if t, ok := raw["type"].(string); ok && t != "" {
		s.Transport = strings.ToLower(t)
	}
	if v, ok := raw["env"].(map[string]any); ok {
		for k := range v {
			s.EnvKeys = append(s.EnvKeys, k)
		}
		sort.Strings(s.EnvKeys)
	}
	for _, hk := range []string{"headers", "http_headers", "env_http_headers"} {
		if v, ok := raw[hk].(map[string]any); ok && len(v) > 0 {
			s.HasHeaders = true
		}
	}
	if v, ok := raw["bearer_token_env_var"].(string); ok && v != "" {
		s.HasHeaders = true
		s.EnvKeys = append(s.EnvKeys, v)
	}
	if v, ok := raw["disabled"].(bool); ok {
		s.Disabled = v
	}
	if v, ok := raw["enabled"].(bool); ok && !v {
		s.Disabled = true
	}
	return s
}

// mcpFromMap reads a {name: server} map.
func mcpFromMap(agent, scope, project, source string, m map[string]any) []MCPServer {
	names := make([]string, 0, len(m))
	for k := range m {
		names = append(names, k)
	}
	sort.Strings(names)
	var out []MCPServer
	for _, n := range names {
		raw, ok := m[n].(map[string]any)
		if !ok {
			continue
		}
		out = append(out, normaliseMCP(n, agent, scope, project, source, raw))
	}
	return out
}

// claudeGlobalState is the tiny slice of ~/.claude.json we read. Everything
// else in that file is UI state and is ignored by construction.
type claudeGlobalState struct {
	MCPServers map[string]map[string]any `json:"mcpServers"`
	Projects   map[string]struct {
		MCPServers             map[string]map[string]any `json:"mcpServers"`
		HasTrustDialogAccepted bool                      `json:"hasTrustDialogAccepted"`
		LastCost               float64                   `json:"lastCost"`
		LastSessionID          string                    `json:"lastSessionId"`
	} `json:"projects"`
}

func readClaudeGlobal(userHome string) (*claudeGlobalState, string, error) {
	p := filepath.Join(userHome, ".claude.json")
	b, err := os.ReadFile(p)
	if err != nil {
		return nil, p, err
	}
	var st claudeGlobalState
	if err := json.Unmarshal(b, &st); err != nil {
		return nil, p, err
	}
	return &st, p, nil
}

func toAnyMap(m map[string]map[string]any) map[string]any {
	out := make(map[string]any, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

// groupMCP builds the cross-agent view.
func groupMCP(agentsReports []AgentReport) []MCPGroup {
	byName := map[string][]MCPServer{}
	for _, a := range agentsReports {
		for _, s := range a.MCP {
			byName[s.Name] = append(byName[s.Name], s)
		}
	}
	names := make([]string, 0, len(byName))
	for n := range byName {
		names = append(names, n)
	}
	sort.Strings(names)
	var out []MCPGroup
	for _, n := range names {
		servers := byName[n]
		g := MCPGroup{Name: n, Servers: servers, Consistent: true}
		seen := map[string]bool{}
		var sig string
		for i, s := range servers {
			if !seen[s.Agent] {
				seen[s.Agent] = true
				g.Agents = append(g.Agents, s.Agent)
			}
			cur := s.Transport + "|" + s.Command + "|" + strings.Join(s.Args, " ") + "|" + s.URL
			if i == 0 {
				sig = cur
			} else if cur != sig {
				g.Consistent = false
			}
		}
		out = append(out, g)
	}
	return out
}
