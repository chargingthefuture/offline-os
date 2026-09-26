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

## No PR watching (owner directive, 2026-09-26)

Never watch a pull request. After opening one, do not subscribe to its activity, do not schedule a check-in, and do not wait for its checks to finish. Report once and stop. The harness may subscribe a session to every pull request it opens on its own; unsubscribe straight away.

Watching fills the session with GitHub notices and full check lists, which brings on compaction sooner, and a compacted session loses what the owner said earlier. The owner merges from their phone and sees the checks there. Checks run locally before every push are what keep a pull request from going red; when the owner wants to know where open pull requests stand, they ask, and the agent makes one pass over them, not a watch.

## Keep sessions from filling up (owner directive, 2026-09-26)

Everything an agent reads stays in the session until compaction, and compaction swaps the earlier conversation for a summary. So spend the session on the owner's words, not on raw output.

- Hand broad searches to a helper agent that returns only its conclusion. Anything that means reading across several files or directories to answer one question goes to a helper; a single lookup in a known file is done directly.
- Read only the part of a file the task needs, by line range or search, not entire files.
- Read only failed checks and the failing part of a log. Never pull a full list of passing checks or a full log to confirm something is green.
- Take a screenshot only when a visual change has to be checked, and look at it once.

The owner can also compact on their own terms: typing `/compact` followed by what to keep (for example, `/compact keep the open PR list and today's rules`) compacts at a moment they choose, with their instructions shaping the summary. `/clear` starts the session over. Rules that must outlive any session go in this file, not in chat.
