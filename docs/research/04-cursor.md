# Cursor (`.cursor`)

Source of truth: <https://cursor.com/docs/cli/reference/configuration>,
<https://cursor.com/docs/cli/mcp>, <https://cursor.com/docs/hooks>,
<https://cursor.com/docs/reference/plugins>

Cursor is the messiest of the three. Config is **split across four files** with
different formats and different scoping rules, and Cursor is both an IDE and a
CLI sharing some of the same files.

## Directory layout

| Path | Purpose | Type |
|---|---|---|
| `~/.cursor/cli-config.json` | CLI settings: `version`, `editor`, `permissions` | config |
| `~/.cursor/mcp.json` | MCP servers, shared by IDE and CLI | config |
| `~/.cursor/rules/` | Rules and conventions | config |
| `~/.cursor/commands/` | Custom commands | config |
| `~/.cursor/skills/` | User skills | config |
| `~/.cursor/skills-cursor/` | Cursor-managed skills, with `.cursor-managed-skills-manifest.json` and `.sync-manifest.json` | vendor |
| `~/.cursor/hooks.json` | Lifecycle hooks | config |
| `~/.cursor/plugins/` | Installed plugins, including `local/` | mixed |
| `~/.cursor/argv.json` | Electron runtime args (IDE) | config |
| `<project>/.cursor/mcp.json` | Project MCP servers | config |
| `<project>/.cursor/rules/` | Project rules | config |

### Machine state (exclude)

`extensions/`, `projects/`, `ai-tracking/`, `ide_state.json`, `plans/`

`plans/` holds generated `.plan.md` files. Arguably browsable, but not config.

## Key quirks

- **Only `permissions` can be set per project.** Every other CLI setting is
  global. This is the opposite of Claude Code and must be encoded in the
  precedence model.
- **`CURSOR_CONFIG_DIR`** relocates the user directory.
- **Some `cli-config.json` fields are CLI-managed** and get overwritten. Writing
  to them silently loses the change. The pack needs a `volatile` flag.
- **Two skills directories.** `skills/` is yours, `skills-cursor/` is
  Cursor-managed and sync-manifested. Do not let users edit the managed one.
- **Cursor reads other agents' skill directories.** See
  [06-cross-agent-conventions.md](06-cross-agent-conventions.md). It loads from
  `.claude/skills/`, `~/.claude/skills/`, `.codex/skills/`, `~/.codex/skills/`,
  `.cursor/skills/`, and `.agents/skills/`. Cursor is the most convergent agent
  of the three and a good template for what "unified" should mean.

## `cli-config.json` shape

```json
{
  "version": 1,
  "editor": { "vimMode": false },
  "permissions": { "allow": ["Shell(ls)"], "deny": ["Shell(rm)"] }
}
```

Permission entries use a `Tool(arg)` string form, e.g. `Shell(ls)`. This is a
third distinct permission syntax, different from both Claude's rule strings and
Codex's named profiles.

## `mcp.json` shape

```json
{
  "mcpServers": {
    "name-stdio": { "command": "npx", "args": ["-y", "pkg"] },
    "name-http":  { "url": "https://example.com/mcp" },
    "name-auth":  { "url": "https://example.com/mcp", "headers": { "...": "..." } }
  }
}
```

Three transport shapes in one map: stdio (`command` + `args`), plain HTTP
(`url`), and authenticated HTTP (`url` + `headers`). The unified MCP editor
must handle all three, and `headers` frequently contains secrets, so it needs
masking in the UI.

## Hooks

Defined in `hooks.json` at project or user level, or installed via plugins.
Hook output uses a `permission` field of `allow` / `deny` / `ask`, plus optional
`user_message` and `agent_message`. `failClosed: true` blocks the action on hook
failure, recommended for `beforeMCPExecution`.

## Plugins

A plugin is a directory with a `plugin.json` manifest bundling rules, skills,
agents, commands, MCP servers, and hooks. Both supported plugin formats place
`mcp.json` at the plugin root.
