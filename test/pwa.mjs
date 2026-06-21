import puppeteer from "puppeteer";

const URL_BASE = "http://localhost:4173/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// 1) initial load + wait for the service worker to take control
await page.goto(URL_BASE, { waitUntil: "networkidle0" });
await page.waitForSelector(".tool-card", { timeout: 10000 });

const swReady = await page.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return false;
  const reg = await navigator.serviceWorker.ready;
  return !!reg.active;
});

// 2) manifest is linked + parseable
const manifest = await page.evaluate(async () => {
  const link = document.querySelector('link[rel="manifest"]');
  if (!link) return null;
  const res = await fetch(link.href);
  return res.ok ? await res.json() : null;
});

// give Workbox a moment to finish precaching everything
await sleep(2500);

// 3) go OFFLINE and hard-reload — the app shell must still boot from cache
await page.setOfflineMode(true);
let offlineOk = false;
let offlineToolCount = 0;
try {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".tool-card", { timeout: 8000 });
  offlineToolCount = await page.$$eval(".tool-card", (e) => e.length);
  offlineOk = offlineToolCount > 0;
} catch (e) {
  offlineOk = false;
}
await page.setOfflineMode(false);

await browser.close();

const result = {
  ok:
    swReady &&
    !!manifest &&
    manifest.name === "Syntriq Studio" &&
    (manifest.icons || []).length >= 2 &&
    offlineOk &&
    errors.length === 0,
  serviceWorkerActive: swReady,
  manifestName: manifest?.name,
  manifestIcons: (manifest?.icons || []).length,
  display: manifest?.display,
  offlineReloadWorks: offlineOk,
  offlineToolCount,
  errors,
};
console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
