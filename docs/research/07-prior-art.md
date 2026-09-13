# Prior art

Surveyed 2026-09-14. Star counts and last-push dates from the GitHub API on
that date.

## The landscape splits in two, and neither half is this product

### Session managers (big, but a different product)

These run agents remotely or on mobile. They touch config incidentally. Their
star counts are not evidence that config UIs are solved.

| Repo | Stars | Last push | What it is |
|---|---|---|---|
| [siteboon/claudecodeui](https://github.com/siteboon/claudecodeui) | 13,673 | 2026-09-10 | CloudCLI. Run Claude Code / OpenCode / Cursor CLI / Codex from web and mobile. Has MCP and permission editing, but the product is remote sessions. |
| [kbwo/ccmanager](https://github.com/kbwo/ccmanager) | 1,239 | 2026-09-13 | TUI session manager across 8 agents and git worktrees. No config editing. |
| MonoCode | n/a | n/a | Tauri desktop app, tabs are agent sessions. |

### Config editors (all Claude-only, all small, several abandoned)

| Repo | Stars | Last push | What it is |
|---|---|---|---|
| [tylergraydev/claude-code-tool-manager](https://github.com/tylergraydev/claude-code-tool-manager) | 383 | 2026-07-17 | MCP servers only. Also a statusline builder with 25+ segment types. Claude only. |
| [gagarinyury/claude-config-editor](https://github.com/gagarinyury/claude-config-editor) | 262 | **2025-10-29** | Cleanup tool for bloated `.claude.json`, not an authoring tool. **Dead for ~11 months.** |
| [markes76/claude-code-gui](https://github.com/markes76/claude-code-gui) | 33 | 2026-03-12 | Closest in ambition: CLAUDE.md editor across 4 scopes, memory browser, rules, skills, subagents, commands, hooks, MCP marketplace. Claude only. 33 stars. |
| [drewipson/claude-code-config](https://github.com/drewipson/claude-code-config) | 26 | **2025-12-02** | VS Code extension, visual hook builder. Stale. |
| [mrspot-dev/claude-settings-editor](https://github.com/mrspot-dev/claude-settings-editor) | 5 | 2026-09-10 | Single standalone HTML, Alpine + Tailwind, File System Access API. Claude only. |
| [claude-settings.nl](https://claude-settings.nl/) | n/a | n/a | Hosted visual JSON editor, 40+ settings in tabs. Covers ~20% of the key surface. |

### Multi-agent sync (right scope, no UI)

| Repo | Stars | Last push | What it is |
|---|---|---|---|
| [amtiYo/agents](https://github.com/amtiYo/agents) | 94 | 2026-09-13 | `.agents` as source of truth, generates per-tool formats (TOML for Codex, JSON for others), symlinks skill dirs. **CLI only.** Closest competitor conceptually. |
| [Tomyail/abridge](https://github.com/Tomyail/abridge) | 0 | 2026-03-01 | Bidirectional config bridge, unified MCP management. No traction. |

Also relevant: **chezmoi** is the generic answer people reach for today,
templating one source into each tool's path.

## Conclusions

1. **The multi-agent + UI + discovery intersection is empty.** Every config
   editor is Claude-only. Every multi-agent tool is a CLI.
2. **The best-funded attempt at a Claude config GUI got 33 stars.** Either the
   demand is weak, or nobody has framed it right. The framing bet is that
   editing is weak demand and *discovery plus drift detection* is strong demand.
3. **`claude-settings.nl` and similar cover a fraction of the surface.** 40 of
   ~192 keys. The completeness gap is real and defensible.
4. **262 stars is not enough to keep a hardcoded tool alive.**
   `claude-config-editor` has been dead since October 2025. This is the
   strongest single argument for the schema registry in
   [09-schema-registry.md](09-schema-registry.md): if keeping current is manual,
   the tool dies, regardless of traction.
5. **`amtiYo/agents` is the one to watch.** Same thesis, active, no UI. Adding
   a UI to it is a plausible alternative strategy to building from scratch.

## Differentiators available

- Multi-agent, not Claude-only.
- Complete key coverage, auto-refreshed.
- Discovery-first framing: default view is **unset** keys.
- Doctor mode: cross-agent drift, duplicate MCP definitions, skill coverage gaps.
- A public config changelog feed as a marketing channel. Nobody publishes
  "what changed in coding-agent config this week."
