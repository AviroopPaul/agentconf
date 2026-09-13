import { useMemo, useState } from "react";
import type { AgentReport, KeyStatus } from "../api";
import KeyRow from "./KeyRow";
import { Empty, SearchInput, Segmented, Select } from "./ui";

export type Status = "all" | "set" | "unset";
export type Group = "category" | "concept" | "none";

interface Row {
  k: KeyStatus;
  agent: AgentReport;
}

export function matchesQuery(k: KeyStatus, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  return (
    k.key.toLowerCase().includes(s) ||
    k.summary.toLowerCase().includes(s) ||
    (k.detail ?? "").toLowerCase().includes(s) ||
    k.category.toLowerCase().includes(s) ||
    (k.concept ?? "").toLowerCase().includes(s)
  );
}

/** Filterable, groupable list of keys. Used by the agent page (one agent)
 *  and Explore (all agents). */
export default function KeysList({
  agents,
  home,
  showAgent = false,
  initialStatus = "all",
  initialGroup = "category",
  hideManaged = true,
}: {
  agents: AgentReport[];
  home: string;
  showAgent?: boolean;
  initialStatus?: Status;
  initialGroup?: Group;
  hideManaged?: boolean;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>(initialStatus);
  const [category, setCategory] = useState("all");
  const [flag, setFlag] = useState("all");
  const [group, setGroup] = useState<Group>(initialGroup);
  const [managed, setManaged] = useState(!hideManaged);

  const rows: Row[] = useMemo(() => agents.flatMap((a) => a.keys.map((k) => ({ k, agent: a }))), [agents]);

  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.k.category))).sort(), [rows]);

  const filtered = useMemo(
    () =>
      rows.filter(({ k }) => {
        if (status === "set" && !k.set) return false;
        if (status === "unset" && k.set) return false;
        if (category !== "all" && k.category !== category) return false;
        if (!managed && (k.flags ?? []).includes("managedOnly") && !k.set) return false;
        if (flag !== "all") {
          if (flag === "plain" && (k.flags ?? []).length > 0) return false;
          if (flag !== "plain" && !(k.flags ?? []).includes(flag)) return false;
        }
        return matchesQuery(k, q);
      }),
    [rows, status, category, flag, managed, q],
  );

  const counts = useMemo(() => {
    const base = rows.filter(({ k }) => (category === "all" || k.category === category) && (managed || !(k.flags ?? []).includes("managedOnly") || k.set) && matchesQuery(k, q));
    return { all: base.length, set: base.filter((r) => r.k.set).length, unset: base.filter((r) => !r.k.set).length };
  }, [rows, category, managed, q]);

  const grouped = useMemo(() => {
    if (group === "none") return [["", filtered] as [string, Row[]]];
    const m = new Map<string, Row[]>();
    for (const r of filtered) {
      const g = group === "category" ? r.k.category : (r.k.concept ?? "No shared concept");
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(r);
    }
    return Array.from(m.entries()).sort(([a], [b]) => {
      if (a.startsWith("No shared")) return 1;
      if (b.startsWith("No shared")) return -1;
      return a.localeCompare(b);
    });
  }, [filtered, group]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search keys, summaries, concepts" className="w-72" autoFocus={false} />
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "set", label: "Set", count: counts.set },
            { value: "unset", label: "Unset", count: counts.unset },
          ]}
        />
        <Select value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c, label: c }))]} />
        <Select
          value={flag}
          onChange={setFlag}
          options={[
            { value: "all", label: "Any flag" },
            { value: "plain", label: "No flags" },
            { value: "experimental", label: "Experimental" },
            { value: "deprecated", label: "Deprecated" },
            { value: "removed", label: "Removed" },
            { value: "managedOnly", label: "Managed only" },
            { value: "volatile", label: "Agent-managed" },
            { value: "state", label: "Machine state" },
          ]}
        />
        <Select
          value={group}
          onChange={setGroup}
          options={[
            { value: "category", label: "Group: category" },
            { value: "concept", label: "Group: concept" },
            { value: "none", label: "No grouping" },
          ]}
        />
        <label className="ml-auto flex cursor-pointer select-none items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={managed} onChange={(e) => setManaged(e.target.checked)} className="accent-[var(--color-accent)]" />
          Show enterprise-only keys
        </label>
      </div>

      {filtered.length === 0 ? (
        <Empty title="No keys match" hint="Try clearing the search or switching the status filter." />
      ) : (
        <div className="space-y-4">
          {grouped.map(([g, list]) => (
            <section key={g || "all"}>
              {g && (
                <div className="mb-1.5 flex items-baseline gap-2 px-1">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted">{g}</h3>
                  <span className="mono text-[11px] tabular-nums text-faint">
                    {list.filter((r) => r.k.set).length}/{list.length} set
                  </span>
                </div>
              )}
              <div className="card overflow-hidden">
                {list.map(({ k, agent }) => (
                  <KeyRow key={`${agent.id}:${k.file}:${k.key}`} k={k} agent={showAgent ? agent : undefined} home={home} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
