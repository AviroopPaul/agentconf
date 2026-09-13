import { ChevronRight } from "lucide-react";
import { useState } from "react";
import type { KeyStatus } from "../api";
import { tildify, valueToString } from "../lib/format";
import { AgentLogo } from "./AgentLogo";
import { Code, DocLink, Pill, TypeBadge } from "./ui";

export interface KeyRowProps {
  k: KeyStatus;
  agent?: { id: string; color: string; displayName: string };
  home?: string;
  defaultOpen?: boolean;
}

const FLAG_TONE: Record<string, "ok" | "warn" | "err" | "info" | "accent" | ""> = {
  experimental: "accent",
  deprecated: "warn",
  removed: "err",
  managedOnly: "",
  volatile: "",
  sensitive: "",
  state: "",
};

const FLAG_LABEL: Record<string, string> = {
  managedOnly: "managed only",
  volatile: "agent-managed",
  state: "machine state",
};

export function ValueCell({ k }: { k: KeyStatus }) {
  if (!k.set) {
    const d = k.default;
    return (
      <span className="mono text-[12px] text-faint">
        {d !== undefined && d !== null ? (
          <>
            <span className="text-faint">default </span>
            <span className="text-muted">{valueToString(d)}</span>
          </>
        ) : (
          "unset"
        )}
      </span>
    );
  }
  const s = valueToString(k.value);
  return (
    <span className={`mono text-[12px] ${k.masked ? "text-faint" : "text-fg"}`} title={s.length > 60 ? s : undefined}>
      {s.length > 60 ? s.slice(0, 57) + "..." : s}
    </span>
  );
}

export default function KeyRow({ k, agent, home = "", defaultOpen = false }: KeyRowProps) {
  const [open, setOpen] = useState(defaultOpen);
  const flags = (k.flags ?? []).filter((f) => f !== "sensitive");
  const hasMore = Boolean(k.detail || k.enumValues?.length || k.matches?.length || k.addedIn || k.removedIn);

  return (
    <div className={`border-b border-border last:border-b-0 ${open ? "bg-surface-2/60" : ""}`}>
      <button onClick={() => setOpen((v) => !v)} className="row-hover flex w-full items-start gap-3 px-3 py-2.5 text-left">
        <ChevronRight size={13} className={`mt-1 shrink-0 text-faint transition-transform ${open ? "rotate-90" : ""}`} />
        {agent && (
          <span className="mt-0.5 shrink-0" style={{ color: agent.color }} title={agent.displayName}>
            <AgentLogo id={agent.id} size={14} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`mono text-[12.5px] font-medium ${k.set ? "text-fg" : "text-fg-2"}`}>{k.key}</span>
            <TypeBadge type={k.type} />
            {flags.map((f) => (
              <Pill key={f} tone={FLAG_TONE[f] ?? ""} className="!py-0 !text-[10px]">
                {FLAG_LABEL[f] ?? f}
              </Pill>
            ))}
          </div>
          <div className="mt-0.5 text-[12.5px] text-muted">{k.summary}</div>
        </div>
        <div className="flex w-[260px] shrink-0 items-start justify-end gap-2 text-right">
          {k.set && <span className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-ok" title="Set on this machine" />}
          <div className="min-w-0 truncate pt-0.5">
            <ValueCell k={k} />
          </div>
        </div>
      </button>
      {open && (
        <div className="fade-in grid gap-3 px-3 pb-3.5 pl-9 text-[12.5px] md:grid-cols-[1fr_280px]">
          <div className="space-y-2">
            {k.detail && <p className="text-fg-2">{k.detail}</p>}
            {!k.detail && !hasMore && <p className="text-muted">No further notes. The summary above is the whole story.</p>}
            {k.enumValues && k.enumValues.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted">Allowed:</span>
                {k.enumValues.map((v) => (
                  <Code key={v} className={valueToString(k.value) === v ? "!text-ok" : ""}>
                    {v}
                  </Code>
                ))}
              </div>
            )}
            {k.matches && k.matches.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-muted">Configured:</span>
                {k.matches.slice(0, 12).map((m) => (
                  <Code key={m}>{m}</Code>
                ))}
                {k.matches.length > 12 && <span className="text-faint">and {k.matches.length - 12} more</span>}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
              <DocLink href={k.docsUrl}>Vendor docs</DocLink>
              {k.addedIn && <span className="text-faint">added in {k.addedIn}</span>}
              {k.removedIn && <span className="text-err">removed in {k.removedIn}</span>}
              {k.concept && (
                <span className="text-faint">
                  concept <Code className="!text-[11px]">{k.concept}</Code>
                </span>
              )}
            </div>
          </div>
          <dl className="grid grid-cols-[72px_1fr] gap-x-2 gap-y-1 self-start text-[12px]">
            <dt className="text-faint">File</dt>
            <dd className="mono truncate text-fg-2">{k.file}</dd>
            <dt className="text-faint">Scopes</dt>
            <dd className="text-fg-2">{k.scopes.join(", ")}</dd>
            {k.set && k.source && (
              <>
                <dt className="text-faint">Set in</dt>
                <dd className="mono truncate text-fg-2" title={k.source}>
                  {tildify(k.source, home)}
                </dd>
              </>
            )}
            {k.default !== undefined && k.default !== null && (
              <>
                <dt className="text-faint">Default</dt>
                <dd className="mono truncate text-fg-2">{valueToString(k.default)}</dd>
              </>
            )}
            {k.set && k.masked && (
              <>
                <dt className="text-faint">Value</dt>
                <dd className="text-fg-2">Hidden. Looks like a secret, so it is never read into the UI.</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}
