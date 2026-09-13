import { ExternalLink as ExtIcon, Search, X } from "lucide-react";
import type { ReactNode } from "react";

export function Pill({ children, tone = "", className = "", title }: { children: ReactNode; tone?: "" | "ok" | "warn" | "err" | "info" | "accent"; className?: string; title?: string }) {
  return (
    <span className={`pill ${tone ? `pill-${tone}` : ""} ${className}`} title={title}>
      {children}
    </span>
  );
}

export function Stat({ label, value, sub, mono = false }: { label: string; value: ReactNode; sub?: ReactNode; mono?: boolean }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums leading-tight ${mono ? "mono" : ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function SectionTitle({ children, right, className = "" }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={`mb-3 flex items-end justify-between gap-4 ${className}`}>
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-muted">{children}</h2>
      {right}
    </div>
  );
}

export function PageHeader({ title, subtitle, right, eyebrow }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-medium text-muted">{eyebrow}</div>}
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-[13px] text-muted">{subtitle}</p>}
      </div>
      {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
    </div>
  );
}

export function DocLink({ href, children = "docs", className = "" }: { href?: string; children?: ReactNode; className?: string }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1 text-xs text-accent-2 hover:underline ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
      <ExtIcon size={11} />
    </a>
  );
}

export function Empty({ title, hint, icon }: { title: string; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <div className="text-sm font-medium text-fg-2">{title}</div>
      {hint && <div className="mt-1 max-w-md text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Bar({ value, max, color = "var(--color-accent)", height = 6 }: { value: number; max: number; color?: string; height?: number }) {
  const p = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full overflow-hidden rounded-full bg-surface-3" style={{ height }}>
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${p}%`, background: color }} />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search", autoFocus = false, className = "" }: { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        spellCheck={false}
        className="h-8 w-full rounded-lg border border-border bg-bg-1 pl-8 pr-8 text-[13px] text-fg outline-none placeholder:text-faint focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
      />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-fg" aria-label="Clear">
          <X size={13} />
        </button>
      )}
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; count?: number }[] }) {
  return (
    <div className="inline-flex h-8 items-center rounded-lg border border-border bg-bg-1 p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition ${active ? "bg-surface-3 text-fg shadow-sm" : "text-muted hover:text-fg-2"}`}
          >
            {o.label}
            {o.count !== undefined && <span className={`tabular-nums ${active ? "text-fg-2" : "text-faint"}`}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Select<T extends string>({ value, onChange, options, className = "" }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`h-8 rounded-lg border border-border bg-bg-1 px-2.5 text-xs text-fg-2 outline-none focus:border-accent/60 ${className}`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    boolean: "bool",
    string: "str",
    number: "num",
    array: "list",
    object: "obj",
    enum: "enum",
  };
  return <span className="mono rounded border border-border-2 bg-surface-3 px-1.5 py-px text-[10px] text-muted">{map[type] ?? type}</span>;
}

export function Code({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <code className={`mono rounded bg-surface-3 px-1.5 py-0.5 text-[12px] text-fg-2 ${className}`}>{children}</code>;
}

export function Dot({ tone }: { tone: "ok" | "warn" | "err" | "info" | "muted" }) {
  const c = { ok: "var(--color-ok)", warn: "var(--color-warn)", err: "var(--color-err)", info: "var(--color-info)", muted: "var(--color-faint)" }[tone];
  return <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c }} />;
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-2 ${className}`} />;
}
