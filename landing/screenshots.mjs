// Captures real screenshots of the running app for the landing page.
// Usage: start the app (`./bin/agentconf --no-open --port 4242`), then
// `node screenshots.mjs`. Writes PNGs to landing/assets/shots/.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "assets", "shots");
mkdirSync(out, { recursive: true });

const BASE = process.env.AGENTCONF_URL || "http://127.0.0.1:4242";
const SHOTS = [
  { name: "overview", path: "/", wait: 1600 },
  { name: "agent-settings", path: "/agents/claude?tab=settings", wait: 900, actions: async (page) => {
      // Expand one interesting row so the detail panel shows.
      const row = page.locator("button", { hasText: "sandbox.network.allowedDomains" }).first();
      if (await row.count()) await row.click();
    } },
  { name: "agent-files", path: "/agents/claude?tab=files", wait: 900 },
  { name: "explore", path: "/explore", wait: 900 },
  { name: "skills", path: "/skills", wait: 900 },
  { name: "mcp", path: "/mcp", wait: 900 },
  { name: "doctor", path: "/doctor", wait: 900 },
  { name: "usage", path: "/agents/claude?tab=usage", wait: 900 },
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
const page = await ctx.newPage();

for (const s of SHOTS) {
  await page.goto(BASE + s.path, { waitUntil: "networkidle" });
  await page.waitForTimeout(s.wait);
  if (s.actions) await s.actions(page);
  await page.waitForTimeout(250);
  const file = join(out, `${s.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

await browser.close();
