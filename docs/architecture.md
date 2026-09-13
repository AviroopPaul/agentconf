# Architecture

One Go binary, one embedded React UI, one JSON schema pack per agent.

```
                 ┌──────────────────────────────────────────┐
                 │ schemas/*.json  (embedded via go:embed)   │
                 │ key: type, summary, detail, docsUrl, ...  │
                 └──────────────┬───────────────────────────┘
                                │
  ~/.claude  ~/.codex  ~/.cursor  ~/.gemini  ...
        │          │        │         │
        ▼          ▼        ▼         ▼
  ┌─────────────────────────────────────────┐
  │ internal/scan                            │
  │  detect agents  → resolve schema paths   │
  │  parse JSON/TOML → flatten → match keys  │
  │  skills (symlink-aware), MCP, hooks,     │
  │  plugins, instructions, usage            │
  └──────────────┬──────────────────────────┘
                 ▼
  ┌──────────────────────┐   ┌──────────────────────┐
  │ internal/doctor       │   │ internal/server       │
  │ read-only findings    │──▶│ /api/inventory        │──▶ embedded React UI
  └──────────────────────┘   │ 127.0.0.1 only        │
                             └──────────────────────┘
```

## Packages

| Package | Responsibility |
|---|---|
| `app/internal/agents` | Static registry of agents (id, vendor, home dir, env override, binaries). `Detect()` stats directories and looks up binaries. `Probe()` runs `--version` with a timeout and strips noise. |
| `app/internal/schema` | Loads embedded packs into `Pack{Keys, Paths}`. `Match()` compares a concrete dotted path against a schema key, honouring `<id>` placeholders and object prefixes. |
| `app/internal/scan` | The scanner. Resolves each pack path against the filesystem, parses config files (JSONC and TOML) into flattened leaf entries, matches them to schema keys, masks secrets, lists skills (resolving symlinks), normalises MCP servers, counts hooks, reads plugin manifests. Builds cross-agent skill and MCP groups. |
| `app/internal/usage` | One `Walk()` per agent home producing a `Tree` with the size of every directory, so nothing is walked twice. Agent-specific readers pull counts and timestamps from `stats-cache.json`, `history.jsonl`, `session_index.jsonl`. |
| `app/internal/doctor` | Pure functions over an `Inventory` returning `Finding`s. No IO. |
| `app/internal/server` | `net/http` server. Two-phase refresh: a fast scan is served immediately, a full scan (sizes, versions) replaces it in the background. SPA fallback for the embedded UI. |
| `app/web` | Vite + React + Tailwind. `embed.go` exposes `dist/`. The built `dist/` is committed so `go install` works from a clean clone. |
| `schemas` | The packs, and `embed.go`. |

## Data flow for one key

1. Pack says `{"key": "sandbox.network.allowedDomains", "file": "settings.json", "type": "array", ...}`.
2. Scanner finds `~/.claude/settings.json` (pack path of kind `settings`), parses it, flattens to entries like `["sandbox","network","allowedDomains"] → [...]`.
3. `matchKeys` looks up the segments in the parsed document. Found: `Set=true`, `Value` (masked if the key or any segment looks secret), `Source=path`.
4. Wildcard keys (`mcp_servers.<id>.url`) instead iterate entries and collect concrete matches.
5. Entries not covered by any key become `UnknownKeys`, which the doctor reports.

## Why two artifacts

The UI has no per-key knowledge. It renders whatever the pack describes. A new
vendor setting means a pack change, not a UI change. That is the whole bet:
the completeness of the pack is the product, the binary is a viewer.

## Performance

- Detection is a handful of `stat` calls.
- Parsing is a few small files.
- The expensive part is the directory walk for sizes: ~17k files in `~/.claude` costs ~220 ms (one `lstat` per file). It runs once per agent, in parallel across agents, and only in phase 2.
- Version probes spawn processes. Electron and Node binaries take 300 to 500 ms to answer `--version`. Phase 2 only.
- Phase 1 typically completes in 20 to 60 ms.
