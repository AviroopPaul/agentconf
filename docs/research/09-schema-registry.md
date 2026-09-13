# Schema registry

**This is the product.** The UI is a renderer. If the registry stops updating,
the tool dies, exactly as `claude-config-editor` did (262 stars, dead since
October 2025).

## What a key entry needs to carry

A normalized shape across all agents. Fields, with why each exists:

| Field | Why |
|---|---|
| `agent` | `claude` / `codex` / `cursor` / `gemini` / `opencode` |
| `key` | Dotted path, e.g. `sandbox.network.tlsTerminate` |
| `file` | Which file it lives in. Cursor splits across four. |
| `format` | `json` / `jsonc` / `toml` / `markdown`. Drives the write strategy. |
| `type` | `boolean` / `string` / `number` / `array` / `object` / `enum` |
| `enumValues` | For enums, so the UI renders a select, not a text box |
| `default` | Needed to show "unset vs. set to default" |
| `scopes` | Which precedence layers accept it. Codex forbids some keys at project level; Cursor allows only `permissions` per project. |
| `category` | Grouping for the UI |
| `description` | One line |
| `docsUrl` | Deep link, so the UI never has to explain in full |
| `addedIn` / `removedIn` | Version gating. `permissionExplainerEnabled` was removed in Claude v2.1.257. |
| `experimental` | Several agents have preview flags |
| `managedOnly` | Enterprise-only keys, hide or grey for individuals |
| `volatile` | Agent overwrites this; warn before writing. Some Cursor `cli-config.json` fields behave this way. |
| `sensitive` | Mask in UI, e.g. MCP `headers` |
| `stateNotConfig` | Lives in a config file but is really state, e.g. Codex `[notice]`, `[tui.model_availability_nux]` |
| `crossAgentConcept` | Optional link to a shared concept id, e.g. `mcp.servers`, `skills.dir`, `instructions.file`. This is what powers doctor mode and side-by-side comparison. |

A separate, smaller registry describes **directory-based extension points**
(skills, rules, agents, commands, hooks, output-styles, themes, workflows,
plugins): path, per-agent, file convention, and whether it is user-editable,
vendor-managed, or agent-written.

## Keeping it current

Every vendor publishes a structured reference. This is scrapeable.

| Agent | Source |
|---|---|
| Claude Code | `code.claude.com/docs/en/settings-reference` (clean tables), index at `code.claude.com/docs/llms.txt` |
| Codex | `learn.chatgpt.com/docs/config-file/config-reference` (the `openai/codex` repo docs are stubs that redirect here) |
| Cursor | `cursor.com/docs/cli/reference/configuration`, `/docs/hooks`, `/docs/reference/plugins` |
| Gemini CLI | Google's Gemini CLI docs and repo |

### The pipeline

1. Scheduled job (daily) fetches each reference page.
2. Normalize into the pack shape. An LLM pass is the practical way to do this;
   the pages are prose and tables, not machine-readable schemas.
3. Diff against the previous snapshot.
4. On any change, open a PR with the diff.
5. Human reviews and merges. Publish a new pack version.

**Do not auto-publish without review.** A bad scrape that drops half the keys
would silently gut the UI.

### Fallbacks

- Bundle a copy of the pack with the CLI so it works offline and on first run.
- Fetch the latest pack at startup, cache it, fall back to the bundled copy.
- Show the pack version and its date in the UI. Users should be able to tell
  when their view of the world is stale.

### Validation

Round-trip test: for each agent, generate a config from the pack containing
every key at its default, and confirm the agent parses it. Catches type errors
and bad enum values that a docs scrape will inevitably introduce.

## The changelog is a second product

The diff feed is genuinely useful on its own. "What changed in coding-agent
config this week" is not published anywhere today. Ship it as an RSS feed and a
page. It markets the tool for free and gives people a reason to return between
config sessions.
