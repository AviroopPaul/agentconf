import { useMemo } from "react";

/** Tiny dependency-free bar chart. */
export function Bars({ data, color = "var(--color-accent)", height = 64, labelEvery = 0, format }: { data: { label: string; value: number }[]; color?: string; height?: number; labelEvery?: number; format?: (v: number) => string }) {
  const max = useMemo(() => Math.max(1, ...data.map((d) => d.value)), [data]);
  if (data.length === 0) return <div className="text-xs text-faint">No data</div>;
  return (
    <div>
      <div className="flex items-end gap-px" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="group relative flex-1" style={{ height: "100%" }} title={`${d.label}: ${format ? format(d.value) : d.value}`}>
            <div
              className="absolute bottom-0 left-0 right-0 rounded-t-[2px] transition-opacity group-hover:opacity-100"
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, background: color, opacity: d.value === 0 ? 0.15 : 0.75 }}
            />
          </div>
        ))}
      </div>
      {labelEvery > 0 && (
        <div className="mt-1 flex justify-between text-[10px] text-faint">
          {data.filter((_, i) => i % labelEvery === 0 || i === data.length - 1).map((d, i) => (
            <span key={i} className="mono">
              {d.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Horizontal ranked bars. */
export function Ranked({ rows, color = "var(--color-accent)", format }: { rows: { label: string; value: number; sub?: string }[]; color?: string; format?: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-0.5 flex items-baseline justify-between gap-3 text-[12px]">
            <span className="mono truncate text-fg-2">{r.label}</span>
            <span className="mono shrink-0 tabular-nums text-muted">{format ? format(r.value) : r.value}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
          {r.sub && <div className="mt-0.5 text-[11px] text-faint">{r.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function compact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

/** GitHub-style calendar heatmap. Weeks are columns, Sunday to Saturday rows.
 *  Range runs from the first data point (aligned to Sunday) to the last. */
export function Heatmap({ data, color = "var(--color-accent)", format }: { data: { date: string; value: number; extra?: string }[]; color?: string; format?: (v: number) => string }) {
  const byDate = useMemo(() => new Map(data.map((d) => [d.date, d])), [data]);
  const { weeks, months } = useMemo(() => {
    if (data.length === 0) return { weeks: [] as string[][], months: [] as { label: string; col: number }[] };
    const dates = data.map((d) => d.date).sort();
    const start = new Date(dates[0] + "T00:00:00");
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(dates[dates.length - 1] + "T00:00:00");
    const weeks: string[][] = [];
    const months: { label: string; col: number }[] = [];
    let cur = new Date(start);
    let lastMonth = -1;
    while (cur <= end) {
      const week: string[] = [];
      for (let i = 0; i < 7; i++) {
        const iso = cur.toISOString().slice(0, 10);
        week.push(cur <= end ? iso : "");
        if (cur.getDate() <= 7 && cur.getMonth() !== lastMonth && i === 0) {
          months.push({ label: cur.toLocaleDateString("en-US", { month: "short" }), col: weeks.length });
          lastMonth = cur.getMonth();
        }
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }
    return { weeks, months };
  }, [data]);
  const values = data.map((d) => d.value).filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p: number) => values[Math.min(values.length - 1, Math.floor(p * values.length))] ?? 1;
  const steps = [q(0.25), q(0.5), q(0.75)];
  const level = (v: number) => (v <= 0 ? 0 : v <= steps[0] ? 1 : v <= steps[1] ? 2 : v <= steps[2] ? 3 : 4);
  const alpha = [0, 0.28, 0.5, 0.74, 1];
  if (weeks.length === 0) return <div className="text-xs text-faint">No data</div>;
  const cell = 11, gap = 3;
  return (
    <div className="overflow-x-auto">
      <div className="relative" style={{ paddingTop: 14, minWidth: weeks.length * (cell + gap) + 30 }}>
        {months.map((m) => (
          <span key={m.label + m.col} className="mono absolute top-0 text-[10px] text-faint" style={{ left: 30 + m.col * (cell + gap) }}>
            {m.label}
          </span>
        ))}
        <div className="flex gap-[3px]">
          <div className="mono flex flex-col justify-between pr-1 text-[9px] text-faint" style={{ height: 7 * cell + 6 * gap, width: 26 }}>
            <span>Sun</span><span>Wed</span><span>Sat</span>
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((iso, di) => {
                const d = iso ? byDate.get(iso) : undefined;
                const v = d?.value ?? 0;
                const lv = iso ? level(v) : -1;
                return (
                  <div
                    key={di}
                    title={iso ? `${iso}: ${format ? format(v) : v}${d?.extra ? " · " + d.extra : ""}` : undefined}
                    className="rounded-[2px]"
                    style={{ width: cell, height: cell, background: lv < 0 ? "transparent" : lv === 0 ? "var(--color-surface-3)" : color, opacity: lv <= 0 ? 1 : alpha[lv] }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-faint">
          <span className="mr-1">less</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="inline-block rounded-[2px]" style={{ width: cell, height: cell, background: l === 0 ? "var(--color-surface-3)" : color, opacity: l === 0 ? 1 : alpha[l] }} />
          ))}
          <span className="ml-1">more</span>
        </div>
      </div>
    </div>
  );
}
