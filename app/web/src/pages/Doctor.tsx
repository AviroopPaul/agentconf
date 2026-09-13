import { useMemo, useState } from "react";
import type { Finding } from "../api";
import { AgentLogo } from "../components/AgentLogo";
import { Code, DocLink, Dot, Empty, PageHeader, Pill, Segmented, Select } from "../components/ui";
import { tildify } from "../lib/format";
import { useInventory } from "../state";

type Sev = "all" | "error" | "warn" | "info";

const CHECK_LABEL: Record<string, string> = {
  "removed-key": "Removed keys",
  "deprecated-key": "Deprecated keys",
  "broken-skill-link": "Broken skill links",
  "skill-missing-skillmd": "Skills without SKILL.md",
  "skill-coverage": "Skill coverage gaps",
  "skill-link-outside": "Skill links outside shared tree",
  "mcp-drift": "MCP definitions differ",
  "mcp-single-agent": "MCP only in one agent",
  "empty-config": "Empty config files",
  "parse-error": "Config parse errors",
  "large-state": "Large state directories",
  "agents-md-interop": "AGENTS.md interop",
  "unknown-keys": "Unknown keys",
  "binary-broken": "Broken binaries",
};

export default function DoctorPage() {
  const { data, installed } = useInventory();
  const [sev, setSev] = useState<Sev>("all");
  const [check, setCheck] = useState("all");
  if (!data) return null;
  const colors = Object.fromEntries(installed.map((a) => [a.id, a.color]));

  const checks = useMemo(() => Array.from(new Set(data.doctor.map((f) => f.check))).sort(), [data.doctor]);
  const rows = data.doctor.filter((f) => (sev === "all" || f.severity === sev) && (check === "all" || f.check === check));

  return (
    <div className="fade-in">
      <PageHeader
        title="Doctor"
        subtitle="Read-only diagnostics across every agent: cross-agent drift, broken links, deprecated keys, and housekeeping. Nothing is fixed automatically. Each finding says what it found and what would resolve it."
        right={
          <>
            <Pill tone="err">{data.doctorSummary.errors} errors</Pill>
            <Pill tone="warn">{data.doctorSummary.warns} warnings</Pill>
            <Pill tone="info">{data.doctorSummary.infos} notes</Pill>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          value={sev}
          onChange={setSev}
          options={[
            { value: "all", label: "All", count: data.doctor.length },
            { value: "error", label: "Errors", count: data.doctorSummary.errors },
            { value: "warn", label: "Warnings", count: data.doctorSummary.warns },
            { value: "info", label: "Notes", count: data.doctorSummary.infos },
          ]}
        />
        <Select value={check} onChange={setCheck} options={[{ value: "all", label: "All checks" }, ...checks.map((c) => ({ value: c, label: CHECK_LABEL[c] ?? c }))]} />
      </div>

      {rows.length === 0 ? (
        <Empty title="Nothing to report" hint="Every check passed for this filter." />
      ) : (
        <div className="space-y-2">
          {rows.map((f) => (
            <FindingCard key={f.id} f={f} color={f.agent ? colors[f.agent] : undefined} home={data.userHome} />
          ))}
        </div>
      )}
    </div>
  );
}

function FindingCard({ f, color, home }: { f: Finding; color?: string; home: string }) {
  const tone = f.severity === "error" ? "err" : f.severity === "warn" ? "warn" : "info";
  return (
    <div className="card px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-[7px]">
          <Dot tone={tone} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-fg">{f.title}</span>
            <Pill className="!py-0 !text-[10px]">{CHECK_LABEL[f.check] ?? f.check}</Pill>
          </div>
          <p className="mt-1 whitespace-pre-line text-[12.5px] text-muted">{f.detail}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11.5px]">
            {f.path && <Code className="!text-[11px]">{tildify(f.path, home)}</Code>}
            <DocLink href={f.docsUrl}>Docs</DocLink>
          </div>
        </div>
        {f.agent && (
          <span className="shrink-0" style={{ color }} title={f.agent}>
            <AgentLogo id={f.agent} size={16} />
          </span>
        )}
      </div>
    </div>
  );
}
