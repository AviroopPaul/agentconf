# Cross-agent conventions

This is the most important research finding. **A shared layer already exists.**
It is not hypothetical and it is not something this product needs to invent. It
is currently maintained by hand, badly, with symlinks.

Three conventions have taken hold.

## 1. MCP, the only real tools contract

Every agent supports MCP. **None of them agree on where or how it is written.**

| Agent | Path | Format | Key |
|---|---|---|---|
| Claude Code | `<repo>/.mcp.json` (repo root, **not** `.claude/`) | JSON | `mcpServers` |
| Claude Code (managed) | `managed-mcp.json` | JSON | `managedMcpServers` |
| Codex | `~/.codex/config.toml` | **TOML** | `[mcp_servers.<id>]` |
| Cursor | `~/.cursor/mcp.json`, `<repo>/.cursor/mcp.json` | JSON | `mcpServers` |
| Copilot (VS Code) | `.vscode/mcp.json` | JSON | `servers` (different key) |

The same server ends up written four ways. This is the single clearest
cross-agent win and the reason MCP unification is feature #2 in
[10-build-order.md](10-build-order.md).

Transport shapes to support: stdio (`command` + `args` + `env`), HTTP (`url`),
HTTP with auth (`url` + `headers`, usually secret-bearing).

## 2. AGENTS.md, the instructions standard

- Plain Markdown at repo root. No required fields.
- Read by **30+ agents**: Codex, Copilot, Cursor, Gemini CLI, Jules, Factory,
  Aider, Zed, VS Code, Windsurf, Devin, and others.
- Stewarded by the **Agentic AI Foundation** at the Linux Foundation.
- Adopted by **60,000+ open-source projects**.
- Meta's Muse Code (launched 2026-08-05) shipped with no `MUSE.md`, adopting
  AGENTS.md with CLAUDE.md as fallback. Consolidation is real.

**The Claude Code exception.** Claude Code does not natively load AGENTS.md into
context the way it loads CLAUDE.md. Reports conflict on whether this has shipped
(issue #6235 was closed as completed 2026-08-17, but as of late August 2026 the
changelog did not mention AGENTS.md and the file was not loaded ambiently).
**Verify current behavior before building around it.**

The common workaround, which the tool should be able to set up in one click:
keep AGENTS.md as the single source and make `CLAUDE.md` a one-line
`@AGENTS.md` import.

Evidence from the reference machine: 17 repos have `AGENTS.md`, and at least one
(`tario-oa`) already symlinks `AGENTS.md -> CLAUDE.md`.

## 3. SKILL.md and `.agents/skills/`

Started Anthropic-only, now cross-vendor. Cursor loads skills from
`.claude/skills/`, `~/.claude/skills/`, `.codex/skills/`, `~/.codex/skills/`,
its own `.cursor/skills/`, and the vendor-neutral `.agents/skills/`.

**The reference machine already runs a hand-built version of this product's
core feature.** `~/.agents/skills/` holds the real skill directories, with
`.skill-lock.json` alongside, and every agent symlinks into it:

```
~/.agents/skills/<name>/          <- real directory
~/.claude/skills/<name>          -> ../../.agents/skills/<name>
~/.cursor/skills/<name>          -> ../../.agents/skills/<name>
~/.codex/skills/<name>           -> ../../.agents/skills/<name>
~/.gemini/skills/<name>          -> ../../.agents/skills/<name>
~/.continue/skills/<name>        -> ../../.agents/skills/<name>
~/.factory/skills/<name>         -> ../../.agents/skills/<name>
~/.config/opencode/skills/<name> -> ../../../.agents/skills/<name>
```

Observations that matter for implementation:

- **Coverage is inconsistent.** Some skills are symlinked into all seven agents,
  some into two or three, some exist as real directories in only one agent.
  That inconsistency is invisible today and is exactly what doctor mode should
  surface.
- **Some links point elsewhere**, e.g. `box -> /Users/aviroop/.agent-skills/box`,
  an absolute path outside `.agents`. The scanner must resolve symlinks and
  handle targets outside the expected tree.
- **The scanner must follow symlinks.** This alone rules out a browser-only
  File System Access API implementation. See
  [08-architecture-decisions.md](08-architecture-decisions.md).
- Relative link depth differs for opencode (`../../../`) because of XDG.

## Design implication

Unify **MCP, skills, and instructions**. Do not try to unify permissions,
sandboxing, or model settings. Those have genuinely incompatible shapes across
agents (Codex has named permission profiles, Claude has flat allow/ask/deny
lists, Cursor has `Tool(arg)` strings). A unified permissions editor would be a
lie. Show them side by side per agent instead, and let doctor mode flag
divergence without pretending it can merge them.
