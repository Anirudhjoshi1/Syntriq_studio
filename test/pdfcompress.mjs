import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";
import { rmSync, mkdirSync, statSync } from "node:fs";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const dir = here("./pdfc");
const bigPdf = here("./pdfc/big.pdf");
const URL_BASE = "http://localhost:5173/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });

// 1) Build a large, hard-to-compress multi-page PDF on a throwaway page
const gen = await browser.newPage();
await gen.goto("about:blank");
const dataUrls = await gen.evaluate((count) => {
  const urls = [];
  for (let k = 0; k < count; k++) {
    const W = 1100,
      H = 1500;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    const im = ctx.createImageData(W, H);
    for (let i = 0; i < im.data.length; i += 4) {
      im.data[i] = (i * (k + 7)) % 255;
      im.data[i + 1] = (i * 13) % 255;
      im.data[i + 2] = (i * 29) % 255;
      im.data[i + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
    urls.push(c.toDataURL("image/png"));
  }
  return urls;
}, 3);

const html = `<html><body style="margin:0;padding:0">${dataUrls
  .map(
    (u) =>
      `<div style="page-break-after:always"><img src="${u}" style="display:block;width:100%"/></div>`
  )
  .join("")}</body></html>`;
await gen.setContent(html, { waitUntil: "networkidle0" });
await gen.pdf({ path: bigPdf, printBackground: true, width: "1100px", height: "1500px" });
await gen.close();
const originalBytes = statSync(bigPdf).size;

// 2) Drive the app on a fresh page: open PDF Compressor, upload, target 200 KB
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(URL_BASE, { waitUntil: "networkidle0" });
await page.waitForSelector(".tool-card");
await page.evaluate(() => {
  [...document.querySelectorAll("button")]
    .find((b) => /PDF Compressor/i.test(b.textContent))
    ?.click();
});
await sleep(2500);

const input = await page.waitForSelector("input[type=file]", { timeout: 15000 });
await input.uploadFile(bigPdf);
await page.waitForSelector(".pdfc-card", { timeout: 15000 });

// target = 30 KB — comfortably below the source, so real compression must happen
const targetKB = 50;
await page.evaluate((kb) => {
  const el = document.querySelector(".target-input input");
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  ).set;
  setter.call(el, String(kb));
  el.dispatchEvent(new Event("input", { bubbles: true }));
}, targetKB);

const pageCount = await page.$eval(".pdfc-meta", (el) => el.textContent);

await page.evaluate(() => {
  [...document.querySelectorAll("button")]
    .find((b) => /Compress PDF/i.test(b.textContent))
    ?.click();
});

await page.waitForSelector(".size-new", { timeout: 90000 });
await sleep(400);
const info = await page.evaluate(() => ({
  sizeNew: document.querySelector(".size-new")?.textContent || "",
  savings: document.querySelector(".savings")?.textContent || "",
  warn: document.querySelector(".pdfc-warn")?.textContent || "",
  hasDownload: !!document.querySelector(".pdfc-dl"),
}));
await page.screenshot({ path: here("./pdfc/result.png") });

await browser.close();

const newKB = parseFloat(info.sizeNew);
const ok =
  info.hasDownload &&
  /KB|B/.test(info.sizeNew) &&
  newKB > 0 &&
  newKB <= targetKB * 1.05 &&
  /−\d+%/.test(info.savings) && // genuine reduction
  !info.warn &&
  errors.length === 0;

console.log(
  JSON.stringify(
    {
      ok,
      originalKB: (originalBytes / 1024).toFixed(0) + " KB",
      pages: pageCount,
      targetKB,
      compressed: info.sizeNew,
      savings: info.savings,
      warn: info.warn || "(target reached)",
      errors,
    },
    null,
    2
  )
);
process.exit(ok ? 0 : 1);
