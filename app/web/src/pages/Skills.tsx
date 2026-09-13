import { Check, Link2, Minus, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { SkillGroup } from "../api";
import { AgentLogo } from "../components/AgentLogo";
import { Empty, PageHeader, SearchInput, Segmented } from "../components/ui";
import { tildify } from "../lib/format";
import { useInventory } from "../state";

type Filter = "all" | "shared" | "partial" | "single";

export default function SkillsPage() {
  const { data, installed } = useInventory();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  if (!data) return null;

  const capableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of data.skills) for (const id of Object.keys(g.agents)) ids.add(id);
    return installed.filter((a) => ids.has(a.id));
  }, [data.skills, installed]);

  const rows = data.skills.filter((g) => {
    if (q && !g.name.toLowerCase().includes(q.toLowerCase()) && !(g.description ?? "").toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === "shared") return g.present === g.capable && g.capable > 1;
    if (filter === "partial") return g.present > 1 && g.present < g.capable;
    if (filter === "single") return g.present === 1;
    return true;
  });

  const counts = {
    all: data.skills.length,
    shared: data.skills.filter((g) => g.present === g.capable && g.capable > 1).length,
    partial: data.skills.filter((g) => g.present > 1 && g.present < g.capable).length,
    single: data.skills.filter((g) => g.present === 1).length,
  };

  return (
    <div className="fade-in">
      <PageHeader
        title="Skills across agents"
        subtitle={
          <>
            SKILL.md folders have become a cross-vendor convention: Cursor, Codex and Claude Code all read them, and most people share one tree (usually <span className="mono text-fg-2">~/.agents/skills</span>) with symlinks. This matrix shows which agent can actually see which skill. Grouping is by the resolved real path, so a symlink and its target count as the same skill.
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search skills" className="w-64" />
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "shared", label: "Everywhere", count: counts.shared },
            { value: "partial", label: "Partial", count: counts.partial },
            { value: "single", label: "One agent", count: counts.single },
          ]}
        />
        <div className="ml-auto flex items-center gap-3 text-[11px] text-muted">
          <span className="flex items-center gap-1"><Link2 size={11} className="text-ok" /> symlink</span>
          <span className="flex items-center gap-1"><Check size={11} className="text-ok" /> local copy</span>
          <span className="flex items-center gap-1"><Minus size={11} className="text-faint" /> missing</span>
          <span className="flex items-center gap-1"><X size={11} className="text-err" /> broken</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <Empty title="No skills match" />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted">
                <th className="px-3 py-2.5 font-medium">Skill</th>
                {capableIds.map((a) => (
                  <th key={a.id} className="px-2 py-2.5 text-center font-medium" title={a.displayName}>
                    <span className="inline-flex flex-col items-center gap-1" style={{ color: a.color }}>
                      <AgentLogo id={a.id} size={14} />
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <SkillRow key={g.realPath + g.name} g={g} agents={capableIds.map((a) => a.id)} home={data.userHome} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SkillRow({ g, agents, home }: { g: SkillGroup; agents: string[]; home: string }) {
  const tone = g.present === g.capable ? "text-ok" : g.present > 1 ? "text-warn" : "text-muted";
  return (
    <tr className="row-hover border-b border-border last:border-b-0">
      <td className="px-3 py-2.5">
        <div className="mono font-medium text-fg">{g.name}</div>
        {g.description && <div className="mt-0.5 max-w-xl truncate text-[11.5px] text-muted">{g.description}</div>}
        <div className="mono mt-0.5 truncate text-[10.5px] text-faint" title={g.realPath}>
          {tildify(g.realPath, home)}
        </div>
      </td>
      {agents.map((id) => {
        const p = g.agents[id];
        return (
          <td key={id} className="px-2 py-2.5 text-center" title={p?.path ?? "missing"}>
            {!p || !p.present ? <Minus size={13} className="mx-auto text-faint" /> : p.broken ? <X size={13} className="mx-auto text-err" /> : p.kind === "symlink" ? <Link2 size={13} className="mx-auto text-ok" /> : <Check size={13} className="mx-auto text-ok" />}
          </td>
        );
      })}
      <td className={`mono px-3 py-2.5 text-right tabular-nums ${tone}`}>
        {g.present}/{g.capable}
      </td>
    </tr>
  );
}
