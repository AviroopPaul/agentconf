# Constraints and risks

The four things that will actually bite, plus the product risk.

## 1. Credentials live in these folders

Confirmed on the reference machine:

```
~/.codex/auth.json
~/.gemini/oauth_creds.json
~/.gemini/google_accounts.json
~/.gemini/mcp-oauth-tokens.json
~/.claude/.credentials.json
~/.claude/daemon/control.key
~/.claude/daemon/auth/
```

Plus secrets embedded inside legitimate config: MCP `headers` in
`~/.cursor/mcp.json` and equivalents, and `env` blocks on stdio MCP servers.

**Rules:**
- Path **allowlist**, never a denylist. Read only what the schema pack names.
- Never read credential files at all, not even to check existence in a way that
  could log contents.
- Mask `sensitive` values in the UI and never send them anywhere.
- Nothing leaves the machine. State that prominently in the README.

One "this tool read my tokens" thread ends the project. This is the highest
severity risk in the list.

## 2. Format-preserving writes

Three formats, all hand-edited by users:

| Agent | Format | Hazard |
|---|---|---|
| Claude | JSON / JSONC | Users hand-edit and add comments |
| Codex | **TOML** | Comments and ordering, and a 45-line auto-generated `projects` block |
| Cursor | JSON, four files | Some fields are CLI-managed and get overwritten |

**Never parse-and-reserialize.** Use surgical edit APIs that preserve
everything not being changed: `jsonc-parser`'s edit API for JSON/JSONC, and a
comment-preserving TOML editor for Codex (`@iarna/toml` loses comments, so it is
not suitable). Verify whichever TOML library is chosen actually round-trips
comments and ordering before committing to it.

**Always:**
- Back up before every write.
- Show the exact diff before applying.
- Write atomically (temp file plus rename), because agents may be running and
  reading the file concurrently.

## 3. Machine state vs. config

More than half of what lives in these directories is generated. Full exclusion
lists are in [02-claude-code.md](02-claude-code.md), [03-codex.md](03-codex.md),
[04-cursor.md](04-cursor.md), and [05-other-agents.md](05-other-agents.md).

Two traps:
- **State hides inside config files.** Codex `[notice]` and
  `[tui.model_availability_nux]` sit in `config.toml` next to real settings.
  Classification has to be **per key**, not per file.
- **Some directories are vendor-managed.** `~/.cursor/skills-cursor/` has its
  own sync manifest. `~/.codex/skills/.system/`. Users must not edit these.

Without per-path and per-key classification, the UI becomes noise.

## 4. Precedence is the hard engineering

- **Claude Code: 5 layers**, and **list-valued keys merge rather than override**.
  There are documented exceptions to managed-settings precedence.
- **Codex:** project configs **cannot** override provider, auth, notifications,
  profiles, telemetry, or certain security keys, regardless of layering.
- **Cursor:** only `permissions` is settable per project. Everything else is
  global.

Rendering **effective value plus its source layer** correctly is the most
valuable thing the UI does, and the most likely thing to get subtly wrong. It
is also not something a text editor can do at all, which makes it a real
differentiator.

Build a precedence resolver as a standalone, heavily tested module. Model
merge-vs-override per key in the schema pack.

## 5. Product risk: vitamin vs. painkiller

For a single-agent user this is a nice-to-have, and power users prefer their
editor for writing config. Config GUIs have a known history of being built,
starred, and abandoned ([07-prior-art.md](07-prior-art.md)).

**Mitigation:** lead with the two things an editor cannot do.

1. **Discovery.** "Here are 280 settings you have never set, and what they do."
2. **Doctor mode.** Cross-agent drift, duplicate MCP definitions, skill coverage
   gaps, broken symlinks, deprecated keys.

Treat form editing as the third feature. If the tool is framed as "a nicer way
to edit settings.json," it becomes the 33-star outcome.

## 6. Verify before relying on it

- **Claude Code AGENTS.md support.** Sources conflict on whether native reading
  shipped. Issue #6235 was closed as completed 2026-08-17, but reporting from
  late August 2026 says the changelog does not mention AGENTS.md and the file is
  not loaded ambiently. Test current behavior directly.
- **All key lists in this research are a 2026-09-14 snapshot.** They are the
  seed for the schema pack, not a permanent source of truth. The pipeline in
  [09-schema-registry.md](09-schema-registry.md) replaces them.
