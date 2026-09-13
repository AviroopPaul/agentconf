# Getting started

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/AviroopPaul/agentconf/main/install.sh | sh
```

Or with Go:

```sh
go install github.com/AviroopPaul/agentconf/app/cmd/agentconf@latest
```

The binary is self-contained. The web UI is embedded; there is nothing else to
install and no runtime dependency.

## Run

```sh
agentconf
```

Scans your agent directories, starts a server on `http://127.0.0.1:4242`, and
opens your browser. The first response is a fast scan; directory sizes and
agent versions fill in a moment later.

Flags:

| Flag | Default | What |
|---|---|---|
| `--port N` | `4242` | Port to listen on. `0` picks a free one. |
| `--no-open` | off | Do not open a browser. |

## Other commands

```sh
agentconf doctor          # diagnostics in the terminal, exit 1 on errors
agentconf scan            # full inventory as JSON on stdout
agentconf scan --pretty   # indented
agentconf scan --no-usage # skip directory walks (faster)
agentconf version
```

`scan` is useful for piping into `jq` or for a snapshot you can diff later:

```sh
agentconf scan | jq '.inventory.agents[] | {id, set: .stats.set, total: .stats.total}'
```

## Environment

agentconf respects the same overrides the agents do:

| Variable | Agent |
|---|---|
| `CLAUDE_CONFIG_DIR` | Claude Code |
| `CODEX_HOME` | Codex CLI |
| `CURSOR_CONFIG_DIR` | Cursor |
| `XDG_CONFIG_HOME` | opencode |

## What it never does

- Write to any file under an agent directory.
- Open credential files (`auth.json`, `oauth_creds.json`, `.credentials.json`, daemon keys).
- Read transcript or prompt text. Usage numbers come from counts, timestamps and the agents' own stats files.
- Listen on anything but `127.0.0.1`.
- Send anything anywhere. There is no telemetry.
