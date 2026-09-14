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

## What this does not settle

The generated residents (item 3) and replacement level (item 4) follow from these numbers directly.
The year loop (item 5) and its tuning (item 6) do not, and are still ahead.
