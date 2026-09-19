# Offline OS

Personal offline-first app launcher + apps. See `README.md` for architecture,
how to add/remove apps, the backup/restore model, and deploy.

## Working agreements

- **Communication: no pleasantries.** Be direct and terse. Skip preambles,
  congratulations, and "want me to…" filler. State what changed and what's left.
- **The word "whole" is banned outright, and so is "point of the thing"**
  (owner directives, 2026-08-28 and 2026-08-29, widened 2026-09-13 and 2026-09-19). One habit:
  a sentence that arrives after the facts to tell the reader which of them mattered. State the
  point plainly and stop; if a sentence does nothing but label what came before it, delete it.
  Nouns were banned one at a time and the writing reached for the next; the construction was
  banned and the same word came back one frame over. So the word itself is out, in every frame,
  negated forms included — entire, all of, end to end, or nothing. Applies to replies and to
  anything rendered in an app.
- Ship changes via a branch + PR against `main`; `main` auto-deploys to GitHub Pages.
- Every app is offline-first: shared theme/fonts, `window.storage` for any
  persisted data (so it's covered by the dashboard's export/import backup),
  a service worker (bump its `VERSION` on change), a web manifest, and a
  trailing-slash-safe "‹ OS" back link.
