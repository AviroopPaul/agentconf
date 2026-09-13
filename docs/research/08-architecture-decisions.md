# Architecture decisions

High-level decisions only. Implementation is open.

## Decided

### D1. Two artifacts, not one

| Artifact | What |
|---|---|
| `@<scope>/agent-schemas` | Published JSON pack describing every key for every agent. Versioned, fetchable at runtime. |
| `npx agentconf` | Small Node CLI that scans the filesystem, reads the pack, and serves a React UI on localhost. |

The UI is a **generic renderer over the pack**. It contains no per-key
knowledge. A vendor shipping a new setting on Tuesday means a pack release on
Tuesday, with no app release. See [09-schema-registry.md](09-schema-registry.md).

### D2. Delivery is `npx`, local web server, browser UI

`npx agentconf@latest` is both the install and the update. Node backend for
filesystem access, React frontend on localhost.

### D3. Read-only first, writes later

Ship the inventory view before any write path exists. Zero risk of corrupting a
setup, and it is the screenshot that sells the tool.

### D4. Unify MCP, skills, and instructions. Do not unify permissions or sandbox.

Those three have real cross-agent conventions
([06-cross-agent-conventions.md](06-cross-agent-conventions.md)). Permissions
and sandboxing have incompatible shapes per agent. Render those side by side
and let doctor mode flag divergence. Do not build a merged editor for them.

### D5. Every write shows a diff first, and backs up

Non-negotiable for trust. Power users will only accept a GUI that shows the
exact file content it is about to produce.

### D6. Credentials are never read

Path allowlist, not denylist. Stated prominently in the README. See
[11-constraints-and-risks.md](11-constraints-and-risks.md).

## Rejected, and why

| Option | Why not |
|---|---|
| **Electron / Tauri desktop app** | 100MB+ download, Apple notarization ($99/yr plus signing), self-update machinery to build. Buys nothing: the UI is forms and lists. The audience already lives in a terminal. Revisit only if a `brew install` presence becomes a goal, and then prefer a Bun single-file binary. |
| **TUI (ink / bubbletea)** | Fits the audience, but the premise is *discovering* a ~300-key surface. Search, filtering, diff preview, and side-by-side agent comparison are all materially better in a browser. Also does not demo well, and this tool lives or dies on a screenshot. |
| **Static HTML + File System Access API** | Zero infra, and it is what `mrspot-dev/claude-settings-editor` does. Fatal problems: Chromium-only, re-prompts for permission every session, **handles symlinks badly** (the entire shared-skills layer is symlinks), and cannot shell out for `claude --version`, which is needed to know which keys apply. |
| **VS Code extension** | Decent distribution, but excludes terminal-first, JetBrains, and Zed users. Also awkward: configuring Codex from inside Cursor. Possible later as a thin wrapper around the same server. |
| **Raycast extension** | macOS-only, canvas too small for the key surface. |
| **Fork/extend `amtiYo/agents`** | Genuinely viable alternative: same thesis, active, 94 stars, already does the sync layer, just has no UI. Worth a real look before building the sync layer from scratch. |

## Open for the implementer

- Frontend framework specifics, styling, state management.
- Whether the server is Node or Bun.
- How the pack is hosted (npm package, CDN JSON, GitHub raw, or all three).
- Whether project-level config scanning walks a configured list of roots or
  discovers repos.
- Auth-free localhost binding vs. a token in the opened URL.
- Whether doctor mode ships as a UI panel, a CLI subcommand, or both.
