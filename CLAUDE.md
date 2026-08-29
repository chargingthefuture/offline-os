# Offline OS

Personal offline-first app launcher + apps. See `README.md` for architecture,
how to add/remove apps, the backup/restore model, and deploy.

## Working agreements

- **Communication: no pleasantries.** Be direct and terse. Skip preambles,
  congratulations, and "want me to…" filler. State what changed and what's left.
- **No "whole point" or "whole argument"** (owner directive, 2026-08-28). Both are the
  same habit: a sentence that arrives after the facts to tell the reader which of them
  mattered. State the point plainly and stop; if a sentence does nothing but label what
  came before it, delete it. Applies to replies and to anything rendered in an app.
- Ship changes via a branch + PR against `main`; `main` auto-deploys to GitHub Pages.
- Every app is offline-first: shared theme/fonts, `window.storage` for any
  persisted data (so it's covered by the dashboard's export/import backup),
  a service worker (bump its `VERSION` on change), a web manifest, and a
  trailing-slash-safe "‹ OS" back link.
