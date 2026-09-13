# agentconf

A read-only UI over your coding agents' config directories.

`~/.claude`, `~/.codex`, `~/.cursor`, `~/.gemini` and friends expose more than
500 documented settings between them, plus skills, rules, hooks, MCP servers,
plugins and subagents. Almost nobody knows. agentconf scans those directories,
shows every setting you have set and every one you have not, explains each one,
links back to the vendor docs, and runs cross-agent diagnostics.

It is one Go binary. It scans in tens of milliseconds, serves a local web UI,
never writes to your config, and never opens a credential file.

## Install

```sh
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/AviroopPaul/agentconf/main/install.sh | sh

# Go
go install github.com/AviroopPaul/agentconf/app/cmd/agentconf@latest

# Homebrew (after the first tagged release)
brew install AviroopPaul/tap/agentconf
```

Then:

```sh
agentconf            # scan, serve on http://127.0.0.1:4242, open a browser
agentconf doctor     # diagnostics in the terminal
agentconf scan       # the whole inventory as JSON
```

## What it shows

| Page | What you get |
|---|---|
| Overview | Every agent detected, version, home directory, settings set vs. available, skills, MCP, hooks, disk |
| Agent | Settings grouped by category with a one-line summary, optional detail, vendor docs link, and your current value. Files and directories the agent reads, present or not. Skills, MCP, hooks, plugins, rules, trusted projects, usage |
| Explore | All keys across all agents, filterable by set/unset, category, flag (experimental, deprecated, managed-only), searchable |
| Skills | Coverage matrix: which agent can see which skill, resolving symlinks to the shared `~/.agents/skills` tree |
| MCP servers | One list grouped by name, with the agents that can reach each server and whether definitions agree |
| Doctor | Broken symlinks, deprecated keys still set, skills missing from some agents, MCP drift, unknown keys, broken binaries, oversized state |
| Usage | Sessions, prompts, messages, projects, disk footprint, per-model tokens, activity by day and hour |

## Supported agents

| Agent | Directory | Schema pack |
|---|---|---|
| Claude Code | `~/.claude` | 233 keys, 63 paths |
| Codex CLI | `~/.codex` | 159 keys, 31 paths |
| Cursor | `~/.cursor` | 56 keys, 21 paths |
| Gemini CLI | `~/.gemini` | 90 keys, 22 paths |
| opencode, Continue, Factory | detected, skills listed | no pack yet |

Packs live in [`schemas/`](schemas/) and follow [`schemas/SCHEMA.md`](schemas/SCHEMA.md).
The UI knows nothing about individual keys; everything it says about a setting
comes from the pack. Adding an agent is adding a JSON file.

## Read-only by design

- No write endpoints exist. There is nothing to misclick.
- Files are read by allowlist: only paths the schema pack names.
- Paths of kind `credential` (`auth.json`, `oauth_creds.json`, `.credentials.json`) are never opened, not even to check size.
- Values under keys that look like secrets (`headers`, `env`, `token`, `apiKey`) are masked before they reach the UI. MCP env and header values are dropped entirely; only their names are shown.
- The server binds to `127.0.0.1` only. Nothing leaves the machine. No telemetry.
- Transcripts and prompt text are never read. Usage numbers come from counts, timestamps and the agents' own stats files.

## Layout

```
app/
  cmd/agentconf/     CLI entrypoint
  internal/agents/   agent registry, detection, version probes
  internal/schema/   pack loader, key matching
  internal/scan/     filesystem scan, JSON/TOML flattening, MCP and skills
  internal/usage/    activity footprints, single-walk directory sizes
  internal/doctor/   read-only diagnostics
  internal/server/   localhost HTTP server, embedded UI
  web/               React + Vite + Tailwind frontend, embedded at build
schemas/             one JSON pack per agent, plus SCHEMA.md
docs/                user docs and the original research
landing/             marketing site (static) and screenshot script
```

## Build from source

```sh
make          # builds the frontend, then the binary into bin/agentconf
make run
make test
```

Requires Go 1.27+ and Node 20+.

## License

MIT
