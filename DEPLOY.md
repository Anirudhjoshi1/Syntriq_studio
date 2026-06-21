# Deploying Syntriq Studio

Syntriq Studio is a static, client-side PWA — there's no backend, so it deploys
to any static host. **HTTPS is required** for the service worker / "Install" to
work (all the hosts below give you HTTPS automatically).

The app uses the site root as its base path (`scope: "/"`), so deploy it to a
**root domain** (e.g. `syntriq.vercel.app`), not a sub-path.

---

## Option A — Vercel (recommended, easiest)

```bash
npm i -g vercel      # once
vercel               # first run: log in + link the project
vercel --prod        # ship it to your production URL
```

Vercel auto-detects Vite (`vite build` → `dist`). `vercel.json` is already set up
with the SPA fallback + correct `sw.js` cache headers.

## Option B — Netlify

```bash
npm i -g netlify-cli # once
netlify login        # once
npm run build
netlify deploy --prod --dir=dist
```

`netlify.toml` is already configured (publish `dist`, SPA redirect, SW headers).

## Option C — any static host (Cloudflare Pages, GitHub Pages, S3, …)

```bash
npm run build        # outputs the dist/ folder
```

Upload the **contents of `dist/`** to the host.

> GitHub Pages note: project pages live at `username.github.io/repo`, which is a
> sub-path and will break the PWA paths. Either use a custom domain / root site,
> or set `base: "/repo/"` in `vite.config.js` **and** change `start_url`/`scope`
> in the manifest to match.

---

## After deploying

1. Open the HTTPS URL.
2. **Desktop (Chrome/Edge):** click **Install app** in the top bar, or the
   install icon in the address bar.
3. **iPhone (Safari):** Share → **Add to Home Screen**.
4. **Android (Chrome):** menu → **Install app** / **Add to Home screen**.

Once installed it opens like a native app and works **fully offline** — every
tool runs on-device.
