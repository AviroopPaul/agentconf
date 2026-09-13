# Codex CLI (`.codex`)

Source of truth: <https://learn.chatgpt.com/docs/config-file/config-reference>
(the `openai/codex` repo docs are stubs that redirect here).

**~75 top-level `config.toml` keys and ~35 TOML table sections.**

Format is **TOML**, not JSON. This is the main format divergence in the whole
project and it drives the write strategy (see
[11-constraints-and-risks.md](11-constraints-and-risks.md)).

## Directory layout

| Path | Purpose | Type |
|---|---|---|
| `~/.codex/config.toml` | Primary user config | config |
| `~/.codex/<profile>.config.toml` | Profile-specific override | config |
| `~/.codex/hooks.json` | Lifecycle hooks (alternative to inline `[hooks]`) | config |
| `~/.codex/AGENTS.md` | Global agent instructions | config |
| `~/.codex/rules/` | Rule files | config |
| `~/.codex/skills/` | Skills, `SKILL.md` per directory | config |
| `~/.codex/skills/.system/` | Bundled system skills | vendor |
| `~/.codex/plugins/` | Installed plugins plus `cache/` | mixed |
| `~/.codex/memories/` | Agent-written memory | agent-written |
| `~/.codex/vendor_imports/skills/` | Imported vendor skills | vendor |
| `.codex/config.toml` (project) | Project-scoped config, only if trusted | config |
| `AGENTS.md` (repo root) | Project instructions | config |

### Machine state (exclude)

`sessions/`, `log/`, `logs_2.sqlite*`, `state_5.sqlite*`, `sqlite/`,
`shell_snapshots/`, `cache/`, `tmp/`, `.tmp/`, `history.jsonl`,
`session_index.jsonl`, `models_cache.json`, `installation_id`,
`version.json`, `.codex-global-state.json`, `.personality_migration`

### Credentials (never read)

`~/.codex/auth.json`

## Important structural quirks

- **`projects.<path>.trust_level` pollutes the file.** On the reference machine
  45 of 58 lines were auto-generated trust entries. The UI must collapse these
  into a single manageable "trusted projects" list, not render 45 rows.
- **Project configs cannot override certain user-level keys.** Provider, auth,
  notifications, profiles, telemetry, and some security keys stay user-level
  only. The precedence model must encode this exception list.
- **`[notice]` and `[tui.model_availability_nux]` are state, not config.** They
  track acknowledgments and NUX counters. They live in `config.toml` alongside
  real settings. Classify per-key, not per-file.
- **Hooks have two homes**: inline `[hooks]` in `config.toml`, or `hooks.json`.
- **`requirements.toml`** is a separate admin file. `allow_managed_hooks_only`
  works only there, not in `config.toml`.

## Top-level keys

`agents` `allow_login_shell` `analytics.enabled` `approval_policy`
`approvals_reviewer` `apps.*` `auto_review.policy`
`background_terminal_max_timeout` `browser_use.*` `chatgpt_base_url`
`check_for_update_on_startup` `cli_auth_credentials_store` `compact_prompt`
`computer_use.*` `default_permissions` `desktop.custom_file_handlers.*`
`developer_instructions` `disable_paste_burst`
`experimental_compact_prompt_file` `features.*` `feedback.enabled`
`file_opener` `forced_chatgpt_workspace_id` `forced_login_method`
`hide_agent_reasoning` `history.*` `hooks` `instructions` (reserved) `log_dir`
`marketplaces.*` `mcp_oauth_*` `mcp_servers.*` `memories.*` `model`
`model_auto_compact_token_limit` `model_auto_compact_token_limit_scope`
`model_catalog_json` `model_context_window` `model_instructions_file`
`model_provider` `model_providers.*` `model_reasoning_effort`
`model_reasoning_summary` `model_supports_reasoning_summaries`
`model_verbosity` `notice.*` `notify` `openai_base_url` `oss_provider` `otel.*`
`permissions.*` `personality` `plan_mode_reasoning_effort` `plugins.*`
`project_doc_fallback_filenames` `project_doc_max_bytes` `project_root_markers`
`projects.<path>.trust_level` `review_model` `sandbox_mode`
`sandbox_workspace_write.*` `service_tier` `shell_environment_policy.*`
`show_raw_agent_reasoning` `skills.config` `skills.max_context_tokens`
`sqlite_home` `suppress_unstable_features_warning` `tool_output_token_limit`
`tool_suggest.*` `tools.view_image` `tools.web_search` `tui.*` `web_search`
`windows.*` `windows_wsl_setup_acknowledged`

## Table sections

`[agents]` `[agents.<name>]` `[analytics]` `[apps._default]` `[apps.<id>]`
`[auto_review]` `[browser_use]` `[computer_use.macos]` `[computer_use.windows]`
`[desktop]` `[feedback]` `[features]` `[history]` `[hooks]` `[memories]`
`[mcp_servers.<id>]` `[mcp_servers.<id>.oauth]`
`[mcp_servers.<id>.tools.<tool>]` `[model_providers.<id>]`
`[model_providers.<id>.auth]` `[model_providers.<id>.oauth]` `[notice]`
`[otel]` `[otel.exporter.<id>]` `[otel.trace_exporter.<id>]`
`[permissions.<name>]` `[permissions.<name>.filesystem]`
`[permissions.<name>.network]` `[permissions.<name>.workspace_roots]`
`[plugins.<plugin>]` `[projects.<path>]` `[sandbox_workspace_write]`
`[shell_environment_policy]` `[tools]` `[tui]`

## Cross-agent mapping hints

| Concept | Codex | Claude Code |
|---|---|---|
| MCP servers | `[mcp_servers.<id>]` (TOML) | `.mcp.json` / `managedMcpServers` (JSON) |
| Sandbox | `sandbox_mode`, `[sandbox_workspace_write]` | `sandbox.*` (38 keys) |
| Named permission profiles | `[permissions.<name>]` | `permissions.allow/ask/deny` (no profiles) |
| Project instructions | `AGENTS.md` | `CLAUDE.md` |
| Reasoning effort | `model_reasoning_effort` | `effortLevel` / `maxEffortLevel` |
| Skills | `~/.codex/skills/` | `~/.claude/skills/` |

Note the shape mismatch on permissions: Codex has **named reusable profiles**,
Claude has **flat allow/ask/deny lists**. A naive unified permissions editor
will not work. Model them separately and only unify MCP.
