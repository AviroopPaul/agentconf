import claude from "../assets/logos/claude.svg?raw";
import cursor from "../assets/logos/cursor.svg?raw";
import gemini from "../assets/logos/googlegemini.svg?raw";
import openai from "../assets/logos/openai.svg?raw";
import opencode from "../assets/logos/opencode.svg?raw";

// Vendor marks (simple-icons for Claude, Cursor, Gemini, OpenAI; opencode's own
// favicon geometry). Codex uses the OpenAI mark.
const RAW: Record<string, string> = { claude, cursor, gemini, codex: openai, opencode };

function inner(svg: string): string {
  const m = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  return (m ? m[1] : "").replace(/<title>[\s\S]*?<\/title>/, "");
}

const INNER: Record<string, string> = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, inner(v)]));

/** Brand mark for an agent, always in currentColor. Falls back to a monogram
 *  tile for agents without a mark. */
export function AgentLogo({ id, size = 20, color, className = "" }: { id: string; size?: number; color?: string; className?: string }) {
  const style = color ? { color } : undefined;
  if (INNER[id]) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={style} className={className} aria-hidden dangerouslySetInnerHTML={{ __html: INNER[id] }} />;
  }
  const letter = id.slice(0, 1).toUpperCase();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} className={className} aria-hidden>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="currentColor" opacity="0.15" />
      <text x="12" y="16.2" textAnchor="middle" fontSize="12" fontWeight="700" fill="currentColor" fontFamily="Inter, system-ui, sans-serif">
        {letter}
      </text>
    </svg>
  );
}

/** Logo inside a rounded tile with the agent's tint. */
export function AgentTile({ id, color, size = 36 }: { id: string; color: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl border"
      style={{ width: size, height: size, background: `${color}14`, borderColor: `${color}33`, color }}
    >
      <AgentLogo id={id} size={Math.round(size * 0.55)} />
    </div>
  );
}
