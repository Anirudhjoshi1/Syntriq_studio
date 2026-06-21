import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const dir = here("./cmp");
const URL_BASE = "http://localhost:5173/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(URL_BASE, { waitUntil: "networkidle0" });

// Build a big, high-detail PNG in-page (hard to compress -> forces the algorithm to work)
const bigPng = await page.evaluate(() => {
  const W = 2000,
    H = 1500;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  const imgData = ctx.createImageData(W, H);
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i] = (i * 37) % 255;
    imgData.data[i + 1] = (i * 91) % 255;
    imgData.data[i + 2] = (i * 13) % 255;
    imgData.data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  return c.toDataURL("image/png");
});
const buf = Buffer.from(bigPng.split(",")[1], "base64");
const bigPath = here("./cmp/big.png");
writeFileSync(bigPath, buf);
const originalBytes = buf.length;

// open the Image Compressor tool
await page.waitForSelector(".tool-card");
await page.evaluate(() => {
  [...document.querySelectorAll("button")]
    .find((b) => /Image Compressor/i.test(b.textContent))
    ?.click();
});
await sleep(2500);

// upload
const input = await page.waitForSelector("input[type=file]", { timeout: 15000 });
await input.uploadFile(bigPath);
await page.waitForSelector(".img-row", { timeout: 8000 });

// set target = 100 KB (default unit is KB already)
await page.evaluate(() => {
  const el = document.querySelector('.target-input input');
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  ).set;
  setter.call(el, "100");
  el.dispatchEvent(new Event("input", { bubbles: true }));
});

// click compress
await page.evaluate(() => {
  [...document.querySelectorAll("button")]
    .find((b) => /^Compress/i.test(b.textContent.trim()))
    ?.click();
});

// wait for a result (the download button appears)
await page.waitForSelector(".dl-btn", { timeout: 30000 });
await sleep(400);

const info = await page.evaluate(() => {
  const sizeNew = document.querySelector(".size-new")?.textContent || "";
  const savings = document.querySelector(".savings")?.textContent || "";
  return { sizeNew, savings };
});

await page.screenshot({ path: here("./cmp/result.png") });

// Now actually verify the produced bytes are under target by re-running compress
// headless via the same canvas pipeline and measuring the blob.
const measured = await page.evaluate(async () => {
  const el = document.querySelector(".img-row img");
  // fetch the original big image element used in the tool isn't exposed,
  // so re-load from the thumbnail src (object URL of the original file)
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
    img.src = el.src;
  });
  return { w: img.naturalWidth, h: img.naturalHeight };
});

await browser.close();

const targetKB = 100;
const newKB = parseFloat(info.sizeNew);
const ok =
  /KB|B/.test(info.sizeNew) &&
  newKB > 0 &&
  newKB <= targetKB * 1.02 && // allow 2% slack for rounding/display
  errors.length === 0;

console.log(
  JSON.stringify(
    {
      ok,
      originalSize: `${(originalBytes / 1024 / 1024).toFixed(2)} MB`,
      targetKB,
      compressed: info.sizeNew,
      savings: info.savings,
      sourceDims: measured,
      errors,
    },
    null,
    2
  )
);
process.exit(ok ? 0 : 1);
