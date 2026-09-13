# Build order

Ordered by **risk and demonstrability**, not by difficulty. Each step is
shippable on its own.

## 0. Scanner and detection (foundation)

Detect installed agents by directory presence plus a version probe. Respect
`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `CURSOR_CONFIG_DIR`, and XDG for opencode.
Resolve symlinks. Classify every path as config, state, vendor-managed,
agent-written, or credential.

No UI yet. This is what everything else reads.

## 1. Read-only inventory

> "Here is every agent installed, every config file, every key you have set,
> and the ~280 you have not."

- Zero write risk.
- This is the screenshot that sells the tool.
- Validates the schema pack against real machines before anyone can break
  anything with it.

On the reference machine this immediately shows: 14 of 192 Claude keys set,
about 5 real Codex keys, an empty `opencode.json`.

## 2. Schema-driven settings browser, default filter = unset

The discovery surface, and the core of the product thesis. Group by category,
search across all agents at once, deep-link to vendor docs per key. Show
effective value and which precedence layer it came from.

Still read-only, or read-write behind a clear diff preview.

## 3. MCP unification

The clearest cross-agent win, because MCP is the one real shared contract and
the same server currently gets written four different ways
([06-cross-agent-conventions.md](06-cross-agent-conventions.md)).

One server list, checkboxes for which agents get it, correct format written to
each: `.mcp.json` for Claude, `[mcp_servers.*]` TOML for Codex, `mcp.json` for
Cursor. Handle all three transport shapes (stdio, HTTP, HTTP with headers) and
mask secrets in `headers`.

This is the first real write path. Ship the diff preview and backup machinery
here.

## 4. Doctor mode

**The painkiller.** Everything above is a vitamin.

Detects:
- The same MCP server defined differently across agents.
- Permission rules that have drifted apart.
- A skill present in one agent's directory and missing from another's.
- Broken symlinks, and links pointing outside the expected tree.
- Stale plugin pins.
- Deprecated or removed keys still set.
- Keys set that the installed agent version does not support.

On the reference machine this would light up immediately: skill symlink coverage
across the seven agents is inconsistent, and at least one link points outside
`~/.agents`.

## 5. Skills and rules manager

One list, per-agent toggles. Essentially a UI over the symlink pattern users
already maintain by hand. Also: the one-click AGENTS.md plus `@AGENTS.md`
CLAUDE.md setup, subject to verifying current Claude Code behavior.

## Deliberately later

- **Permissions and sandbox editing.** Incompatible shapes per agent
  ([08-architecture-decisions.md](08-architecture-decisions.md), D4). Show side
  by side, do not merge.
- **Project-level config.** User-level first. Project scanning multiplies the
  surface and the precedence complexity.
- **Hooks builder.** High value, but hooks execute arbitrary commands. Wait
  until the write path is trusted.
- **Managed/enterprise settings.** Different audience, different trust model.
