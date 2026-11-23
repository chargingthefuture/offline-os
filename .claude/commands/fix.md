---
description: A sentence reads badly. Rewrite it and push. Do not explain why it was wrong.
---

The owner has pointed at a sentence — usually as a screenshot with a highlight and a short remark
like "reads weird", "doesn't read right", or nothing at all beyond `$ARGUMENTS`. The sentence is
awkward, tangled, or hard to parse. Rewrite it.

This command exists because agents answer that pointing with an essay. The owner reads on a phone,
types on a phone, and runs on limited usage. An explanation of why a sentence was bad costs them
the thing they are short of and gives them nothing they did not already know — they could see it
was bad, which is why they sent it.

**The argument is not in question.** A `/fix` is about how a sentence reads, not about whether it
is right. Do not revisit the claim, do not re-argue the point, do not widen the change. If the
underlying claim actually is wrong, that is a different conversation and the owner will say so.

## 1. Find the sentence

Identify the exact text from the screenshot or the quote. It may be in an app's page, its
`manifest.webmanifest`, an `apps.json` blurb, the README, or a rule file. Read the surrounding
paragraph so the replacement fits what comes before and after it.

## 2. Rewrite it

Keep every fact, figure, name, link and claim exactly as it was. Change only the wording.

What usually needs undoing:

- A double negative, or a negation a reader has to unpick ("needs nothing unexplained").
- A reference that makes a reader count or look elsewhere ("the last post but one", "the third
  one", "the former"). Name the thing.
- A clause stack that has to be re-read to find the subject.
- An abstraction where a plain word exists.
- A sentence carrying three ideas. Split it.

Keep the house voice: plain words, short sentences, no jargon, no filler, and none of the banned
vocabulary in `CLAUDE.md`.

## 3. Sweep the same sentence everywhere else

The same wording is often in more than one place: the app's page, its manifest description, its
`apps.json` blurb, the README. Fix every copy in the same commit. For an app built from `sources/`,
edit the source and rebuild rather than editing the built files.

If the same construction appears in other apps, say so in one line at the end and leave it alone
unless the owner asks.

## 4. Verify and push

Run the checks in `/br` step 3 (files parse, the changed app opens with no page errors, bump its
service worker `VERSION`). Then:

- If the text is on an open PR's branch, commit and push there.
- If it is already merged, branch (`fix/<short-description>`), commit, push, open the PR with the
  title and body set at creation.

Do not watch the PR (owner directive, 2026-09-26): no subscription to its activity, no scheduled
check-in, no waiting for CI. The checks above are what keep it green. Watching fills the session with
notices and check lists, which brings on compaction sooner.

## 5. Reply in two lines

Say what changed and show the new sentence. Nothing else.

- ✅ "Fixed and pushed. The blurb now reads: <new sentence>"
- ❌ A paragraph on what was wrong with the old one.
- ❌ Restating the rule the old sentence broke.
- ❌ Asking whether the new one is better.

A one-line note about where else the same construction appears is fine. An explanation of the
original defect is not.
