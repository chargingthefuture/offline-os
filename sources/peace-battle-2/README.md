# Peace-Battle 2 — the numbers it runs on

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

## The year (work item 5)

`read-opening-board.mjs` settles what a year contains and writes `opening-board.json`, which is what
the headless loop in item 6 reads. Item 5 asks four things, and three of them are decisions while one
is a reading, so the script keeps them apart: the decisions are named constants with the reason
beside each, and everything else is computed from the generated board.

### What a year contains

A year carries three actions against four kinds of action. The count is one short of the menu on
purpose — every year drops something, so a year is a choice rather than a checklist. Fifty years of
three is a hundred and fifty decisions, which is the map game's sitting stretched over a longer board
rather than a different kind of session.

A generation is twenty-five years and the run ends after two. The issue asked for forty to fifty
turns; fifty is the top of that range, and since it is the loss condition it is the number that has
to be beatable rather than comfortable.

The four kinds, none of which commands a person:

| Action | What the player decides |
|---|---|
| Reach | Where the Directory reaches. Extends it into a place, or pushes isolation back out of one. |
| Teach | What gets taught. Pick a sector; residents in reach learn skills in it. |
| Look | Who gets looked for. Pulls from the pool of people not on the Directory into a place. |
| Show the arithmetic | Answers the people who say it cannot be done, so more of the people found stay findable. |

Teach is the only one that can aim at a skill nobody holds. Look finds skills by luck; teach fills
them on purpose. The arithmetic below is what makes that distinction load-bearing rather than
flavor.

### What resolves on its own

After the actions are spent, in this order: residents work and the settled index climbs by what
settled; open posts are counted and the projected figure moves with them; teaching started this year
lands, with the dice choosing which skills inside the sector that was taught; people looked for
arrive, with the dice choosing who turns up and what they already hold; unavailability is rolled;
isolation spreads and a place already at the top cuts off and takes the places beside it; detractor
pressure moves, down if results became visible this year and up if nothing did; places are
re-checked against the thirteen teams; then milestones and the two end conditions.

Every roll in that list chooses which and when. None of them chooses whether.

### Which slots a place has to fill before it runs

Thirteen teams, each a named union of taxonomy sectors, taken from
`ctf/packages/web/lib/workforce/community-planning.ts` in the product repository. They were
transcribed from the owner's planning document and then widened on purpose to cover a settlement that
has to stand on its own rather than buy water, power, schooling and courts from outside. Every one of
the twenty sectors is drawn from by at least one team, which the script checks.

A place runs when every one of the thirteen has somebody findable in it. That is the
un-substitutable-slot mechanic with no invented ranking anywhere in it — the list of jobs a place
cannot run without was already written down, so none of it had to be made up here.

### What the opening board says

One of the six places runs. The largest, the seventy-two people whose Directory rows carry no state,
covers all thirteen teams. The other five do not: the United Kingdom is missing nine of them,
Florida seven, California six.

The teams are wildly uneven, and the thin end is thinner than any guess would have made it:

| Team | People on the whole board |
|---|---|
| Communications & Documentation | 68 |
| Health & Wellbeing | 37 |
| Operations & Maintenance | 36 |
| Finance | 22 |
| Build & Infrastructure | 15 |
| Technology | 14 |
| Land & Site | 13 |
| Legal & Governance | 12 |
| Food & Agriculture | 11 |
| Making & Repair | 8 |
| Safety & Security | 2 |
| Education & Childcare | 2 |
| Water & Sanitation | 1 |

That column is replacement level at team grain — how many people stand behind the one doing the job
— and it is read off the shape rather than assigned. One person on the entire board can staff Water
& Sanitation. The one place that runs rests on a single person for three of its thirteen teams:
Safety & Security, Water & Sanitation, and Education & Childcare. So the year the unavailability roll
takes any one of those three, the only running place on the board stops running.

### How long the catalog takes

The opening board says how often a new holding is a skill nobody holds. 127 of the 184 held skills
are held by exactly one person, and that count over the 367 holdings — about a third — is the
Good-Turing estimate of the chance the next holding is new. That rate falls as the catalog fills, so
the model is the measured rate scaled by how much of the catalog is left, and integrating it gives
the holdings a run needs.

| Catalog reaches | Extra holdings | Extra people | People a year over fifty years |
|---|---|---|---|
| 591 of 657 (90%) | 2,692 | 1,078 | 22 |
| 650 of 657 (99%) | 5,759 | 2,307 | 46 |
| 656 of 657 | 8,419 | 3,372 | 67 |

Breadth comes fast and the thin end does not. Nine tenths of the catalog needs twenty-two people a
year; the last six cost nearly as much as the first four hundred and seven. And the 657th never
arrives at all under recruitment alone, because the chance of drawing the one skill nobody has goes
to zero as the catalog fills. Teaching is what closes that tail, which is why the player picks what
gets taught and the dice do not.

At sixty-seven people a year the signed-up goal of 384 lands in year four, which is the early
milestone the issue expected.

Two things fall out of the same table. A run that fills the catalog does it with about three and a
half thousand people, against a participating population of two and a half million — three orders of
magnitude below the ceiling. So the index figure the economy is aimed at belongs to the whole
population and not to a board this size, and a run that reached every skill would still report an
index nowhere near it. Reporting the index at the end rather than requiring it is the only way that
is not a lie.

### The covered-population figure

The sixteen-city map totalled 30,570,000 real city populations. This board is not cities, and the
population it is for is the survivor population the economy is aimed at, so the five million is
apportioned across the six places by where the Directory's own people are.

| Place | Residents | Stands for |
|---|---|---|
| United States, state not given | 72 | 2,448,980 |
| United States, elsewhere | 41 | 1,394,558 |
| Outside the US and UK | 11 | 374,150 |
| United States, California | 11 | 374,150 |
| United States, Florida | 7 | 238,095 |
| United Kingdom | 5 | 170,068 |

The board totals five million rather than the sixteen-city map's thirty, and the script fails
if it does not.

## What this does not settle

The generated residents (item 3), replacement level (item 4) and the year (item 5) follow from these
numbers. What is left is magnitudes that only a tuning pass can set: how much a single action moves,
how fast isolation spreads against a fifty-year clock rather than a thirteen-round one, what an
unavailability roll costs, and how much a detractor takes off the join-and-stay rate. Those are items
6 and 8, and none of them can be guessed from the opening board — they have to be swept over seeds
against a careful player and a careless one.
