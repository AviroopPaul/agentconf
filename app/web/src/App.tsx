import { Activity, Blocks, Boxes, LayoutGrid, Lock, Plug, RefreshCw, Search, Stethoscope } from "lucide-react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useInventory } from "./state";
import { AgentLogo } from "./components/AgentLogo";
import { Pill, Skeleton } from "./components/ui";
import Overview from "./pages/Overview";
import AgentPage from "./pages/AgentPage";
import Explore from "./pages/Explore";
import SkillsPage from "./pages/Skills";
import MCPPage from "./pages/MCP";
import DoctorPage from "./pages/Doctor";
import UsagePage from "./pages/Usage";
import { tildify } from "./lib/format";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/explore", label: "Explore settings", icon: Search },
  { to: "/skills", label: "Skills", icon: Blocks },
  { to: "/mcp", label: "MCP servers", icon: Plug },
  { to: "/doctor", label: "Doctor", icon: Stethoscope },
  { to: "/usage", label: "Usage", icon: Activity },
];

export default function App() {
  const { data, loading, error, refresh, refreshing } = useInventory();
  const nav = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        nav("/explore");
      }
      if (e.key === "r" && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        refresh();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav, refresh]);

  const warnCount = (data?.doctorSummary.errors ?? 0) + (data?.doctorSummary.warns ?? 0);

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-[236px] shrink-0 flex-col border-r border-border bg-bg-1">
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-2 bg-surface-2">
            <Boxes size={15} className="text-fg-2" />
          </div>
          <div className="min-w-0">
            <div className="mono text-[13px] font-semibold leading-none tracking-tight">agentconf</div>
            <div className="mt-1 flex items-center gap-1.5 text-[10px] text-muted">
              <Lock size={9} /> read-only
              {data?.appVersion && <span className="mono text-faint">{data.appVersion}</span>}
            </div>
          </div>
        </div>

        <nav className="px-2 pt-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group mb-0.5 flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition ${isActive ? "bg-surface-3 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg-2"}`
              }
            >
              <Icon size={15} className="shrink-0 opacity-80" />
              <span className="flex-1">{label}</span>
              {label === "Doctor" && warnCount > 0 && <Pill tone="warn" className="!py-0 !text-[10px]">{warnCount}</Pill>}
            </NavLink>
          ))}
        </nav>

        <div className="mt-5 px-4 text-[10px] font-semibold uppercase tracking-wider text-faint">Agents</div>
        <div className="mt-1.5 flex-1 overflow-y-auto px-2">
          {loading && (
            <div className="space-y-1.5 px-1">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          )}
          {data?.agents.map((a) => (
            <NavLink
              key={a.id}
              to={`/agents/${a.id}`}
              className={({ isActive }) =>
                `mb-0.5 flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-[13px] transition ${isActive ? "bg-surface-3 text-fg" : a.installed ? "text-fg-2 hover:bg-surface-2" : "text-faint hover:bg-surface-2"}`
              }
              title={a.installed ? tildify(a.home, data.userHome) : "Not detected on this machine"}
            >
              <AgentLogo id={a.id} size={14} color={a.installed ? a.color : undefined} className={a.installed ? "" : "opacity-40"} />
              <span className="flex-1 truncate">{a.displayName}</span>
              {a.installed && a.hasPack && (
                <span className="mono text-[10px] tabular-nums text-faint">
                  {a.stats.set}/{a.stats.total}
                </span>
              )}
              {a.installed && !a.hasPack && <span className="text-[10px] text-faint">dir</span>}
            </NavLink>
          ))}
        </div>

        <div className="border-t border-border px-4 py-3 text-[11px] text-muted">
          {data && (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="mono truncate text-fg-2">{data.hostname}</div>
                <div className="tabular-nums text-faint" title={data.fullScanMillis ? `Config scan ${data.scanMillis} ms. Sizes and versions took ${data.fullScanMillis} ms in the background.` : "Sizes and versions still loading"}>
                  scanned in {data.scanMillis} ms{data.probing && <span className="ml-1 text-faint">…</span>}
                </div>
              </div>
              <button
                onClick={refresh}
                disabled={refreshing}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface-2 text-muted transition hover:text-fg disabled:opacity-50"
                title="Rescan (Ctrl+Shift+R)"
              >
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1240px] px-8 py-7">
          {error && (
            <div className="card mb-6 border-err/40 bg-err/5 px-4 py-3 text-sm text-err">
              Could not load inventory: {error}
            </div>
          )}
          {loading && !data ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
              <div className="grid grid-cols-4 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
              <Skeleton className="h-64" />
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/agents/:id" element={<AgentPage />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/skills" element={<SkillsPage />} />
              <Route path="/mcp" element={<MCPPage />} />
              <Route path="/doctor" element={<DoctorPage />} />
              <Route path="/usage" element={<UsagePage />} />
              <Route path="*" element={<Overview />} />
            </Routes>
          )}
        </div>
      </main>
    </div>
  );
}
