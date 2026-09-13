# Schema packs

A pack is one JSON file per agent in `schemas/`. The format is specified in
[`schemas/SCHEMA.md`](../schemas/SCHEMA.md). This page is about how they are
maintained.

## Current packs

| Pack | Keys | Paths | Source |
|---|---|---|---|
| `claude.json` | 233 | 63 | code.claude.com/docs/en/settings-reference, claude-directory |
| `codex.json` | 159 | 31 | learn.chatgpt.com/docs/config-file/config-reference |
| `cursor.json` | 56 | 21 | cursor.com/docs/cli/reference/configuration, hooks, plugins |
| `gemini.json` | 90 | 22 | geminicli.com/docs/reference/configuration |

All packs are stamped `packVersion: 2026.09.14`.

## Adding an agent

1. Add the agent to `app/internal/agents/agents.go` (id, display name, vendor, home dir, env override, binary names, brand colour).
2. Create `schemas/<id>.json` following `SCHEMA.md`. Start with `paths[]`: settings file, instructions file, skills dir, state dirs, credentials. Then `keys[]`.
3. `make build`. The pack is embedded automatically.
4. Check `agentconf scan | jq '.inventory.agents[] | select(.id=="<id>")'` for unknown keys: those are keys the pack is missing.

## Keeping packs current

The intended pipeline (not yet automated):

1. A scheduled job fetches each vendor's reference page.
2. Normalises into the pack shape (an LLM pass is the practical approach; the pages are prose and tables).
3. Diffs against the previous snapshot and opens a PR with the changes.
4. A human reviews and merges. Never auto-publish: a bad scrape that drops half the keys would silently gut the UI.

Until then, the `unknown-keys` doctor check is the drift detector: if a user
has a key set that the pack does not know, the pack is behind.

## Conventions worth keeping

- `summary` under 120 characters, plain voice, no marketing.
- `detail` only where the summary is not self-explanatory. Roughly 40 percent of keys.
- `docsUrl` as deep as the vendor page allows. Verify anchors; several vendor pages only have section anchors.
- Wildcards as `<id>`, `<name>`, `<path>` literally.
- Flag `state` for things that live in a config file but are machine state (Codex `[notice]`).
- Flag `volatile` for things the agent overwrites (Codex `projects.<path>.trust_level`).
- No em-dashes anywhere.
