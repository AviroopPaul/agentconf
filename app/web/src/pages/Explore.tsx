import { useMemo, useState } from "react";
import { AgentLogo } from "../components/AgentLogo";
import KeysList from "../components/KeysList";
import { Empty, PageHeader } from "../components/ui";
import { num } from "../lib/format";
import { useInventory } from "../state";

export default function Explore() {
  const { data, installed } = useInventory();
  const withPack = useMemo(() => installed.filter((a) => a.hasPack), [installed]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(withPack.map((a) => a.id)));

  if (!data) return null;
  const agents = withPack.filter((a) => selected.has(a.id));
  const total = agents.reduce((s, a) => s + a.stats.total, 0);
  const set = agents.reduce((s, a) => s + a.stats.set, 0);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        if (n.size > 1) n.delete(id);
      } else n.add(id);
      return n;
    });

  return (
    <div className="fade-in">
      <PageHeader
        title="Explore settings"
        subtitle={
          <>
            Every documented key across your installed agents: <span className="mono text-fg-2">{num(total)}</span> keys, <span className="mono text-fg-2">{num(set)}</span> set. Switch to <span className="text-fg-2">Unset</span> to see what you have never touched. Each key links back to the vendor's own documentation.
          </>
        }
        right={
          <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-1 p-1">
            {withPack.map((a) => {
              const on = selected.has(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => toggle(a.id)}
                  title={a.displayName}
                  className={`flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition ${on ? "bg-surface-3 text-fg" : "text-faint hover:text-fg-2"}`}
                >
                  <span style={{ color: on ? a.color : undefined }}>
                    <AgentLogo id={a.id} size={13} />
                  </span>
                  {a.displayName}
                </button>
              );
            })}
          </div>
        }
      />
      {withPack.length === 0 ? <Empty title="No agents with a schema pack are installed" /> : <KeysList agents={agents} home={data.userHome} showAgent initialStatus="unset" />}
    </div>
  );
}
