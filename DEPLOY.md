# Deploy LocalEmu to Cloudflare Pages (fix the white screen)

`npm run build` produces **one self-contained file: `dist/index.html`** (all JS and
CSS inlined, ~540 kB). Cloudflare Pages must serve **that file**, not `src/` or the
repository root. A white screen almost always means one of:

1. The deploy uploaded the **repo root or `src/`** instead of `dist/`, so the browser
   receives a 404 page or raw TypeScript it cannot execute.
2. The build **failed** on Cloudflare (wrong build command / Node version), so Pages
   published an empty folder.
3. You opened the file with `file://` or over plain HTTP, where IndexedDB /
   WebCrypto are restricted — always use the `https://….pages.dev` URL.
4. COEP/COOP headers were enabled, which blocks the EmulatorJS core from
   `cdn.emulatorjs.org`.

---

## Option A — Connect the repo in the Cloudflare dashboard (recommended)

1. Push this project to GitHub/GitLab (include `package.json`, `package-lock.json`,
   `vite.config.ts`, `index.html`, `src/`, `public/`).
2. Cloudflare Dashboard → **Workers & Pages** → **Create application** →
   **Pages** → **Connect to Git** → choose the repo.
3. Set exactly:

   | Setting              | Value              |
   | -------------------- | ------------------ |
   | Framework preset     | **Vite**           |
   | Build command        | `npm run build`    |
   | Build output dir     | `dist`             |
   | Root directory       | `/` (leave empty)  |
   | Node version env var | `NODE_VERSION=20`  |

4. Click **Save and Deploy**, wait for the build log to end with
   `✓ built in …` and `dist/index.html … kB`, then open
   `https://localemu.pages.dev` (must be **https**).

## Option B — Upload `dist` directly (no Git)

```bash
npm ci            # or: npm install
npm run build     # must print "✓ built" and create dist/index.html
npx wrangler login
npx wrangler pages deploy dist --project-name=localemu
```

`wrangler.toml` already points `pages_build_output_dir` at `dist`, so
`npx wrangler pages deploy dist` is the whole upload step.

## Option C — Drag-and-drop

Build locally with `npm run build`, then in Cloudflare Pages choose
**Upload assets** and drop the **`dist` folder** (the folder containing
`index.html`, `_headers`, `_redirects`) — not the project root.

---

## Verify the deployment (fast triage)

```bash
curl -I https://localemu.pages.dev/            # expect 200, content-type text/html
curl -s https://localemu.pages.dev/ | head -c 300   # expect <!doctype html> … <title>LocalEmu
```

- **404 / plain text / directory listing** → wrong output directory; redeploy `dist`.
- **200 with the right HTML but still white** → open DevTools (F12) → **Console** and
  read the *first* red error; the app now renders an error card instead of a blank
  screen, with a **Clear session & reload** button if a stale session is at fault.
- **Player area loads but the game never starts** → the EmulatorJS CDN
  (`https://cdn.emulatorjs.org/stable/data/loader.js`) must be reachable; do **not**
  add `Cross-Origin-Embedder-Policy: require-corp`. `public/_headers` already sets
  compatible values and is copied into `dist/` on every build.

## Notes

- `public/_redirects` adds an SPA fallback (`/* /index.html 200`) so deep links work.
- HTTPS on `*.pages.dev` is automatic — required for IndexedDB and WebCrypto
  (account creation, vault, and saves all depend on them).
- After fixing settings, use **Pages → your project → Deployments → Retry deployment**
  (or push a new commit) and hard-refresh the site (Ctrl/Cmd+Shift+R) to bypass cache.
