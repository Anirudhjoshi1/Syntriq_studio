# Syntriq Studio

A private, on-device study toolkit — a clean dashboard of fast file tools that
run **entirely in your browser**. Nothing you open or create ever leaves your
device. Installable as an app, works fully offline.

## Tools

| Tool | What it does |
|------|--------------|
| **Images → PDF** | Merge photos & scans into one PDF (drag to reorder, page-size/margin options) |
| **Word → PDF** | Convert `.docx` to PDF with a true-to-Word, page-for-page render |
| **Image Compressor** | Shrink images to an exact KB/MB target (JPEG/WebP) |
| **PDF Compressor** | Shrink a PDF to a target KB/MB |

More tools (Focus Timer, Flashcards, Notes, PDF Toolkit, …) are stubbed on the
dashboard and coming next.

## Features

- **5 themes** — Professional (flat white, default), Liquid Glass, Midnight,
  Aurora, Nebula. Switch in **Settings**; choice is remembered.
- **PWA** — install to your home screen / desktop, works offline.
- **100% client-side** — no backend, no uploads, no tracking.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build & deploy

```bash
npm run build    # outputs dist/
npm run preview  # preview the production build locally
```

See **[DEPLOY.md](./DEPLOY.md)** for one-command deploys to Vercel / Netlify /
any static host.

## Tech

React 19 · Vite · Framer Motion · jsPDF · pdf.js · docx-preview · mammoth ·
vite-plugin-pwa (Workbox).

## Tests

End-to-end checks (Puppeteer) live in [`test/`](./test) — they drive the real UI
to verify each tool, the theme switcher, and the PWA offline behaviour.
