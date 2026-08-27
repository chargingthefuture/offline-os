# Offline OS

A personal, offline-first daily-driver OS: a dashboard that launches a set of
small apps. Built to spin tools up fast and ditch the ones that don't earn
their keep.

- **Monorepo** — every app is a folder. New tool = new folder + one line in
  `apps.json`. Kill a tool = delete the folder + remove its line.
- **Offline-first** — each app is an installable PWA with a service worker, so
  it opens with zero network once visited.
- **Shared design system** — the sodium-amber look lives in `shared/theme.css`;
  every app inherits it.
- **Link by URL** — the dashboard is just a registry of links. An app can live
  here as a subfolder *or* on its own host (Vercel, Fly, another GitHub Pages
  repo) — the dashboard doesn't care.

## Layout

```
offline-os/
  index.html              dashboard / launcher (a PWA itself)
  apps.json               the app registry
  manifest.webmanifest    dashboard PWA manifest
  sw.js                   dashboard service worker
  shared/
    theme.css             design tokens + shared components
    storage.js            localStorage layer + export/import
    pwa.js                service-worker registration helper
    icons/                app icons
  apps/
    roadwork/             first tile — a hand-written app
      index.html  sw.js  manifest.webmanifest
    chess/                BUILT output — do not edit by hand (see sources/chess)
    vox/                  BUILT output — do not edit by hand (see sources/vox)
    cascade/              falling-blocks puzzle (hand-written, like the others)
    glowline/             neon arcade racer (ships its own icons + manifest)
    glowline2/            neon maze racer (ships its own icons + manifest)
    redline/              speed platformer (ships its own icons + manifest)
  sources/
    chess/                Chess source (Vite + React); `npm run build` here
                          writes the deployable app to apps/chess/
    vox/                  Vox source (Vite + Phaser); same build flow, output
                          goes to apps/vox/
```

## Adding an app

1. Create `apps/<name>/index.html`. In its `<head>` link the shared theme and
   add the PWA tags (copy from `apps/roadwork/index.html`).
2. Use `window.storage.get/set` for persistence (provided by
   `shared/storage.js`) so it's covered by backup/restore.
3. Give it a `manifest.webmanifest` and `sw.js` (copy Roadwork's, change the
   `VERSION` string and the file list).
4. Add an entry to `apps.json`:

```json
{ "name": "My Tool", "blurb": "what it does", "url": "apps/my-tool/", "icon": "🛠", "status": "experimental" }
```

`status` is one of `active`, `experimental`, or `external`.

### Apps built from source (Chess, Vox)

Most apps are hand-written static files. Chess (Vite + React) and Vox
(Vite + Phaser) are the exceptions: their sources live in `sources/chess/` and
`sources/vox/`, and their **built output is committed** at `apps/chess/` and
`apps/vox/`, so GitHub Pages still serves the repo as-is with no build step.
To change either:

1. Edit the source in `sources/<name>/`.
2. From `sources/<name>/`, run `npm install` once, then `npm run build` — it
   type-checks and writes the app to `apps/<name>/` (wiping it first).
3. Commit both the source change and the regenerated `apps/<name>/` files.

Never edit `apps/chess/` or `apps/vox/` by hand; the next build overwrites
them. Chess engine rules (Stockfish worker + wasm naming, two-worker setup)
are in `sources/chess/CLAUDE.md`; Vox's own agent rules are in
`sources/vox/AGENTS.md`.

### Linking external apps / your games

An app can also live in its own repo on GitHub Pages (as some still do).
Just add it to the registry with a full URL:

```json
{ "name": "Some Game", "blurb": "...", "url": "https://chargingthefuture.github.io/some-game/", "icon": "🎮", "status": "external" }
```

External links open in a new tab; internal ones navigate in place.

## Where your data lives (read this)

Apps store data in **`localStorage`**, on the device, scoped to this site's
origin. That means:

- It is **not** in iCloud and does **not** sync.
- **iOS can evict it** under storage pressure, and "Clear History and Website
  Data" wipes it. A lost or wiped phone loses it.

So back up. The dashboard's **Data & backup** card has:

- **Export all** — downloads one JSON file containing every app's data. On
  iPhone, save it to **Files → iCloud Drive** (that copy *is* backed up).
- **Import…** — reads a backup file and restores it (merges into current data).

> Exception: the ported games (Chess, Cascade, Glowline, Glowline 2, Redline,
> Vox) keep their original storage keys (`chesscoach:*`, `cascade.best`,
> `glowline2.*`, …) rather than `window.storage`, so their saved settings,
> best times, and world progress are **not** in the export file. The games were
> left untouched; Vox also has its own save-code feature for carrying progress
> across devices.

**Recovery flow after a new/wiped phone:** open the dashboard, install it to the
home screen, tap **Import…**, pick the JSON from iCloud Drive — every app is
restored. Make exporting to iCloud Drive a periodic habit.

## Running locally

Service workers need to be served over http (not `file://`). From the repo root:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Fonts

Fonts (Inter + Barlow Semi Condensed, latin subset) are **self-hosted** in
`shared/fonts/` and declared in `shared/fonts.css` — no Google Fonts request,
so the OS renders correctly fully offline from the very first load. The service
workers precache the woff2 files. To change weights/subsets, re-run the
generator and bump the service-worker `VERSION` strings.

## Deploying

GitHub Pages serves the repo root as-is (no build). `.github/workflows/pages.yml`
deploys on every push to `main` (and can be run manually via the Actions tab).

One-time setup: in the repo, **Settings → Pages → Build and deployment →
Source: GitHub Actions**. After that, the dashboard lives at the repo's Pages
URL and each app at `/<repo>/apps/<name>/`.

> The workflow deploys from `main`. Development happens on a feature branch, so
> merge to `main` (or trigger the workflow manually) to publish.
