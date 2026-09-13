# Schema pack format

One JSON file per agent: `schemas/<agent>.json`. The Go binary embeds these
and the UI renders them. **Nothing in the UI knows about individual keys**, so
everything a user sees about a setting comes from here.

## Top level

```json
{
  "agent": "claude",
  "displayName": "Claude Code",
  "vendor": "Anthropic",
  "packVersion": "2026.09.14",
  "sources": ["https://code.claude.com/docs/en/settings-reference"],
  "keys": [ ... ],
  "paths": [ ... ]
}
```

## `keys[]`: one entry per configurable key

```json
{
  "key": "sandbox.network.tlsTerminate",
  "file": "settings.json",
  "type": "boolean",
  "enumValues": ["a", "b"],
  "default": false,
  "scopes": ["user", "project", "local", "managed"],
  "category": "Sandbox",
  "summary": "Have the sandbox proxy terminate TLS so it can read HTTPS requests.",
  "detail": "Only useful when you need domain-level filtering on HTTPS traffic. Requires trusting the sandbox CA.",
  "docsUrl": "https://code.claude.com/docs/en/settings-reference#sandbox",
  "flags": ["experimental"],
  "addedIn": null,
  "removedIn": null,
  "concept": "sandbox.network"
}
```

| Field | Required | Notes |
|---|---|---|
| `key` | yes | Dotted path exactly as it appears in the config file. For TOML tables use the dotted form, e.g. `mcp_servers.<id>.url`. Use `<id>` / `<name>` / `<path>` literally for wildcard segments. |
| `file` | yes | Basename of the file it lives in: `settings.json`, `config.toml`, `cli-config.json`, `mcp.json`, `hooks.json`, `keybindings.json`. |
| `type` | yes | `boolean` `string` `number` `array` `object` `enum` |
| `enumValues` | when `type=enum` | |
| `default` | no | Any JSON value. Omit if unknown. |
| `scopes` | yes | Subset of `user` `project` `local` `managed` `profile`. Which layers may set it. |
| `category` | yes | Use the shared list below. |
| `summary` | yes | One sentence, under 120 chars. Plain, no marketing. |
| `detail` | no | 1 to 3 sentences. **Only** when the summary is not self-explanatory: when to use it, gotchas, interactions. Skip for obvious keys like `model`. |
| `docsUrl` | yes | Deepest link available. Verify anchor format by fetching the page. Fall back to the section page. |
| `flags` | no | Any of `experimental` `managedOnly` `deprecated` `removed` `volatile` `sensitive` `state`. `state` means it lives in a config file but is machine state, not a user choice. `volatile` means the agent overwrites it. |
| `addedIn` / `removedIn` | no | Version strings when documented. |
| `concept` | no | Cross-agent concept id from the list below. Powers side-by-side comparison. |

### Shared categories

`Model` `Permissions` `Sandbox` `Memory & context` `Skills & plugins` `MCP`
`Hooks` `Interface` `Git` `Auth & providers` `Notifications` `Enterprise`
`Updates` `Privacy` `Tools` `Projects` `Agents & sessions` `Other`

### Cross-agent concept ids

`model.default` `model.effort` `model.provider` `mcp.servers`
`permissions.rules` `permissions.mode` `sandbox.mode` `sandbox.network`
`sandbox.filesystem` `instructions.file` `skills.dir` `skills.budget` `hooks`
`notifications` `telemetry` `updates` `auth.method` `compaction` `memory`
`theme` `editor.vim` `web_search` `persona` `trust.projects` `plugins`
`history` `attribution`

## `paths[]`: directory and file extension points

```json
{
  "path": "~/.claude/skills/",
  "kind": "skills",
  "scope": "user",
  "editable": true,
  "summary": "Personal skills available in every project. One directory per skill with a SKILL.md entrypoint.",
  "docsUrl": "https://code.claude.com/docs/en/skills"
}
```

| Field | Notes |
|---|---|
| `path` | Use `~/` for the agent's home dir root and `<project>/` for project-relative. Trailing slash for directories. |
| `kind` | `settings` `instructions` `mcp` `skills` `rules` `agents` `commands` `hooks` `outputStyles` `workflows` `plugins` `themes` `keybindings` `memory` `trust` `state` `credential` `vendor` `logs` |
| `scope` | `user` or `project` |
| `editable` | `true` for user config. `false` for state, vendor-managed, agent-written, and credentials. |
| `summary` | One sentence. |
| `docsUrl` | Optional. |

Include **every** path the scanner should know about, including state and
credential paths, because the scanner uses `kind: credential` as a hard
exclusion list and `kind: state` to hide noise.

## Rules

- **No em-dashes anywhere.** Use commas, colons, or periods.
- Plain factual voice. No "simply", no "powerful".
- Every key in the vendor reference must appear. Completeness is the product.
- Valid JSON. Validate before finishing.
