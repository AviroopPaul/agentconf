import { ArrowRight, Blocks, HardDrive, Plug, Sparkles, Stethoscope, Webhook } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useInventory } from "../state";
import { AgentTile } from "../components/AgentLogo";
import { Bar, DocLink, Dot, PageHeader, Pill, SectionTitle, Stat } from "../components/ui";
import { bytes, num, pct, tildify } from "../lib/format";
import type { AgentReport, KeyStatus } from "../api";

function pickDiscoveries(agents: AgentReport[], n: number): { k: KeyStatus; a: AgentReport }[] {
  const pool = agents.flatMap((a) => a.keys.filter((k) => !k.set && k.detail && !(k.flags ?? []).some((f) => f === "managedOnly" || f === "deprecated" || f === "removed" || f === "state")).map((k) => ({ k, a })));
  if (pool.length === 0) return [];
  // Deterministic per day so the panel is stable within a session but rotates.
  const day = Math.floor(Date.now() / 86400000);
  const out: { k: KeyStatus; a: AgentReport }[] = [];
  const used = new Set<number>();
  for (let i = 0; out.length < Math.min(n, pool.length) && i < pool.length * 3; i++) {
    const idx = (day * 7919 + i * 104729) % pool.length;
    if (used.has(idx)) continue;
    used.add(idx);
    out.push(pool[idx]);
  }
  return out;
}

export default function Overview() {
  const { data, installed } = useInventory();
  if (!data) return null;

  const withPack = installed.filter((a) => a.hasPack);
  const totalKeys = withPack.reduce((s, a) => s + a.stats.total, 0);
  const setKeys = withPack.reduce((s, a) => s + a.stats.set, 0);
  const disk = installed.reduce((s, a) => s + (a.usage?.diskBytes ?? 0), 0);
  const mcpCount = data.mcp.length;
  const skillCount = data.skills.length;
  const topFindings = data.doctor.filter((f) => f.severity !== "info").slice(0, 5);
  const discoveries = useMemo(() => pickDiscoveries(withPack, 4), [withPack]);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow={data.hostname}
        title="Your coding agents, one view"
        subtitle={
          <>
            {installed.length} agent{installed.length === 1 ? "" : "s"} detected. Between them they expose <span className="mono text-fg-2">{num(totalKeys)}</span> documented settings; you have set{" "}
            <span className="mono text-fg-2">{num(setKeys)}</span>. Everything here is read straight from disk and nothing is ever written back.
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Agents" value={installed.length} sub={`${data.agents.length - installed.length} known, not installed`} />
        <Stat label="Settings surface" value={num(totalKeys)} sub={`across ${withPack.length} schema packs`} />
        <Stat label="Set by you" value={num(setKeys)} sub={`${pct(setKeys, totalKeys)}% of the surface`} />
        <Stat label="Skills" value={skillCount} sub={`${data.skills.filter((s) => s.shared).length} shared across agents`} />
        <Stat label="MCP servers" value={mcpCount} sub={`${data.mcp.filter((g) => g.agents.length > 1).length} defined in more than one agent`} />
        <Stat label="On disk" value={bytes(disk)} sub="config, state and transcripts" />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div>
          <SectionTitle right={<span className="text-xs text-faint">Ordered as detected</span>}>Agents</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {data.agents.map((a) => (
              <AgentCard key={a.id} a={a} home={data.userHome} />
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <SectionTitle right={<Link to="/doctor" className="flex items-center gap-1 text-xs text-accent-2 hover:underline">All findings <ArrowRight size={11} /></Link>}>Doctor</SectionTitle>
            <div className="card divide-y divide-border">
              <div className="flex items-center gap-2 px-4 py-2.5 text-xs">
                <Stethoscope size={13} className="text-muted" />
                {data.doctorSummary.errors > 0 && <Pill tone="err">{data.doctorSummary.errors} errors</Pill>}
                {data.doctorSummary.warns > 0 && <Pill tone="warn">{data.doctorSummary.warns} warnings</Pill>}
                <Pill>{data.doctorSummary.infos} notes</Pill>
              </div>
              {topFindings.length === 0 ? (
                <div className="px-4 py-5 text-center text-xs text-muted">Nothing needs attention. Only informational notes.</div>
              ) : (
                topFindings.map((f) => (
                  <Link key={f.id} to="/doctor" className="row-hover flex items-start gap-2.5 px-4 py-2.5">
                    <span className="mt-1.5">
                      <Dot tone={f.severity === "error" ? "err" : "warn"} />
                    </span>
                    <span className="text-[12.5px] text-fg-2">{f.title}</span>
                  </Link>
                ))
              )}
            </div>
          </div>

          {discoveries.length > 0 && (
            <div>
              <SectionTitle right={<Link to="/explore" className="flex items-center gap-1 text-xs text-accent-2 hover:underline">Explore all <ArrowRight size={11} /></Link>}>Settings you have not touched</SectionTitle>
              <div className="card divide-y divide-border">
                {discoveries.map(({ k, a }) => (
                  <div key={a.id + k.key} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span style={{ color: a.color }}>
                        <Sparkles size={12} />
                      </span>
                      <span className="mono text-[12px] font-medium text-fg">{k.key}</span>
                      <span className="ml-auto text-[10px] text-faint">{a.displayName}</span>
                    </div>
                    <p className="mt-1 text-[12px] text-muted">{k.summary}</p>
                    <div className="mt-1.5">
                      <DocLink href={k.docsUrl}>Read the docs</DocLink>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AgentCard({ a, home }: { a: AgentReport; home: string }) {
  if (!a.installed) {
    return (
      <div className="card flex items-center gap-3 px-4 py-3.5 opacity-60">
        <AgentTile id={a.id} color="#5c6478" size={36} />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium text-fg-2">{a.displayName}</div>
          <div className="mono truncate text-[11px] text-faint">{tildify(a.home, home)} not found</div>
        </div>
        <Pill>not installed</Pill>
      </div>
    );
  }
  const u = a.usage;
  return (
    <Link to={`/agents/${a.id}`} className="card card-hover block px-4 py-3.5">
      <div className="flex items-start gap-3">
        <AgentTile id={a.id} color={a.color} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold">{a.displayName}</span>
            <span className="text-[11px] text-faint">{a.vendor}</span>
            {a.hasPack ? null : <Pill className="ml-auto">no schema pack</Pill>}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11.5px]">
            {a.version ? (
              <span className="mono text-muted">{a.version}</span>
            ) : a.probeError ? (
              <span className="text-warn">binary fails to run</span>
            ) : a.binaryFound ? (
              <span className="text-faint">probing version</span>
            ) : (
              <span className="text-faint">binary not on PATH</span>
            )}
            <span className="text-faint">·</span>
            <span className="mono truncate text-faint">{tildify(a.home, home)}</span>
          </div>
        </div>
      </div>

      {a.hasPack && (
        <div className="mt-3">
          <div className="mb-1 flex items-baseline justify-between text-[11.5px]">
            <span className="text-muted">Settings set</span>
            <span className="mono tabular-nums text-fg-2">
              {a.stats.set} <span className="text-faint">/ {a.stats.total}</span>
            </span>
          </div>
          <Bar value={a.stats.set} max={a.stats.total} color={a.color} />
        </div>
      )}

      <div className="mt-3 grid grid-cols-4 gap-2 text-[11.5px]">
        <Mini icon={<Blocks size={12} />} label="skills" value={a.skills.filter((s) => !s.managed).length} />
        <Mini icon={<Plug size={12} />} label="MCP" value={a.mcp.length} />
        <Mini icon={<Webhook size={12} />} label="hooks" value={a.hooks.reduce((s, h) => s + h.count, 0)} />
        <Mini icon={<HardDrive size={12} />} label="disk" value={u ? bytes(u.diskBytes) : "?"} />
      </div>
    </Link>
  );
}

function Mini({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md bg-bg-1 px-2 py-1.5">
      <span className="text-faint">{icon}</span>
      <span className="mono tabular-nums text-fg-2">{value}</span>
      <span className="text-faint">{label}</span>
    </div>
  );
}
