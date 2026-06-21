import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, readdirSync, rmSync, mkdirSync } from "node:fs";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const docxPath = here("./sample.docx");
const downloadDir = here("./downloads");
const URL_BASE = "http://localhost:5173/";

rmSync(downloadDir, { recursive: true, force: true });
mkdirSync(downloadDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

await page.goto(URL_BASE, { waitUntil: "networkidle0" });

// enable downloads to our dir
const client = await page.target().createCDPSession();
await client.send("Page.setDownloadBehavior", {
  behavior: "allow",
  downloadPath: downloadDir,
});

// open the Word -> PDF tool via the sidebar / card
await page.waitForSelector(".tool-card");
const opened = await page.evaluate(() => {
  const els = [...document.querySelectorAll("button")];
  const el = els.find((b) => /Word\s*→?\s*PDF|Word to PDF/i.test(b.textContent));
  if (el) {
    el.click();
    return true;
  }
  return false;
});
if (!opened) throw new Error("Could not find the Word → PDF tool button");

// the tool is lazy-loaded behind a view transition — let it mount
await sleep(2500);

// upload the docx
const input = await page.waitForSelector("input[type=file]", { timeout: 15000 });
await input.uploadFile(docxPath);

// wait for the faithful render to produce page sections
await page.waitForSelector(".docx-wrapper > section", { timeout: 15000 });
const pageCount = await page.$$eval(
  ".docx-wrapper > section",
  (s) => s.length
);

// sanity-check that real formatting made it into the DOM (colored text, table)
const renderInfo = await page.evaluate(() => {
  const host = document.querySelector(".docx-host");
  const tables = host.querySelectorAll("table").length;
  const text = host.innerText;
  // any element with a non-default (non-black) inline-ish color?
  const colored = [...host.querySelectorAll("*")].some((el) => {
    const c = getComputedStyle(el).color;
    return c && c !== "rgb(0, 0, 0)" && c !== "rgb(27, 27, 31)";
  });
  return {
    tables,
    colored,
    hasHeading: /Quarterly Study Report/.test(text),
    hasTableData: /Mathematics/.test(text) && /Physics/.test(text),
  };
});

// screenshot the faithful preview for visual inspection
const host = await page.$(".docx-host");
if (host) await host.screenshot({ path: here("./preview.png") });

// click Convert
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) =>
    /Convert to PDF/i.test(x.textContent)
  );
  if (b) {
    b.click();
    return true;
  }
  return false;
});
if (!clicked) throw new Error("Convert button not found");

// wait for the PDF file to land
let pdfFile = null;
for (let i = 0; i < 40; i++) {
  const files = existsSync(downloadDir)
    ? readdirSync(downloadDir).filter((f) => f.endsWith(".pdf"))
    : [];
  if (files.length) {
    pdfFile = here("./downloads/" + files[0]);
    break;
  }
  await sleep(500);
}

await browser.close();

// report
const result = { pageCount, ...renderInfo, errors };
if (!pdfFile) {
  console.log(JSON.stringify({ ok: false, reason: "no pdf produced", ...result }, null, 2));
  process.exit(1);
}
const bytes = readFileSync(pdfFile);
const isPdf = bytes.slice(0, 5).toString() === "%PDF-";
console.log(
  JSON.stringify(
    {
      ok: isPdf && pageCount >= 1,
      pdf: pdfFile.split("/").pop(),
      pdfBytes: bytes.length,
      isPdf,
      ...result,
    },
    null,
    2
  )
);
process.exit(isPdf && pageCount >= 1 ? 0 : 1);
