# Peace-Battle 2 — the Directory's shape

`directory-shape.json` is work item 1 of issue #47, written down as numbers. The game generates its
147 residents from this and never from the Directory itself.

It is aggregates only — no names, handles, ids, bios, or per-person rows — because a listing reading
CCTV, pharmacology and audio mixing identifies somebody to anybody who has browsed the Directory,
and version 3 put the Directory behind a sign-in for exactly that reason. Place buckets holding
fewer than five people are suppressed rather than printed, and the suppressed totals are reported so
the map grain could be chosen from what is usable rather than from a figure that silently dropped
people.

Pulled 2026-09-14 by one read-only query against production.

## What the numbers say

**Most people hold one skill.** 73 of 147 hold exactly one; the median is 1 and the mean 2.5. Three
hold none. At the other end six people hold nine or more, and between them they account for 83 of
the 367 holdings — nearly a quarter. This is a long tail, not a spread, and a board that gave
everybody two or three skills would not look like the real list at all.

**Most people sit in one sector.** 104 of 147 touch exactly one; only 13 touch three or more. The
clumping table is correspondingly thin — the strongest pair, Creative & Media with Tourism &
Hospitality, occurs four times. So residents should be generated as specialists, with cross-sector
people as the exception.

**The list is not evenly spread across the twenty sectors.** Creative & Media alone is 113 of 367
holdings, 31%, more than Health (66) and Transport & Logistics (32) together. The eight thinnest
sectors hold 25 holdings between them, and Emergency & Reserve Roles, Mining / Extractive and Public
Safety & Justice hold one each.

**Capabilities rest on single people.** 184 distinct skills are held, 28% of the 657 in the taxonomy
on the day this was pulled. Of those 184, **127 are held by exactly one person** — 69%. One skill is
held by 68 people. That spread is the replacement-level input for work item 4, and it is far more
extreme than a guess would have produced.

## The map grain (work item 2)

**Country, not city, and not state.**

The issue asked for the coarsest unit at which no place holds one person, resolved from the numbers
rather than decided in advance. The numbers resolve it:

| Grain | Survives the floor of 5 | Suppressed |
|---|---|---|
| City | Nothing but the two "unspecified" buckets | 70 people across 54 buckets — about 1.3 people per named city |
| State | California 11, Florida 7 (plus unspecified) | 52 people across 32 buckets |
| Country | United States 131, United Kingdom 5 | 11 people across 7 countries |

A city map is not available. Fifty-four named cities hold seventy people between them, so most cities
hold one, and a pin holding one person with one distinctive trade is that person. State is barely
better: two states clear the floor.

**Half the list has no location below the country.** 72 of 147 read "United States / unspecified" —
the state field is empty. That is not a gap to work around; it is the largest single fact about the
Directory's geography, and any map drawn finer than country would be inventing placements for half
the board.

**One correction to the issue's own expectation.** It anticipated "a good number of them are outside
the United States". 131 of 147 are in the United States — 89%. Five are in the United Kingdom and
eleven are spread across seven other countries, none of which clears five people. So the map is the
United States with a thin scatter beyond it, not an international board. The covered-population
figure the issue expected to recompute has to be worked from that.

## The residents and replacement level (work items 3 and 4)

`generate-residents.mjs` rebuilds a 147-person board from the counts above and writes
`residents.json`. Nothing in it reads the Directory. It is deterministic — one fixed seed, no clock
— so the file can be checked rather than re-rolled each build, and it verifies itself against the
source distribution and exits non-zero on any mismatch.

It reproduces all three distributions exactly: the skills-per-person histogram, the
sectors-per-person histogram, and all twenty sector holding totals.

### What the scarcity curve forced

The first version distributed each sector's holdings to whoever had room, and gave Creative & Media
36 members. That is impossible, and the scarcity curve is what proves it. One real skill is held by
68 people, and a skill can only sit in a sector carrying at least 68 holdings — Creative & Media
(113) is the only candidate, because Health has 66. So at least 68 people must hold Creative &
Media: the sector is wide and shallow, not narrow and deep.

Scarcity therefore constrains the sector assignment, not just the skill list. Each sector's biggest
skill sets a floor on how many members it must reach, and the generator now reads that floor first.

Skills are partitioned into sectors largest-first, which lands all 184 exactly against the twenty
holding totals and is what places the 68-holder skill in Creative & Media without anybody choosing
to put it there. That partition is `skillsBySector`, and the floors it implies are
`minHoldersBySector` — the replacement-level input item 4 asked for, read off the real shape rather
than assigned.

### Why the allocation is a flow

Deciding how many skills each person holds in each of their sectors has to satisfy a row total (that
person's skill count) and a column total (that sector's holdings) at the same time. Four greedy
orderings were tried and every one stranded holdings somewhere: serving the hungriest sector starved
the middle of the board, serving the most-constrained person starved the small sectors. That is not
bad luck with the ordering — no single pass satisfies both sums.

It is solved as a max-flow instead: source to each person with their spare skills, person to each of
their sectors, each sector to the sink with what it still needs. A saturating flow is a valid
allocation, and it finds one if any exists.

### The board that comes out

- 147 residents, 367 holdings, 208 person-sector places.
- Creative & Media reaches 68 people, its floor exactly.
- Places are country grain: 72 in the United States with no state given, 41 elsewhere in the United
  States, 11 in California, 7 in Florida, 5 in the United Kingdom, 11 outside both.
- Names are invented from common given names and surnames. With 147 residents a coincidental match
  with a real person is possible; it would be a coincidence, because no name, place or skill was read
  from a row.

## What this does not settle

The generated residents (item 3) and replacement level (item 4) follow from these numbers directly.
The year loop (item 5) and its tuning (item 6) do not, and are still ahead.
