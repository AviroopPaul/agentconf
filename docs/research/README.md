# agentconf research

Reference data for building a UI over coding-agent config directories
(`.claude`, `.codex`, `.cursor`, and friends).

These files are **data, not build instructions**. They record what is actually
in these folders, what already exists in the market, and the handful of
high-level decisions that are already settled. Everything below the level of
"which technology and in what order" is left open for the implementer.

Researched 2026-09-14 against live vendor docs and a real machine
(macOS, all seven agents installed).

## Files

| File | Contents |
|---|---|
| [01-problem-and-verdict.md](01-problem-and-verdict.md) | What the product is, who it is for, the one-line verdict |
| [02-claude-code.md](02-claude-code.md) | Full `.claude` surface: ~192 settings keys, directory layout |
| [03-codex.md](03-codex.md) | Full `.codex` surface: ~75 keys, ~35 TOML tables |
| [04-cursor.md](04-cursor.md) | `.cursor` surface: split across four files, per-project quirks |
| [05-other-agents.md](05-other-agents.md) | Gemini CLI, opencode, Continue, Factory |
| [06-cross-agent-conventions.md](06-cross-agent-conventions.md) | MCP, AGENTS.md, SKILL.md, `.agents/`: the shared layer |
| [07-prior-art.md](07-prior-art.md) | Every comparable tool, with stars and honest positioning |
| [08-architecture-decisions.md](08-architecture-decisions.md) | Settled decisions and the alternatives that were rejected |
| [09-schema-registry.md](09-schema-registry.md) | The schema pack: shape, and how it stays current |
| [10-build-order.md](10-build-order.md) | What to build first, and why that order |
| [11-constraints-and-risks.md](11-constraints-and-risks.md) | Credentials, format-preserving writes, precedence, state vs config |

## The short version

Coding agents expose roughly 300 configurable keys across their config
directories. Almost nobody knows. Existing tools are either Claude-only config
editors (small, several already abandoned) or multi-agent session managers
(large, but a different product). The multi-agent plus UI plus discovery
intersection is empty.

Build it as an `npx`-launched local web app, backed by an auto-updating schema
registry. The registry is the moat, not the UI.
