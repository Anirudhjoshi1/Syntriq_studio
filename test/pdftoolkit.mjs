import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";
import { rmSync, mkdirSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { PDFDocument } from "pdf-lib";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const dir = here("./pdft");
const dl = here("./pdft/dl");
const URL_BASE = "http://localhost:5173/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

rmSync(dir, { recursive: true, force: true });
mkdirSync(dl, { recursive: true });

// each section is shorter than the page so it maps to exactly one printed page
const pageHtml = (labels) =>
  `<html><body style="margin:0;font:48px sans-serif">${labels
    .map(
      (t, i) =>
        `<div style="height:760px;overflow:hidden;${
          i < labels.length - 1 ? "page-break-after:always;" : ""
        }display:flex;align-items:center;justify-content:center">${t}</div>`
    )
    .join("")}</body></html>`;

const pdfOpts = {
  width: "600px",
  height: "800px",
  printBackground: true,
  margin: { top: 0, bottom: 0, left: 0, right: 0 },
};

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });

// make a 2-page and a 1-page PDF
const gen = await browser.newPage();
await gen.setContent(pageHtml(["A1", "A2"]), { waitUntil: "domcontentloaded" });
await gen.pdf({ path: here("./pdft/a.pdf"), ...pdfOpts });
await gen.setContent(pageHtml(["B1"]), { waitUntil: "domcontentloaded" });
await gen.pdf({ path: here("./pdft/b.pdf"), ...pdfOpts });
await gen.close();

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL_BASE, { waitUntil: "networkidle0" });
const client = await page.target().createCDPSession();
await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: dl });

await page.waitForSelector(".tool-card");
await page.evaluate(() => {
  [...document.querySelectorAll("button")]
    .find((b) => /PDF Toolkit/i.test(b.textContent))
    ?.click();
});
await sleep(1500);

// upload both -> merge (first nav cold-compiles the pdf-lib chunk in dev)
const input = await page.waitForSelector("input[type=file]", { timeout: 40000 });
await input.uploadFile(here("./pdft/a.pdf"), here("./pdft/b.pdf"));
await page.waitForFunction(
  () => document.querySelectorAll(".pdft-page").length === 3,
  { timeout: 20000 }
);

const setName = (name) =>
  page.evaluate((n) => {
    const el = document.querySelector(".pdft-name input");
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set;
    setter.call(el, n);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, name);

async function waitFor(file, timeout = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (existsSync(here(`./pdft/dl/${file}`))) return here(`./pdft/dl/${file}`);
    await sleep(250);
  }
  throw new Error("download not found: " + file + " — saw " + readdirSync(dl));
}
const countPages = async (path) =>
  (await PDFDocument.load(readFileSync(path))).getPageCount();

// 1) MERGE: export all -> 3 pages
await setName("merged");
await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .find((b) => /Export PDF/i.test(b.textContent))
    ?.click()
);
const mergedPages = await countPages(await waitFor("merged.pdf"));

// 2) DELETE one page -> export -> 2 pages
await page.evaluate(() =>
  document.querySelector(".pdft-page .pdft-page-actions .del")?.click()
);
await page.waitForFunction(
  () => document.querySelectorAll(".pdft-page").length === 2,
  { timeout: 5000 }
);
await setName("after-delete");
await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .find((b) => /Export PDF/i.test(b.textContent))
    ?.click()
);
const afterDeletePages = await countPages(await waitFor("after-delete.pdf"));

// 3) SPLIT: select 1 page -> Export selected -> 1 page
await page.evaluate(() => document.querySelector(".pdft-thumb")?.click());
await page.waitForSelector(".pdft-selbar", { timeout: 5000 });
await setName("split");
await page.evaluate(() =>
  [...document.querySelectorAll(".pdft-selbar button")]
    .find((b) => /Export selected/i.test(b.textContent))
    ?.click()
);
const splitPages = await countPages(await waitFor("split-extract.pdf"));

await browser.close();

const ok =
  mergedPages === 3 &&
  afterDeletePages === 2 &&
  splitPages === 1 &&
  errors.length === 0;
console.log(
  JSON.stringify(
    { ok, merge: mergedPages, afterDelete: afterDeletePages, split: splitPages, errors },
    null,
    2
  )
);
process.exit(ok ? 0 : 1);
