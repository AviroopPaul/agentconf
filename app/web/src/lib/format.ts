export function bytes(n?: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function num(n?: number): string {
  if (n === undefined || n === null) return "0";
  return n.toLocaleString("en-US");
}

export function relTime(iso?: string): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 60) return `${d} d ago`;
  const mo = Math.round(d / 30);
  if (mo < 24) return `${mo} mo ago`;
  return `${Math.round(mo / 12)} y ago`;
}

export function shortDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function tildify(p: string, home: string): string {
  if (home && p.startsWith(home)) return "~" + p.slice(home.length);
  return p;
}

export function valueToString(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function pct(a: number, b: number): number {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

export function pluralize(n: number, one: string, many?: string): string {
  return `${num(n)} ${n === 1 ? one : (many ?? one + "s")}`;
}
