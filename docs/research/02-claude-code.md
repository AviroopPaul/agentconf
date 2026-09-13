# Claude Code (`.claude`)

Source of truth: <https://code.claude.com/docs/en/settings-reference>,
<https://code.claude.com/docs/en/claude-directory>,
index at <https://code.claude.com/docs/llms.txt>

**~192 documented `settings.json` keys across 18 categories.**

## Settings precedence (5 layers, highest first)

| # | Layer | File | Set by |
|---|---|---|---|
| 1 | Managed | `managed-settings.json`, MDM, or claude.ai console | Organization |
| 2 | Command line | `claude --settings` | You, this session |
| 3 | Project local | `.claude/settings.local.json` | You, this project |
| 4 | Shared project | `.claude/settings.json` | Everyone in the project |
| 5 | User | `~/.claude/settings.json` | You, every project |

**List-valued keys merge across layers rather than overriding.** This is the
single most important precedence rule to model correctly. There are documented
exceptions to managed-settings precedence.

## Directory layout

### Project

| Path | Purpose | Git status |
|---|---|---|
| `CLAUDE.md` | Project instructions, loaded every session | committed |
| `.mcp.json` | Project-scoped MCP servers (note: **repo root, not `.claude/`**) | committed |
| `.worktreeinclude` | Gitignored files to copy into new worktrees | committed |
| `.claude/settings.json` | Permissions, hooks, config | committed |
| `.claude/settings.local.json` | Personal overrides for this project | gitignored |
| `.claude/rules/*.md` | Topic-scoped instructions, optionally path-gated | committed |
| `.claude/skills/<name>/SKILL.md` | Invokable skills, can bundle supporting files | committed |
| `.claude/commands/*.md` | Single-file commands (legacy; skills supersede) | committed |
| `.claude/output-styles/*.md` | Project-scoped output styles | committed |
| `.claude/agents/*.md` | Subagents with their own context window | committed |
| `.claude/workflows/*` | Dynamic workflow scripts orchestrating subagents | committed |
| `.claude/agent-memory/<agent>/MEMORY.md` | Per-subagent persistent memory | committed |

### User (`~`)

| Path | Purpose | Type |
|---|---|---|
| `~/.claude.json` | App state and UI preferences | state |
| `~/.claude/CLAUDE.md` | Personal preferences, every project | config |
| `~/.claude/settings.json` | Default settings, all projects | config |
| `~/.claude/keybindings.json` | Custom keyboard shortcuts | config |
| `~/.claude/themes/` | Custom color themes | config |
| `~/.claude/rules/` | User-level rules, every project | config |
| `~/.claude/skills/` | Personal skills | config |
| `~/.claude/commands/` | Personal single-file commands | config |
| `~/.claude/output-styles/*.md` | Custom instruction sets | config |
| `~/.claude/agents/` | Personal subagents | config |
| `~/.claude/workflows/` | Personal dynamic workflows | config |
| `~/.claude/agent-memory/` | Subagent memory | agent-written |
| `~/.claude/projects/<project>/memory/MEMORY.md` | Auto memory, Claude maintains | agent-written |
| `~/.claude/plugins/` | `installed_plugins.json`, `known_marketplaces.json`, `blocklist.json`, `marketplaces/`, `cache/`, `data/` | mixed |

### Machine state (exclude from the config UI)

`sessions/`, `projects/` (transcripts), `shell-snapshots/`, `file-history/`,
`paste-cache/`, `cache/`, `jobs/`, `backups/`, `downloads/`, `session-env/`,
`daemon*`, `history.jsonl`, `stats-cache.json`, `policy-limits.json`,
`gh-pr-status-cache.json`, `*-cache.json`, `.last-*`

### Credentials (never read, see [11-constraints-and-risks.md](11-constraints-and-risks.md))

`~/.claude/.credentials.json`, `~/.claude/daemon/control.key`,
`~/.claude/daemon/auth/`

## Full settings key surface

Counts per category are exact as of 2026-09-14.

### Model and responses (18)
`advisorModel` `alwaysThinkingEnabled` `availableModels` `effortLevel`
`enforceAvailableModels` `fallbackModel` `fastMode` `fastModePerSessionOptIn`
`language` `maxEffortLevel` `model` `modelOverrides` `modelPicker`
`modelPricing` `modelSettings` `outputStyle` `promptCacheTtl`
`showThinkingSummaries`

### Permissions (13)
`autoMode` `autoMode.classifyAllShell` `disableAutoMode` `permissions`
`permissions.additionalDirectories` `permissions.allow` `permissions.ask`
`permissions.blockReadsOutsideWorkingDirectories` `permissions.defaultMode`
`permissions.deny` `permissions.disableBypassPermissionsMode`
`skipAutoPermissionPrompt` `skipDangerousModePermissionPrompt`

### Memory and context (12)
`autoCompactEnabled` `autoCompactWindow` `autoMemoryDirectory`
`autoMemoryEnabled` `bashOutputMaxChars` `claudeMd` `claudeMdExcludes` `env`
`fileCheckpointingEnabled` `plansDirectory` `skillListingBudgetFraction`
`skillListingMaxDescChars`

### Plugins and skills (16)
`allowedChannelPlugins` `blockedMarketplaces` `channelsEnabled`
`disableBundledSkills` `disableCommandPluginSources` `disableSkillShellExecution`
`enabledPlugins` `extraKnownMarketplaces` `pluginConfigs`
`pluginSuggestionMarketplaces` `pluginTrustMessage` `skillOverrides`
`strictKnownMarketplaces` `strictPluginOnlyCustomization`
`strictPluginOnlyCustomization.agents` `strictPluginOnlyCustomization.hooks`

### MCP (9)
`allowAllClaudeAiMcps` `allowedMcpServers` `allowManagedMcpServersOnly`
`deniedMcpServers` `disableClaudeAiConnectors` `disabledMcpjsonServers`
`enableAllProjectMcpServers` `enabledMcpjsonServers` `managedMcpServers`

### Hooks and automation (7)
`allowedHttpHookUrls` `allowManagedHooksOnly` `disableAllHooks`
`disableWorkflows` `enableWorkflows` `hooks` `httpHookAllowedEnvVars`

### Interface and terminal (19)
`askUserQuestionTimeout` `autoContinueAtUsageLimit` `autoScrollEnabled`
`axScreenReader` `defaultShell` `editorMode` `emojiCompletionEnabled`
`fileSuggestion` `footerLinksRegexes` `prefersReducedMotion`
`promptSuggestionEnabled` `respectGitignore` `respondToBashCommands`
`showClearContextOnPlanAccept` `showTurnDuration` `spinnerTipsEnabled`
`spinnerTipsOverride` `spinnerVerbs` `statusLine`

### Git and attribution (7)
`attribution` `attribution.commit` `attribution.pr` `attribution.sessionUrl`
`includeCoAuthoredBy` (deprecated) `includeGitInstructions` `prUrlTemplate`

### Authentication and providers (8)
`apiKeyHelper` `awsAuthRefresh` `awsCredentialExport` `forceLoginGatewayUrl`
`forceLoginMethod` `forceLoginOrgUUID` `gcpAuthRefresh` `otelHeadersHelper`

### Remote, desktop, notifications (11)
`agentPushNotifEnabled` `awaySummaryEnabled` `disableDeepLinkRegistration`
`disableDesktopLocalSessions` `disableRemoteControl` `inputNeededNotifEnabled`
`preferredNotifChannel` `remote.defaultEnvironmentId` `remoteControlAtStartup`
`sshConfigs` `sshHostAllowlist`

### Tools (3)
`browserExternalPageTools` `disableBrowserExternalNavigation`
`disableMobileSimulatorTools`

### Sandbox (38, the largest category)
`sandbox` `sandbox.allowAppleEvents` `sandbox.allowUnsandboxedCommands`
`sandbox.autoAllowBashIfSandboxed` `sandbox.bwrapPath` `sandbox.credentials`
`sandbox.credentials.allowPlaintextInject` `sandbox.credentials.awsPairs`
`sandbox.credentials.envVars` `sandbox.credentials.files`
`sandbox.credentials.sigv4` `sandbox.enabled`
`sandbox.enableWeakerNestedSandbox` `sandbox.enableWeakerNetworkIsolation`
`sandbox.excludedCommands` `sandbox.failIfUnavailable` `sandbox.filesystem`
`sandbox.filesystem.allowManagedReadPathsOnly` `sandbox.filesystem.allowRead`
`sandbox.filesystem.allowWrite` `sandbox.filesystem.denyRead`
`sandbox.filesystem.denyWrite` `sandbox.filesystem.disabled`
`sandbox.ignoreViolations` `sandbox.network` `sandbox.network.allowAllUnixSockets`
`sandbox.network.allowedDomains` `sandbox.network.allowLocalBinding`
`sandbox.network.allowMachLookup` `sandbox.network.allowManagedDomainsOnly`
`sandbox.network.allowUnixSockets` `sandbox.network.deniedDomains`
`sandbox.network.httpProxyPort` `sandbox.network.socksProxyPort`
`sandbox.network.strictAllowlist` `sandbox.network.tlsTerminate`
`sandbox.ripgrep` `sandbox.socatPath`

### Agents, sessions, worktrees (5)
`agent` `crossSessionInbound` `disableAgentView` `isolatePeerMachines`
`processWrapper`

### Enterprise and managed (8)
`allowManagedPermissionRulesOnly` `forceRemoteSettingsRefresh`
`managedSourcesBehavior` `parentSettingsBehavior` `policyHelper`
`policyHelper.path` `policyHelper.refreshIntervalMs` `policyHelper.timeoutMs`

### Updates and versioning (4)
`autoUpdatesChannel` `minimumVersion` `requiredMaximumVersion`
`requiredMinimumVersion`

### Privacy and telemetry (5)
`cleanupPeriodDays` `desktopSessionCleanupPeriodDays` `feedbackDrafts`
`feedbackSurveyRate` `skipWebFetchPreflight`

### Global config (6)
`autoConnectIde` `autoInstallIdeExtension` `copyOnSelect` `diffTool`
`externalEditorContext` `permissionExplainerEnabled` (removed in v2.1.257)

### Deprecated (3)
`disableArtifact` `includeCoAuthoredBy` `keybindingFlavor`

## Notes for the schema pack

- Many keys are **managed-only** (enterprise). Tag them so the UI can hide or
  grey them for individual users. Examples: `allowManagedHooksOnly`,
  `strictKnownMarketplaces`, `requiredMinimumVersion`, `policyHelper.*`.
- `permissionExplainerEnabled` was **removed** in v2.1.257. The pack needs a
  `removedIn` field, not just `addedIn`.
- `CLAUDE_CONFIG_DIR` relocates the whole directory. Respect it during scanning.
- Commands and skills are now the same mechanism; `commands/` is legacy.

## Docs pages worth scraping

`settings-reference`, `settings`, `settings-example`, `model-config`,
`claude-directory`, `memory`, `hooks`, `hooks-guide`, `skills`, `sub-agents`,
`plugins-reference`, `mcp`, `managed-mcp`, `output-styles`, `statusline`,
`keybindings`, `permissions`, `permission-modes`, `sandboxing`,
`sandbox-environments`, `terminal-config`
