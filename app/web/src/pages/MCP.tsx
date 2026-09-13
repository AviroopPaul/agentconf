import { KeyRound } from "lucide-react";
import type { MCPGroup, MCPServer } from "../api";
import { AgentLogo } from "../components/AgentLogo";
import { Code, Empty, PageHeader, Pill } from "../components/ui";
import { tildify } from "../lib/format";
import { useInventory } from "../state";

const WHERE: { agent: string; label: string; path: string }[] = [
  { agent: "claude", label: "Claude Code", path: "~/.claude.json (user) and <repo>/.mcp.json (project)" },
  { agent: "codex", label: "Codex CLI", path: "~/.codex/config.toml under [mcp_servers.<id>]" },
  { agent: "cursor", label: "Cursor", path: "~/.cursor/mcp.json and <repo>/.cursor/mcp.json" },
  { agent: "gemini", label: "Gemini CLI", path: "~/.gemini/settings.json under mcpServers" },
];

export default function MCPPage() {
  const { data, installed } = useInventory();
  if (!data) return null;
  const byId = Object.fromEntries(installed.map((a) => [a.id, a]));

  return (
    <div className="fade-in">
      <PageHeader
        title="MCP servers"
        subtitle="MCP is the one tools contract every agent shares, and every agent stores it somewhere different. This is the same server list, grouped by name, so you can see which agents can reach which server and whether the definitions agree."
      />

      {data.mcp.length === 0 ? (
        <Empty title="No MCP servers configured in any agent" hint="Once you add one, it shows up here with the agents that can see it." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2.5 font-medium">Server</th>
                <th className="px-3 py-2.5 font-medium">Transport</th>
                <th className="px-3 py-2.5 font-medium">Target</th>
                <th className="px-3 py-2.5 font-medium">Agents</th>
                <th className="px-3 py-2.5 font-medium">Scope</th>
                <th className="px-3 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.mcp.map((g) => (
                <GroupRow key={g.name} g={g} colors={Object.fromEntries(Object.values(byId).map((a) => [a.id, a.color]))} home={data.userHome} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Where each agent reads MCP config</h3>
        <div className="card divide-y divide-border">
          {WHERE.filter((w) => byId[w.agent]).map((w) => (
            <div key={w.agent} className="flex items-center gap-3 px-3 py-2.5 text-[12.5px]">
              <span style={{ color: byId[w.agent].color }}>
                <AgentLogo id={w.agent} size={14} />
              </span>
              <span className="w-28 text-fg-2">{w.label}</span>
              <span className="mono text-muted">{w.path}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GroupRow({ g, colors, home }: { g: MCPGroup; colors: Record<string, string>; home: string }) {
  const s = g.servers[0];
  const scopes = Array.from(new Set(g.servers.map((x) => x.scope)));
  return (
    <tr className="row-hover border-b border-border align-top last:border-b-0">
      <td className="px-3 py-2.5">
        <div className="mono font-medium text-fg">{g.name}</div>
        {g.servers.length > 1 && <div className="mt-0.5 text-[11px] text-faint">{g.servers.length} definitions</div>}
      </td>
      <td className="px-3 py-2.5">
        <Pill>{s.transport}</Pill>
      </td>
      <td className="px-3 py-2.5">
        <Target s={s} />
        {!g.consistent && (
          <div className="mt-1 space-y-0.5">
            {g.servers.slice(1).map((x, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] text-warn">
                <span style={{ color: colors[x.agent] }}>
                  <AgentLogo id={x.agent} size={11} />
                </span>
                <Target s={x} small />
              </div>
            ))}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          {g.agents.map((id) => (
            <span key={id} style={{ color: colors[id] ?? "#888" }} title={id}>
              <AgentLogo id={id} size={14} />
            </span>
          ))}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          {scopes.map((sc) => (
            <Pill key={sc}>{sc}</Pill>
          ))}
        </div>
        {g.servers.some((x) => x.project) && (
          <div className="mono mt-1 max-w-[220px] truncate text-[10.5px] text-faint" title={g.servers.filter((x) => x.project).map((x) => x.project).join("\n")}>
            {Array.from(new Set(g.servers.filter((x) => x.project).map((x) => tildify(x.project!, home)))).join(", ")}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        {g.agents.length > 1 ? g.consistent ? <Pill tone="ok">consistent</Pill> : <Pill tone="warn">differs</Pill> : <Pill>one agent</Pill>}
      </td>
    </tr>
  );
}

function Target({ s, small = false }: { s: MCPServer; small?: boolean }) {
  const cls = small ? "text-[11px]" : "text-[12px]";
  return (
    <div className={`mono flex flex-wrap items-center gap-1.5 ${cls} text-fg-2`}>
      {s.url ? <span className="truncate">{s.url}</span> : <span className="truncate">{[s.command, ...(s.args ?? [])].join(" ")}</span>}
      {(s.hasHeaders || (s.envKeys?.length ?? 0) > 0) && (
        <span className="inline-flex items-center gap-1 text-faint" title={s.envKeys?.length ? `env: ${s.envKeys.join(", ")}` : "has headers"}>
          <KeyRound size={10} /> {s.hasHeaders ? "headers" : ""} {s.envKeys?.length ? `${s.envKeys.length} env` : ""}
        </span>
      )}
      {s.disabled && <Pill className="!py-0 !text-[10px]">disabled</Pill>}
    </div>
  );
}

/** Per-agent table used on the agent page. */
export function MCPTable({ servers, home }: { servers: MCPServer[]; home: string }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-left text-[12.5px]">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted">
            <th className="px-3 py-2.5 font-medium">Server</th>
            <th className="px-3 py-2.5 font-medium">Transport</th>
            <th className="px-3 py-2.5 font-medium">Target</th>
            <th className="px-3 py-2.5 font-medium">Scope</th>
            <th className="px-3 py-2.5 font-medium">Defined in</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((s, i) => (
            <tr key={s.source + s.name + i} className="row-hover border-b border-border last:border-b-0">
              <td className="mono px-3 py-2.5 font-medium text-fg">{s.name}</td>
              <td className="px-3 py-2.5">
                <Pill>{s.transport}</Pill>
              </td>
              <td className="px-3 py-2.5">
                <Target s={s} />
              </td>
              <td className="px-3 py-2.5">
                <Pill>{s.scope}</Pill>
                {s.project && (
                  <div className="mono mt-1 max-w-[200px] truncate text-[10.5px] text-faint" title={s.project}>
                    {tildify(s.project, home)}
                  </div>
                )}
              </td>
              <td className="px-3 py-2.5">
                <Code className="!text-[11px]">{tildify(s.source, home)}</Code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-3 py-2 text-[11px] text-faint">Environment variable and header values are never read. Only their names or presence are shown.</p>
    </div>
  );
}
