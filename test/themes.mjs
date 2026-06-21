import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";
import { rmSync, mkdirSync } from "node:fs";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const dir = here("./themes");
const URL_BASE = "http://localhost:5173/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const order = ["professional", "glass", "midnight", "aurora", "nebula"];
const names = {
  professional: "Professional",
  glass: "Liquid Glass",
  midnight: "Midnight",
  aurora: "Aurora",
  nebula: "Nebula",
};

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 860 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(URL_BASE, { waitUntil: "networkidle0" });

// open Settings
await page.waitForSelector(".nav-foot");
await page.evaluate(() => {
  [...document.querySelectorAll("button")]
    .find((b) => /Settings/.test(b.textContent))
    ?.click();
});
await sleep(1200);
await page.waitForSelector(".theme-card");

const results = [];
for (const id of order) {
  const clicked = await page.evaluate((label) => {
    const card = [...document.querySelectorAll(".theme-card")].find((c) =>
      c.textContent.includes(label)
    );
    if (card) {
      card.click();
      return true;
    }
    return false;
  }, names[id]);

  await sleep(900); // let the transition settle
  const applied = await page.evaluate(() => ({
    attr: document.documentElement.dataset.theme,
    stored: localStorage.getItem("syntriq.theme"),
    active: document
      .querySelector(".theme-card.active")
      ?.textContent.trim()
      .slice(0, 24),
  }));
  await page.screenshot({ path: here(`./themes/${id}.png`) });
  results.push({ id, clicked, ...applied, ok: applied.attr === id && applied.stored === id });
}

// persistence check: reload, theme should remain "daylight" (last selected)
await page.reload({ waitUntil: "networkidle0" });
await sleep(600);
const afterReload = await page.evaluate(() => document.documentElement.dataset.theme);

await browser.close();

console.log(
  JSON.stringify(
    {
      allApplied: results.every((r) => r.ok && r.clicked),
      persistedAfterReload: afterReload,
      persistOk: afterReload === "nebula",
      errors,
      results,
    },
    null,
    2
  )
);
process.exit(results.every((r) => r.ok) && afterReload === "nebula" && !errors.length ? 0 : 1);
