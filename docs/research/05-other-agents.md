# Other agents

Four more agents were found installed on the reference machine. None justify
first-class support in v1, but all four are cheap to add once the schema pack
exists, and their presence is the argument for the product: **seven agents on
one machine is now a normal setup.**

Detection should be by directory presence plus a version probe, not a hardcoded
list. New agents appear constantly.

## Gemini CLI (`~/.gemini`)

| Path | Purpose | Type |
|---|---|---|
| `settings.json` | Config, nested by domain | config |
| `skills/` | Skills, symlinked to `~/.agents/skills` on the reference machine | config |
| `trustedFolders.json` | Per-folder trust, same idea as Codex `trust_level` | config |
| `projects.json` | Known projects | state |
| `antigravity/`, `history/`, `tmp/`, `state.json`, `installation_id` | state |
| `oauth_creds.json`, `google_accounts.json`, `mcp-oauth-tokens.json` | **credentials, never read** |

`settings.json` is **nested by domain**, unlike Claude's flat key space:

```json
{
  "security": { "auth": { "selectedType": "oauth-personal" } },
  "general":  { "previewFeatures": true }
}
```

Note `general.previewFeatures`. Several agents have an experimental-features
toggle. Surfacing those across agents in one place is a good discovery feature.

## opencode (`~/.config/opencode`)

Only agent using XDG config location rather than a home dotfolder. The scanner
must not assume `~/.<agent>`.

| Path | Purpose |
|---|---|
| `opencode.json` | Config (empty on the reference machine, 0 bytes) |
| `skills/` | Skills, symlinked to `~/.agents/skills` |
| `package.json`, `bun.lock`, `node_modules/` | plugin deps, treat as state |

## Continue (`~/.continue`) and Factory (`~/.factory`)

On the reference machine both contain **only** a `skills/` directory symlinked
into `~/.agents/skills`. They participate in the shared skills convention and
nothing else. Lowest-effort support: skills only, no settings editor.

## Detection strategy

| Agent | Marker | Version probe |
|---|---|---|
| Claude Code | `~/.claude/` or `$CLAUDE_CONFIG_DIR` | `claude --version` |
| Codex | `~/.codex/` or `$CODEX_HOME` | `codex --version` |
| Cursor | `~/.cursor/` or `$CURSOR_CONFIG_DIR` | `cursor-agent --version` |
| Gemini CLI | `~/.gemini/` | `gemini --version` |
| opencode | `~/.config/opencode/` (XDG) | `opencode --version` |
| Continue | `~/.continue/` | n/a |
| Factory | `~/.factory/` | n/a |

Version matters: the schema pack carries `addedIn` and `removedIn`, so the UI
should grey out keys the installed version does not support. See
[09-schema-registry.md](09-schema-registry.md).
