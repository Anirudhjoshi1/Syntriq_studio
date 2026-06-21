import puppeteer from "puppeteer";
import { fileURLToPath } from "node:url";

const pub = (p) => fileURLToPath(new URL("../public/" + p, import.meta.url));

const GRAD = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c5cff"/>
      <stop offset="0.5" stop-color="#4d9fff"/>
      <stop offset="1" stop-color="#37e6c0"/>
    </linearGradient>
  </defs>`;

const GLYPH = `
  <path d="M22 40l7-9 5 6 4-5 6 8z" fill="white"/>
  <circle cx="24" cy="24" r="4" fill="white"/>`;

// rounded, transparent-corner icon (for regular + apple)
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  ${GRAD}
  <rect x="6" y="6" width="52" height="52" rx="15" fill="url(#g)"/>
  <rect x="6" y="6" width="52" height="52" rx="15" fill="white" opacity="0.07"/>
  ${GLYPH}
</svg>`;

// full-bleed icon for maskable (platform applies its own mask)
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  ${GRAD}
  <rect x="0" y="0" width="64" height="64" fill="url(#g)"/>
  <g transform="translate(32 32) scale(0.78) translate(-32 -32)">${GLYPH}</g>
</svg>`;

const targets = [
  { file: "pwa-192x192.png", size: 192, svg: rounded, transparent: true },
  { file: "pwa-512x512.png", size: 512, svg: rounded, transparent: true },
  { file: "apple-touch-icon.png", size: 180, svg: maskable, transparent: false },
  { file: "maskable-512x512.png", size: 512, svg: maskable, transparent: false },
];

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();

for (const t of targets) {
  await page.setViewport({ width: t.size, height: t.size, deviceScaleFactor: 1 });
  const html = `<!doctype html><html><body style="margin:0;width:${t.size}px;height:${t.size}px">
    <div style="width:${t.size}px;height:${t.size}px">
      ${t.svg.replace("<svg ", `<svg width="${t.size}" height="${t.size}" `)}
    </div></body></html>`;
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  const el = await page.$("div");
  await el.screenshot({ path: pub(t.file), omitBackground: t.transparent });
  console.log("wrote", t.file, `${t.size}x${t.size}`);
}

await browser.close();
