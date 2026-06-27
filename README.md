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
    gut-check/            first app
      index.html  sw.js  manifest.webmanifest
```

## Adding an app

1. Create `apps/<name>/index.html`. In its `<head>` link the shared theme and
   add the PWA tags (copy from `apps/gut-check/index.html`).
2. Use `window.storage.get/set` for persistence (provided by
   `shared/storage.js`) so it's covered by backup/restore.
3. Give it a `manifest.webmanifest` and `sw.js` (copy Gut Check's, change the
   `VERSION` string and the file list).
4. Add an entry to `apps.json`:

```json
{ "name": "My Tool", "blurb": "what it does", "url": "apps/my-tool/", "icon": "🛠", "status": "experimental" }
```

`status` is one of `active`, `experimental`, or `external`.

### Linking external apps / your games

Your offline games already live in their own repos on GitHub Pages — leave them
there. Just add them to the registry with a full URL:

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

**Recovery flow after a new/wiped phone:** open the dashboard, install it to the
home screen, tap **Import…**, pick the JSON from iCloud Drive — every app is
restored. Make exporting to iCloud Drive a periodic habit.

## Running locally

Service workers need to be served over http (not `file://`). From the repo root:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Deploying

Intended for GitHub Pages serving the repo root. A `.github/workflows/pages.yml`
is a planned follow-up; once Pages is enabled for the repo, the dashboard lives
at the repo's Pages URL and each app at `/<repo>/apps/<name>/`.
