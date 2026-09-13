import { AlertTriangle, ExternalLink, FolderOpen, Lock } from "lucide-react";
import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { AgentReport, PathStatus } from "../api";
import { AgentTile } from "../components/AgentLogo";
import KeysList from "../components/KeysList";
import { Code, DocLink, Empty, PageHeader, Pill, SectionTitle, Stat } from "../components/ui";
import { bytes, num, relTime, tildify, valueToString } from "../lib/format";
import { useInventory } from "../state";
import { UsagePanel } from "./Usage";
import { MCPTable } from "./MCP";

type Tab = "settings" | "files" | "skills" | "mcp" | "extensions" | "usage";

const TABS: { id: Tab; label: string }[] = [
  { id: "settings", label: "Settings" },
  { id: "files", label: "Files & directories" },
  { id: "skills", label: "Skills" },
  { id: "mcp", label: "MCP" },
  { id: "extensions", label: "Hooks, plugins & rules" },
  { id: "usage", label: "Usage" },
];

export default function AgentPage() {
  const { id = "" } = useParams();
  const { data, agent } = useInventory();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("tab") as Tab) || "settings";
  const a = agent(id);
  if (!data || !a) return <Empty title="Unknown agent" hint={<Link to="/" className="text-accent-2">Back to overview</Link>} />;

  if (!a.installed) {
    return (
      <div className="fade-in">
        <Header a={a} home={data.userHome} />
        <Empty
          title={`${a.displayName} is not installed here`}
          hint={
            <>
              Looked for <Code>{tildify(a.home, data.userHome)}</Code>
              {a.homeEnv && (
                <>
                  {" "}
                  (override with <Code>{a.homeEnv}</Code>)
                </>
              )}
              . Once the agent has run at least once, its config directory appears and this page fills in.
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="fade-in">
      <Header a={a} home={data.userHome} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Settings set" value={a.hasPack ? `${a.stats.set} / ${a.stats.total}` : "n/a"} sub={a.hasPack ? `${a.stats.unset} still at default` : "no schema pack yet"} mono />
        <Stat label="Skills" value={a.skills.filter((s) => !s.managed).length} sub={`${a.skills.filter((s) => s.isSymlink).length} symlinked`} />
        <Stat label="MCP servers" value={a.mcp.length} sub={`${a.mcp.filter((m) => m.scope === "project").length} project-scoped`} />
        <Stat label="Hooks" value={a.hooks.reduce((s, h) => s + h.count, 0)} sub={`${a.hooks.length} events`} />
        <Stat label="On disk" value={bytes(a.usage?.diskBytes)} sub={a.usage ? `${num(a.usage.fileCount)} files` : ""} />
      </div>

      <div className="mb-5 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSp({ tab: t.id })}
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] transition ${tab === t.id ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg-2"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "settings" && <SettingsTab a={a} home={data.userHome} />}
      {tab === "files" && <FilesTab a={a} home={data.userHome} />}
      {tab === "skills" && <SkillsTab a={a} home={data.userHome} />}
      {tab === "mcp" && (a.mcp.length ? <MCPTable servers={a.mcp} home={data.userHome} /> : <Empty title="No MCP servers configured" hint={<>Where {a.displayName} reads MCP config is listed under Files & directories (kind <Code>mcp</Code>).</>} />)}
      {tab === "extensions" && <ExtensionsTab a={a} home={data.userHome} />}
      {tab === "usage" && (a.usage ? <UsagePanel a={a} /> : <Empty title="No usage data" />)}
    </div>
  );
}

function Header({ a, home }: { a: AgentReport; home: string }) {
  return (
    <PageHeader
      eyebrow={
        <span className="flex items-center gap-2">
          <Link to="/" className="hover:text-fg-2">Agents</Link>
          <span className="text-faint">/</span>
          <span className="text-fg-2">{a.displayName}</span>
        </span>
      }
      title={
        <span className="flex items-center gap-3">
          <AgentTile id={a.id} color={a.installed ? a.color : "#5c6478"} size={40} />
          <span>
            <span className="block leading-tight">{a.displayName}</span>
            <span className="mt-0.5 block text-[12px] font-normal text-muted">
              {a.vendor}
              {a.version && (
                <>
                  {" "}
                  · <span className="mono">{a.version}</span>
                </>
              )}
              {a.probeError && (
                <>
                  {" "}
                  · <span className="text-warn">binary on PATH but fails to run</span>
                </>
              )}
              {a.installed && (
                <>
                  {" "}
                  · <span className="mono">{tildify(a.home, home)}</span>
                </>
              )}
            </span>
          </span>
        </span>
      }
      right={
        <>
          {a.packVersion && <Pill title="Schema pack version">pack {a.packVersion}</Pill>}
          <a href={a.docsUrl} target="_blank" rel="noreferrer" className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs text-fg-2 hover:bg-surface-2">
            Vendor docs <ExternalLink size={11} />
          </a>
        </>
      }
    />
  );
}

function SettingsTab({ a, home }: { a: AgentReport; home: string }) {
  if (!a.hasPack) {
    return (
      <Empty
        title={`No schema pack for ${a.displayName} yet`}
        hint="Directory presence and skills are still detected. Adding a pack in schemas/ enables the full settings view. The format is documented in schemas/SCHEMA.md."
      />
    );
  }
  return (
    <div className="space-y-6">
      {a.errors && a.errors.length > 0 && (
        <div className="card border-err/40 px-4 py-3 text-[12.5px] text-err">
          <div className="mb-1 flex items-center gap-2 font-medium">
            <AlertTriangle size={13} /> Some config files could not be parsed
          </div>
          {a.errors.map((e) => (
            <div key={e} className="mono text-[11.5px]">
              {e}
            </div>
          ))}
        </div>
      )}
      <KeysList agents={[a]} home={home} initialStatus="all" />
      {a.unknownKeys.length > 0 && (
        <section>
          <SectionTitle right={<span className="text-xs text-faint">Set in your files but not in the schema pack</span>}>Unknown keys</SectionTitle>
          <div className="card divide-y divide-border">
            {a.unknownKeys.map((u) => (
              <div key={u.source + u.key} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
                <span className="mono text-fg">{u.key}</span>
                <span className="mono ml-auto max-w-[40%] truncate text-muted">{u.masked ? "hidden" : valueToString(u.value)}</span>
                <span className="mono shrink-0 text-[11px] text-faint">{tildify(u.source, home)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Either very new, undocumented, or a typo. Worth checking against the vendor changelog.</p>
        </section>
      )}
    </div>
  );
}

const KIND_LABEL: Record<string, string> = {
  settings: "Settings",
  instructions: "Instructions",
  mcp: "MCP",
  skills: "Skills",
  rules: "Rules",
  agents: "Subagents",
  commands: "Commands",
  hooks: "Hooks",
  outputStyles: "Output styles",
  workflows: "Workflows",
  plugins: "Plugins",
  themes: "Themes",
  keybindings: "Keybindings",
  memory: "Memory",
  trust: "Trust",
  state: "Machine state",
  credential: "Credentials",
  vendor: "Vendor-managed",
  logs: "Logs",
};

const KIND_ORDER = ["settings", "instructions", "mcp", "hooks", "skills", "rules", "agents", "commands", "outputStyles", "workflows", "plugins", "themes", "keybindings", "trust", "memory", "vendor", "logs", "state", "credential"];

function FilesTab({ a, home }: { a: AgentReport; home: string }) {
  const groups = useMemo(() => {
    const m = new Map<string, PathStatus[]>();
    for (const p of a.paths) {
      if (!m.has(p.kind)) m.set(p.kind, []);
      m.get(p.kind)!.push(p);
    }
    return Array.from(m.entries()).sort(([x], [y]) => KIND_ORDER.indexOf(x) - KIND_ORDER.indexOf(y));
  }, [a.paths]);

  const projectPaths = a.paths.filter((p) => p.scope === "project");

  return (
    <div className="space-y-5">
      <p className="text-[12.5px] text-muted">
        Everything {a.displayName} reads from <Code>{tildify(a.home, home)}</Code>, whether or not it exists yet. Machine state is shown for size only and never parsed. Credential files are never opened.
      </p>
      {groups.map(([kind, paths]) => (
        <section key={kind}>
          <SectionTitle right={<span className="mono text-[11px] text-faint">{paths.filter((p) => p.exists).length}/{paths.length} present</span>}>{KIND_LABEL[kind] ?? kind}</SectionTitle>
          <div className="card divide-y divide-border">
            {paths.map((p) => (
              <PathRow key={p.path} p={p} home={home} />
            ))}
          </div>
        </section>
      ))}
      {projectPaths.length > 0 && (
        <p className="text-xs text-faint">Project-level paths ({projectPaths.length}) are described in the schema pack but only user-level paths are scanned in this version.</p>
      )}
    </div>
  );
}

function PathRow({ p, home }: { p: PathStatus; home: string }) {
  const isCred = p.kind === "credential";
  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 ${p.exists ? "" : "opacity-60"}`}>
      <span className="mt-1 shrink-0 text-faint">{isCred ? <Lock size={13} /> : <FolderOpen size={13} className={p.isDir ? "" : "opacity-40"} />}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`mono text-[12.5px] ${p.exists ? "text-fg" : "text-muted line-through decoration-faint"}`}>{p.path}</span>
          {!p.exists && <Pill className="!py-0 !text-[10px]">not present</Pill>}
          {p.isSymlink && (
            <Pill className="!py-0 !text-[10px]" title={p.target}>
              symlink
            </Pill>
          )}
          {isCred && (
            <Pill tone="err" className="!py-0 !text-[10px]">
              never read
            </Pill>
          )}
          {!p.editable && !isCred && p.exists && (
            <Pill className="!py-0 !text-[10px]">
              {p.kind === "state" || p.kind === "logs" ? "generated" : p.kind === "vendor" ? "vendor-managed" : "agent-written"}
            </Pill>
          )}
        </div>
        <div className="mt-0.5 text-[12px] text-muted">
          {p.summary} <DocLink href={p.docsUrl} className="ml-1" />
        </div>
      </div>
      <div className="mono shrink-0 text-right text-[11.5px] text-muted">
        {p.exists && p.isDir && p.entries !== undefined && <div>{num(p.entries)} entries</div>}
        {p.exists && p.sizeBytes ? <div className="text-faint">{bytes(p.sizeBytes)}</div> : null}
        {p.exists && p.modTime && <div className="text-faint">{relTime(p.modTime)}</div>}
      </div>
    </div>
  );
}

function SkillsTab({ a, home }: { a: AgentReport; home: string }) {
  const own = a.skills.filter((s) => !s.managed);
  const managed = a.skills.filter((s) => s.managed);
  if (a.skills.length === 0) return <Empty title="No skills directory" hint="Skills are folders with a SKILL.md entrypoint. Check Files & directories for where this agent looks." />;
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle right={<span className="text-xs text-faint">{own.filter((s) => s.isSymlink).length} symlinked, {own.filter((s) => !s.isSymlink).length} local</span>}>Your skills ({own.length})</SectionTitle>
        <div className="card divide-y divide-border">
          {own.map((s) => (
            <div key={s.path} className="flex items-start gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mono text-[12.5px] font-medium">{s.name}</span>
                  {s.broken && <Pill tone="err" className="!py-0 !text-[10px]">broken link</Pill>}
                  {!s.hasSkillMd && !s.broken && <Pill tone="warn" className="!py-0 !text-[10px]">no SKILL.md</Pill>}
                  {s.isSymlink && <Pill className="!py-0 !text-[10px]">symlink</Pill>}
                </div>
                {s.description && <div className="mt-0.5 text-[12px] text-muted truncate-2">{s.description}</div>}
              </div>
              <div className="mono max-w-[40%] shrink-0 truncate text-right text-[11px] text-faint" title={s.realPath}>
                {s.isSymlink ? `→ ${tildify(s.realPath, home)}` : tildify(s.path, home)}
              </div>
            </div>
          ))}
        </div>
      </section>
      {managed.length > 0 && (
        <section>
          <SectionTitle right={<span className="text-xs text-faint">Shipped by {a.vendor}, not yours to edit</span>}>Vendor-managed ({managed.length})</SectionTitle>
          <div className="card grid grid-cols-2 gap-x-6 px-3 py-2 md:grid-cols-3">
            {managed.map((s) => (
              <div key={s.path} className="flex items-baseline gap-2 py-1 text-[12px]">
                <span className="mono text-fg-2">{s.name}</span>
                {s.description && <span className="truncate text-faint">{s.description}</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ExtensionsTab({ a, home }: { a: AgentReport; home: string }) {
  const ext = a.extensions ?? {};
  const trusted = ext.trustedProjects ?? [];
  const extKinds = Object.entries(ext).filter(([k, v]) => k !== "trustedProjects" && v && v.length > 0);
  const nothing = a.hooks.length === 0 && a.plugins.length === 0 && extKinds.length === 0 && a.instructions.length === 0 && trusted.length === 0;
  if (nothing) return <Empty title="Nothing configured here yet" hint="Hooks, plugins, rules, subagents, commands and instruction files all show up on this tab once present." />;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section>
        <SectionTitle>Instruction files</SectionTitle>
        <div className="card divide-y divide-border">
          {a.instructions.length === 0 && <div className="px-3 py-3 text-xs text-muted">None declared for this agent.</div>}
          {a.instructions.map((f) => (
            <div key={f.path} className={`flex items-center gap-3 px-3 py-2.5 text-[12.5px] ${f.exists ? "" : "opacity-60"}`}>
              <span className={`mono ${f.exists ? "text-fg" : "text-muted"}`}>{tildify(f.path, home)}</span>
              {f.isSymlink && <Pill className="!py-0 !text-[10px]" title={f.target}>symlink</Pill>}
              {f.importsAgentsMd && <Pill tone="ok" className="!py-0 !text-[10px]">imports AGENTS.md</Pill>}
              <span className="mono ml-auto text-[11px] text-faint">{f.exists ? `${num(f.lines)} lines · ${bytes(f.sizeBytes)}` : "not present"}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Hooks</SectionTitle>
        <div className="card divide-y divide-border">
          {a.hooks.length === 0 && <div className="px-3 py-3 text-xs text-muted">No lifecycle hooks registered. Hooks run your own commands at points in the agent loop.</div>}
          {a.hooks.map((h) => (
            <div key={h.source + h.event} className="flex items-center gap-3 px-3 py-2.5 text-[12.5px]">
              <span className="mono text-fg">{h.event}</span>
              <span className="mono ml-auto text-fg-2">{h.count}</span>
              <span className="mono text-[11px] text-faint">{tildify(h.source, home)}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Plugins</SectionTitle>
        <div className="card divide-y divide-border">
          {a.plugins.length === 0 && <div className="px-3 py-3 text-xs text-muted">No plugins installed.</div>}
          {a.plugins.map((p) => (
            <div key={p.source + p.name} className="flex items-center gap-3 px-3 py-2.5 text-[12.5px]">
              <span className="mono text-fg">{p.name}</span>
              {p.version && <span className="mono text-[11px] text-muted">v{p.version}</span>}
              {p.enabled === false && <Pill className="!py-0 !text-[10px]">disabled</Pill>}
              {p.enabled === true && <Pill tone="ok" className="!py-0 !text-[10px]">enabled</Pill>}
              <span className="ml-auto text-[11px] text-faint">{p.lastUpdated ? `updated ${relTime(p.lastUpdated)}` : p.scope}</span>
            </div>
          ))}
        </div>
      </section>

      {extKinds.map(([kind, entries]) => (
        <section key={kind}>
          <SectionTitle right={<span className="mono text-[11px] text-faint">{entries.length}</span>}>{KIND_LABEL[kind] ?? kind}</SectionTitle>
          <div className="card divide-y divide-border">
            {entries.slice(0, 30).map((e) => (
              <div key={e.path} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
                <span className="mono text-fg-2">{e.name}</span>
                {e.isSymlink && <Pill className="!py-0 !text-[10px]">symlink</Pill>}
                <span className="mono ml-auto text-[11px] text-faint">{e.isDir ? "dir" : bytes(e.sizeBytes)}</span>
              </div>
            ))}
            {entries.length > 30 && <div className="px-3 py-2 text-xs text-faint">and {entries.length - 30} more</div>}
          </div>
        </section>
      ))}

      {trusted.length > 0 && (
        <section className="lg:col-span-2">
          <SectionTitle right={<span className="text-xs text-faint">Directories where this agent runs without the trust prompt</span>}>Trusted projects ({trusted.length})</SectionTitle>
          <div className="card grid grid-cols-1 gap-x-6 px-3 py-2 md:grid-cols-2 xl:grid-cols-3">
            {trusted.map((t) => (
              <div key={t.path} className="mono truncate py-1 text-[12px] text-fg-2" title={t.path}>
                {tildify(t.path, home)}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
