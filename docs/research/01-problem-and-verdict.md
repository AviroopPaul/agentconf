# Problem and verdict

## The problem

Coding agents keep their configuration in dotfolders (`~/.claude`,
`~/.codex`, `~/.cursor`, and others). Between them they expose roughly **300
documented configuration keys**, plus directory-based extension points for
skills, rules, subagents, hooks, commands, output styles, plugins, themes, and
keybindings.

Three things are true at once:

1. **The surface is enormous.** Claude Code alone has ~192 settings keys.
2. **Adoption is tiny.** On the reference machine (an active user, seven agents
   installed), `~/.claude/settings.json` sets 14 of 192 keys, and
   `~/.codex/config.toml` sets about 5 real keys across 58 lines, 45 of which
   are auto-generated `trust_level` entries.
3. **It changes constantly.** Vendors ship new keys and experimental flags
   continuously. Any tool with a hardcoded schema rots within months. See
   [07-prior-art.md](07-prior-art.md) for a 262-star example that died this way.

The gap is not "I cannot edit JSON." It is **"I do not know these settings
exist."** That distinction determines the product.

## The verdict

Build an **`npx`-launched local web app** backed by an **auto-updating schema
registry**.

The UI is a generic renderer. The registry describes every key for every agent
and refreshes from vendor docs on a schedule. When a vendor ships a new setting,
it appears in the UI without an app release.

**Position it as discovery and safety, not as a replacement editor.** Power
users prefer their editor for writing config. They cannot use their editor to
find 280 settings they have never heard of, or to detect that the same MCP
server is configured three different ways across three agents.

## Who it is for

Developers running two or more coding agents. That is an increasingly normal
setup, and it is exactly the population that hand-maintains symlink farms to
keep skills in sync (see [06-cross-agent-conventions.md](06-cross-agent-conventions.md)).

## The honest risk

For a single-agent user this is a vitamin. The painkiller is **doctor mode**:
cross-agent drift detection, conflicting MCP definitions, stale plugin pins,
skills present in one agent and missing from another. Lead with discovery and
doctor mode. Form editing is the third feature, not the first.
