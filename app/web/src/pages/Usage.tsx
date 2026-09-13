import type { AgentReport } from "../api";
import { AgentTile } from "../components/AgentLogo";
import { Bars, Heatmap, Ranked, compact } from "../components/Charts";
import { Empty, PageHeader, SectionTitle, Stat } from "../components/ui";
import { bytes, num, relTime, shortDate } from "../lib/format";
import { useInventory } from "../state";

export default function UsagePage() {
  const { data, installed } = useInventory();
  if (!data) return null;
  const withUsage = installed.filter((a) => a.usage);
  const totalDisk = withUsage.reduce((s, a) => s + (a.usage?.diskBytes ?? 0), 0);

  return (
    <div className="fade-in">
      <PageHeader
        title="Usage footprint"
        subtitle="What each agent has accumulated on this machine: sessions, prompts, projects, and disk. Counts and timestamps only. Prompt text and transcripts are never read."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Tokens, lifetime" value={compact(withUsage.reduce((s, a) => s + (a.usage?.tokens?.total ?? 0), 0))} sub={`${withUsage.filter((a) => a.usage?.tokens).length} of ${withUsage.length} agents record this`} />
        <Stat label="Total on disk" value={bytes(totalDisk)} sub={`${withUsage.length} agent directories`} />
        <Stat label="Files" value={num(withUsage.reduce((s, a) => s + (a.usage?.fileCount ?? 0), 0))} />
        <Stat label="Sessions" value={num(withUsage.reduce((s, a) => s + (a.usage?.sessions ?? 0), 0))} sub="where the agent records them" />
        <Stat label="Prompts" value={num(withUsage.reduce((s, a) => s + (a.usage?.prompts ?? 0), 0))} sub="from history files" />
      </div>
      <div className="space-y-6">
        {withUsage.map((a) => (
          <section key={a.id} className="card p-5">
            <div className="mb-4 flex items-center gap-3">
              <AgentTile id={a.id} color={a.color} size={32} />
              <div>
                <div className="text-[14px] font-semibold">{a.displayName}</div>
                <div className="text-[11.5px] text-muted">{a.usage?.lastActivity ? `last active ${relTime(a.usage.lastActivity)}` : "no activity timestamps found"}</div>
              </div>
            </div>
            <UsagePanel a={a} compactHeader />
          </section>
        ))}
        {withUsage.length === 0 && <Empty title="No usage data" />}
      </div>
    </div>
  );
}

export function UsagePanel({ a, compactHeader = false }: { a: AgentReport; compactHeader?: boolean }) {
  const u = a.usage;
  if (!u) return null;
  const extra = (u.extra ?? {}) as Record<string, unknown>;
  const dailyTokens = (extra.dailyTokens as { date: string; tokens: number }[] | undefined) ?? [];
  const daily = (extra.dailyActivity as { date: string; messageCount?: number; sessionCount?: number; toolCallCount?: number }[] | undefined) ?? [];
  const modelUsage = (extra.modelUsage as Record<string, { inputTokens?: number; outputTokens?: number; cacheReadInputTokens?: number; cacheCreationInputTokens?: number }> | undefined) ?? {};
  const hourCounts = (extra.hourCounts as Record<string, number> | undefined) ?? {};
  const models = Object.entries(modelUsage)
    .map(([m, v]) => ({ label: m, value: (v.inputTokens ?? 0) + (v.outputTokens ?? 0) + (v.cacheReadInputTokens ?? 0) + (v.cacheCreationInputTokens ?? 0), sub: `${compact(v.outputTokens ?? 0)} output · ${compact(v.cacheReadInputTokens ?? 0)} cache read` }))
    .sort((x, y) => y.value - x.value)
    .slice(0, 8);
  const tokensByDate = new Map(dailyTokens.map((d) => [d.date, d.tokens]));
  const heat = daily.map((d) => ({ date: d.date, value: d.messageCount ?? 0, extra: tokensByDate.has(d.date) ? `${compact(tokensByDate.get(d.date)!)} tokens · ${d.sessionCount ?? 0} sessions` : `${d.sessionCount ?? 0} sessions` }));
  const statsAt = extra.statsComputedAt as string | undefined;
  const hours = Array.from({ length: 24 }, (_, h) => ({ label: String(h).padStart(2, "0"), value: hourCounts[String(h)] ?? 0 }));
  const hasHours = hours.some((h) => h.value > 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {u.tokens ? (
          <Stat
            label="Tokens, lifetime"
            value={compact(u.tokens.total)}
            sub={`${compact(u.tokens.input)} in · ${compact(u.tokens.output)} out · ${compact(u.tokens.cacheRead + u.tokens.cacheCreation)} cache`}
          />
        ) : (
          <Stat label="Tokens, lifetime" value={<span className="text-base text-faint">not recorded</span>} sub="this agent keeps no aggregate stats file" />
        )}
        <Stat label="On disk" value={bytes(u.diskBytes)} sub={`${num(u.fileCount)} files`} />
        {u.sessions ? <Stat label="Sessions" value={num(u.sessions)} /> : null}
        {u.messages ? <Stat label="Messages" value={num(u.messages)} /> : null}
        {u.prompts ? <Stat label="Prompts" value={num(u.prompts)} /> : null}
        {u.projects ? <Stat label="Projects" value={num(u.projects)} /> : null}
        {u.firstActivity && <Stat label="First seen" value={<span className="text-base">{shortDate(u.firstActivity)}</span>} sub={u.lastActivity ? `last ${relTime(u.lastActivity)}` : undefined} />}
        {typeof extra.transcriptBytes === "number" && <Stat label="Transcripts" value={bytes(extra.transcriptBytes as number)} sub={`${num(extra.transcriptFiles as number)} files`} />}
      </div>

      {heat.length > 0 && (
        <div>
          <SectionTitle right={<span className="text-xs text-faint">Messages per day{statsAt ? `, stats last computed ${statsAt}` : ""}</span>}>Activity heatmap</SectionTitle>
          <div className="card px-4 py-3">
            <Heatmap data={heat} color={a.color} format={(v) => `${v} messages`} />
          </div>
        </div>
      )}

      {(daily.length > 0 || dailyTokens.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {daily.length > 0 && (
            <div>
              <SectionTitle right={<span className="text-xs text-faint">Messages per day, last {daily.length} recorded days</span>}>Activity</SectionTitle>
              <div className="card px-4 py-3">
                <Bars data={daily.map((d) => ({ label: d.date, value: d.messageCount ?? 0 }))} color={a.color} height={72} labelEvery={Math.max(1, Math.floor(daily.length / 4))} format={(v) => `${v} messages`} />
              </div>
            </div>
          )}
          {dailyTokens.length > 0 && (
            <div>
              <SectionTitle right={<span className="text-xs text-faint">Tokens per day, incl. cache, last {dailyTokens.length} days</span>}>Tokens</SectionTitle>
              <div className="card px-4 py-3">
                <Bars data={dailyTokens.map((d) => ({ label: d.date, value: d.tokens }))} color={a.color} height={72} labelEvery={Math.max(1, Math.floor(dailyTokens.length / 4))} format={(v) => `${compact(v)} tokens`} />
              </div>
            </div>
          )}
        </div>
      )}

      {(models.length > 0 || hasHours) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {models.length > 0 && (
            <div>
              <SectionTitle right={<span className="text-xs text-faint">Total tokens, all time</span>}>Models</SectionTitle>
              <div className="card px-4 py-3">
                <Ranked rows={models} color={a.color} format={compact} />
              </div>
            </div>
          )}
          {hasHours && (
            <div>
              <SectionTitle right={<span className="text-xs text-faint">Sessions started, by hour of day</span>}>When you work</SectionTitle>
              <div className="card px-4 py-3">
                <Bars data={hours} color={a.color} height={72} labelEvery={4} format={(v) => `${v} sessions`} />
              </div>
            </div>
          )}
        </div>
      )}

      {u.notes && u.notes.length > 0 && (
        <ul className="space-y-1 text-[11.5px] text-faint">
          {u.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
