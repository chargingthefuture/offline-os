// The event deck. Work item 3 of issue #47.
//
// A year arrives as a situation with names in it and a choice whose cost is visible before it is
// made, rather than as four buttons and a counter row. That was the whole complaint about the build
// this replaces, and the deck is the answer to it.
//
// Every card is built from live state: the people are the board's people, the places are open
// places, and the figures are read rather than written. A card that could be printed before the run
// started would be decoration.

// --- What a scheme does here -----------------------------------------------------------------------
//
// Schemes act on coordination. A link stops working, a place stops being reachable, somebody stops
// being findable, a skill leaves the catalog with them. They never act on a character: no incidents,
// no harassment events, no raids, nothing done to a person shown on a screen.
//
// The slugs and labels below are the canonical ClickLog list, copied rather than invented, and only
// the ones whose real effect is on coordination are here. The bodily and personal ones are not in
// this deck and are not to be added to it.
//
// The label is never on the card face. It sits behind a disclosure — item 7 — because somebody
// should be able to play without reading the name of a method they have lived through, and because
// ClickLog's scheme tags mark real incidents and are evidence. The effect is what the card shows.
export const SCHEMES = [
  { slug: 'engineered-delay', label: 'The Engineered Delay' },
  { slug: 'altered-ticket', label: 'The Altered Ticket' },
  { slug: 'mail-mirage', label: 'The Mail Mirage' },
  { slug: 'acquire-and-fold', label: 'The Acquire and Fold' },
  { slug: 'fake-job', label: 'The Fake Job' },
  { slug: 'psyop-marketing', label: 'Psyop Marketing' },
  { slug: 'conspiracy-carousel', label: 'The Conspiracy Carousel' },
  { slug: 'poisoned-well', label: 'The Poisoned Well' },
  { slug: 'insurance-bleed', label: 'The Insurance Bleed' },
  { slug: 'forced-homecoming', label: 'The Forced Homecoming' },
  { slug: 'staged-narratives', label: 'Staged Narratives / Loud "Podcasts"' },
  { slug: 'incident-replay', label: 'The Replay' },
];

const scheme = (slug) => SCHEMES.find((x) => x.slug === slug);

// Named apart from the loop's own helper: both files end up in one scope inside the app bundle.
const pickOne = (rng, list) => list[Math.floor(rng() * list.length)];
const num = (n) => Math.round(n).toLocaleString('en-US');

// --- Reading the board for a card --------------------------------------------------------------------

function liveplaces(s) {
  return s.places.filter((p) => !p.cutOff);
}

function nameOf(s, resident) {
  return resident.name ?? resident.id;
}

function soleHolders(s, api) {
  const depth = api.skillDepth(s);
  const findable = api.findableResidents(s);
  const out = [];
  for (const [skillId, held] of depth) {
    if (held !== 1) continue;
    const holder = findable.find((r) => r.skills.has(skillId));
    if (holder) out.push({ skillId, holder, sector: skillId.split('#')[0] });
  }
  return out;
}

// --- The cards -----------------------------------------------------------------------------------
//
// Each one says when it can be drawn, and builds itself from the board. A choice carries the cost it
// will take, written out, because a decision whose price is invisible is not a decision.

export function buildDeck(api) {
  const { findableResidents, skillDepth, teachingCapacity, placesThatRun, teamsMissingFor, components } = api;

  return [
    // --- Ordinary years ---------------------------------------------------------------------------
    {
      id: 'thick-and-thin',
      kind: 'ordinary',
      when: (s) => findableResidents(s).length > 20,
      build: (s) => {
        const findable = findableResidents(s);
        const sectors = Object.keys(s.skillsBySector);
        const scored = sectors.map((sector) => ({
          sector,
          teachers: findable.filter((r) => r.sectors[sector]).length,
          capacity: teachingCapacity(s, sector, findable),
          missing: api.missingInSector(s, sector, api.presentSkills(s)).length,
        })).filter((x) => x.missing > 0);
        if (scored.length < 2) return null;
        const thick = [...scored].sort((a, b) => b.capacity - a.capacity)[0];
        const thin = [...scored].sort((a, b) => a.teachers - b.teachers || b.missing - a.missing)[0];
        if (thick.sector === thin.sector) return null;
        const where = liveplaces(s).sort((a, b) => b.standsFor - a.standsFor)[0];
        return {
          title: 'Two sectors want teaching. One of them can hear you.',
          lines: [
            `${thick.sector} has ${thick.teachers} people doing it. Teach there and ${thick.capacity} learn `
              + `this year, against ${thick.missing} skills it is still short.`,
            `${thin.sector} has ${thin.teachers}. Teach there and ${thin.capacity} learn, against `
              + `${thin.missing} missing — and nobody with those skills walks in by chance, because that `
              + 'is how rare they are in the pool.',
          ],
          choices: [
            {
              key: 'thick',
              label: `Teach ${thick.sector}`,
              cost: `${thick.capacity} learn · ${thick.missing} short`,
              apply: (st) => { api.ACTIONS.teach(st, thick.sector, where.key); },
            },
            {
              key: 'thin',
              label: `Teach ${thin.sector}`,
              cost: `${thin.capacity} learn · ${thin.missing} short · only teaching reaches it`,
              apply: (st) => { api.ACTIONS.teach(st, thin.sector, where.key); },
            },
          ],
        };
      },
    },
    {
      id: 'rests-on-one',
      kind: 'ordinary',
      when: (s) => findableResidents(s).length > 10,
      build: (s) => {
        const sole = soleHolders(s, api);
        if (sole.length === 0) return null;
        const one = pickOne(s.rng, sole.slice(0, 12));
        const place = s.places.find((p) => p.key === one.holder.place);
        if (!place) return null;
        return {
          title: `${nameOf(s, one.holder)} is the only person holding a ${one.sector} skill.`,
          lines: [
            `${sole.length} of the skills on the board rest on one person each. The year any of those `
              + 'people is out of reach, the skill is off the catalog.',
            `Teaching the sector in ${place.key} puts somebody else behind it.`,
          ],
          choices: [
            {
              key: 'teach',
              label: `Teach ${one.sector} in ${place.key}`,
              cost: `${teachingCapacity(s, one.sector, findableResidents(s))} learn`,
              apply: (st) => { api.ACTIONS.teach(st, one.sector, place.key); },
            },
            {
              key: 'look',
              label: 'Look for people there instead',
              cost: `${st1(s)} tried, some arrive`,
              apply: (st) => { api.ACTIONS.look(st, place.key); },
            },
          ],
        };
      },
    },

    {
      id: 'somebody-arrives',
      kind: 'ordinary',
      when: (s) => liveplaces(s).length > 1 && findableResidents(s).length > 6,
      build: (s) => {
        const findable = findableResidents(s);
        // Somebody who arrived recently and has not been placed by anything else yet.
        const recent = findable.filter((r) => r.id.startsWith('n') && r.exchanges === 0);
        if (recent.length === 0) return null;
        const who = pickOne(s.rng, recent);
        const here = s.places.find((p) => p.key === who.place);
        if (!here) return null;
        const sectors = Object.keys(who.sectors);
        if (sectors.length === 0) return null;
        // Somewhere the network is short of a job this person could fill.
        const shortPlaces = liveplaces(s)
          .filter((p) => p.key !== who.place)
          .map((p) => ({ place: p, missing: teamsMissingFor(s, p.key) }))
          .filter((x) => x.missing.some((name) => {
            const team = s.teams.find((t) => t.name === name);
            return team && team.sectors.some((sec) => who.sectors[sec]);
          }));
        const needed = shortPlaces[0] ?? null;
        const can = sectors.join(', ');
        return {
          title: `${nameOf(s, who)} has found the Directory.`,
          lines: [
            `${can}. That is what the listing says and it is what there is to go on.`,
            'Nothing else about them is knowable, now or later. The network runs on exchange, so '
              + 'somebody offering none stops being around without anybody deciding it.',
            needed
              ? `${needed.place.key} is short of ${needed.missing[0]}, which is work they do.`
              : `They are in ${here.key}, where the network already covers what they do.`,
          ],
          choices: needed ? [
            {
              key: 'move',
              label: `Ask them to make for ${needed.place.key}`,
              cost: `one Look there · fills ${needed.missing[0]} if they go`,
              apply: (st) => {
                const target = st.residents.find((r) => r.id === who.id);
                if (target) target.place = needed.place.key;
                api.ACTIONS.look(st, needed.place.key);
              },
            },
            {
              key: 'stay',
              label: `Leave them in ${here.key}`,
              cost: 'nothing · they get on with it where they are',
              apply: () => {},
            },
          ] : [
            {
              key: 'teach',
              label: `Teach ${sectors[0]} in ${here.key}`,
              cost: `${teachingCapacity(s, sectors[0], findable)} learn · puts depth behind what they do`,
              apply: (st) => { api.ACTIONS.teach(st, sectors[0], here.key); },
            },
            {
              key: 'stay',
              label: 'Leave them to it',
              cost: 'nothing',
              apply: () => {},
            },
          ],
        };
      },
    },

    // --- A place stops ----------------------------------------------------------------------------
    {
      id: 'network-short',
      kind: 'stopped',
      when: (s) => placesThatRun(s).length < liveplaces(s).length,
      build: (s) => {
        const running = new Set(placesThatRun(s).map((p) => p.key));
        const stopped = liveplaces(s).filter((p) => !running.has(p.key));
        if (stopped.length === 0) return null;
        const place = pickOne(s.rng, stopped);
        const missing = teamsMissingFor(s, place.key);
        if (missing.length === 0) return null;
        const group = components(s).find((g) => g.includes(place.key)) ?? [place.key];
        const team = s.teams.find((t) => t.name === missing[0]);
        const findable = findableResidents(s);
        const sector = team.sectors
          .map((sec) => ({ sec, capacity: teachingCapacity(s, sec, findable) }))
          .sort((a, b) => b.capacity - a.capacity)[0];
        return {
          title: `${place.key} has stopped.`,
          lines: [
            `A place runs when the network it is joined to can fill all thirteen jobs. ${place.key} is `
              + `joined to ${group.length - 1} other ${group.length === 2 ? 'place' : 'places'}, and between `
              + `them they are short of ${missing.length}: ${missing.join(', ')}.`,
            'No place holds all thirteen alone and none is meant to. What is short is the network.',
          ],
          choices: [
            {
              key: 'teach',
              label: sector && sector.capacity > 0 ? `Teach ${sector.sec} there` : 'Look for people there',
              cost: sector && sector.capacity > 0 ? `${sector.capacity} learn · fills ${missing[0]}` : `${st1(s)} tried`,
              apply: (st) => {
                if (sector && sector.capacity > 0) api.ACTIONS.teach(st, sector.sec, place.key);
                else api.ACTIONS.look(st, place.key);
              },
            },
            {
              key: 'reach',
              label: `Reach ${place.key}`,
              cost: place.isolation > 0 ? `isolation ${place.isolation} → ${Math.max(0, place.isolation - 1)}` : 'nothing to push back',
              apply: (st) => { api.ACTIONS.reach(st, place.key); },
            },
          ],
        };
      },
    },

    // --- The argument goes unanswered ----------------------------------------------------------------
    {
      id: 'quiet-years',
      kind: 'quiet',
      when: (s) => s.pressure >= 0.32,
      build: (s) => {
        const arrive = Math.round(s.tuning.lookYield * (1 - s.pressure));
        return {
          title: s.quietYears > 1 ? `${s.quietYears} quiet years.` : 'A quiet year.',
          lines: [
            'The argument that this cannot be done has gone that long without an answer. Roughly one in '
              + `every ${(1 / Math.max(s.pressure, 0.01)).toFixed(1)} people you reach now does not stay.`,
            `A Look tries ${s.tuning.lookYield} and about ${arrive} arrive.`,
          ],
          choices: [
            {
              key: 'arithmetic',
              label: 'Show the arithmetic',
              cost: `pressure ${s.pressure.toFixed(2)} → ${Math.max(0, s.pressure - s.tuning.arithmeticEffect).toFixed(2)}`,
              apply: (st) => { api.ACTIONS.showTheArithmetic(st); },
            },
            {
              key: 'look',
              label: 'Look for people anyway',
              cost: `${arrive} of ${s.tuning.lookYield} · somebody arriving is itself an answer`,
              apply: (st) => {
                const where = liveplaces(st).sort((a, b) => b.standsFor - a.standsFor)[0];
                if (where) api.ACTIONS.look(st, where.key);
              },
            },
          ],
        };
      },
    },

    // --- Schemes ------------------------------------------------------------------------------------
    {
      id: 'supplier-folds',
      kind: 'scheme',
      scheme: scheme('acquire-and-fold'),
      when: (s) => s.places.some((p) => p.covered),
      build: (s) => {
        const place = pickOne(s.rng, s.places.filter((p) => p.covered));
        return {
          title: `What kept ${place.key} steady has gone quiet.`,
          lines: [
            'Somewhere that was reached for good is not any more. The arrangement it rested on was '
              + 'bought and then shut, and nothing about that is visible until it stops.',
            'Nothing is permanently safe. A place held once is a place that has to be held again.',
          ],
          choices: [
            {
              key: 'hold',
              label: `Reach ${place.key} now`,
              cost: 'one action · back to reached for good if it is running',
              apply: (st) => {
                const p = st.places.find((x) => x.key === place.key);
                if (p) { p.covered = false; p.isolation = 1; }
                api.ACTIONS.reach(st, place.key);
              },
            },
            {
              key: 'let',
              label: 'Let it sit for now',
              cost: 'isolation starts climbing there again',
              apply: (st) => {
                const p = st.places.find((x) => x.key === place.key);
                if (p) { p.covered = false; p.isolation = 2; }
              },
            },
          ],
        };
      },
    },
    {
      id: 'link-cut',
      kind: 'scheme',
      scheme: scheme('altered-ticket'),
      when: (s) => components(s).some((g) => g.length > 1),
      build: (s) => {
        const place = pickOne(s.rng, liveplaces(s));
        const group = components(s).find((g) => g.includes(place.key)) ?? [];
        if (group.length < 2) return null;
        const skills = api.presentSkills(s).size;
        return {
          title: `The way into ${place.key} stopped working.`,
          lines: [
            'Tickets that were booked are not booked. Routes that ran do not. Nobody there has moved and '
              + 'nothing there has changed, and it is further away than it was yesterday.',
            `It is joined to ${group.length - 1} other ${group.length === 2 ? 'place' : 'places'} and the `
              + `catalog currently stands at ${skills} of ${s.taxonomySkills}.`,
          ],
          choices: [
            {
              key: 'reach',
              label: `Reach ${place.key}`,
              cost: `isolation ${place.isolation} → ${Math.max(0, place.isolation - 1)}`,
              apply: (st) => {
                const p = st.places.find((x) => x.key === place.key);
                if (p) p.isolation = Math.min(st.tuning.maxIsolation, p.isolation + 1);
                api.ACTIONS.reach(st, place.key);
              },
            },
            {
              key: 'absorb',
              label: 'Spend the year elsewhere',
              cost: `isolation ${place.isolation} → ${Math.min(s.tuning.maxIsolation, place.isolation + 1)}`,
              apply: (st) => {
                const p = st.places.find((x) => x.key === place.key);
                if (p) p.isolation = Math.min(st.tuning.maxIsolation, p.isolation + 1);
              },
            },
          ],
        };
      },
    },
    {
      id: 'pulled-away',
      kind: 'scheme',
      scheme: scheme('fake-job'),
      when: (s) => findableResidents(s).length > 12,
      build: (s) => {
        const sole = soleHolders(s, api);
        const findable = findableResidents(s);
        const who = sole.length > 0 ? pickOne(s.rng, sole).holder : pickOne(s.rng, findable);
        const place = s.places.find((p) => p.key === who.place);
        if (!place) return null;
        const holds = who.skills.size;
        return {
          title: `${nameOf(s, who)} has been offered something far away.`,
          lines: [
            'It pays, it is somewhere else, and it will not last. By the time it ends they are somewhere '
              + `with nobody in it, and ${place.key} is short the ${holds} ${holds === 1 ? 'skill' : 'skills'} `
              + 'they were holding.',
            'Nobody is stopping them and nobody should. What can change is whether their leaving takes a '
              + 'capability with it.',
          ],
          choices: [
            {
              key: 'cover',
              label: 'Put somebody behind them first',
              cost: 'one Teach in their sector · they are away two years either way',
              apply: (st) => {
                const target = st.residents.find((r) => r.id === who.id);
                if (target) { target.away = true; target.awayUntil = st.year + 2; }
                const sector = Object.keys(who.sectors)[0];
                if (sector) api.ACTIONS.teach(st, sector, place.key);
              },
            },
            {
              key: 'let',
              label: 'Let it happen',
              cost: `away two years · ${holds} ${holds === 1 ? 'skill' : 'skills'} at risk of leaving the catalog`,
              apply: (st) => {
                const target = st.residents.find((r) => r.id === who.id);
                if (target) { target.away = true; target.awayUntil = st.year + 2; }
              },
            },
          ],
        };
      },
    },
    {
      id: 'loud-podcasts',
      kind: 'scheme',
      scheme: scheme('psyop-marketing'),
      when: (s) => s.pressure < 0.7,
      build: (s) => {
        const after = Math.min(1, s.pressure + 0.12);
        return {
          title: 'The argument arrived before you did.',
          lines: [
            'People being reached this year have already heard why it will not work. It is everywhere it '
              + 'needs to be and nowhere anybody can point at.',
            `Pressure ${s.pressure.toFixed(2)} → ${after.toFixed(2)} unless it is answered.`,
          ],
          choices: [
            {
              key: 'answer',
              label: 'Show the arithmetic',
              cost: `one action · pressure ${s.pressure.toFixed(2)} → ${Math.max(0, after - s.tuning.arithmeticEffect).toFixed(2)}`,
              apply: (st) => {
                st.pressure = Math.min(1, st.pressure + 0.12);
                api.ACTIONS.showTheArithmetic(st);
              },
            },
            {
              key: 'results',
              label: 'Let the results answer it',
              cost: `pressure ${s.pressure.toFixed(2)} → ${after.toFixed(2)} · a year that shows something takes it back down`,
              apply: (st) => { st.pressure = Math.min(1, st.pressure + 0.12); },
            },
          ],
        };
      },
    },
    {
      id: 'stopped-exchanging',
      kind: 'scheme',
      scheme: scheme('poisoned-well'),
      when: (s) => findableResidents(s).filter((r) => r.exchanges > 2).length > 8,
      build: (s) => {
        const who = pickOne(s.rng, findableResidents(s).filter((r) => r.exchanges > 2));
        const place = s.places.find((p) => p.key === who.place);
        if (!place) return null;
        return {
          title: `${nameOf(s, who)} has stopped answering.`,
          lines: [
            `They were exchanging for ${who.exchanges} years and now they are not. Something was said to `
              + 'them about the people around them, and it was said by somebody they had reason to trust.',
            'There is nobody to confront and nothing to disprove. What there is is whether anybody keeps '
              + 'reaching them.',
          ],
          choices: [
            {
              key: 'reach',
              label: `Keep reaching ${place.key}`,
              cost: 'one action · they stay, quietly, and may come back',
              apply: (st) => {
                const target = st.residents.find((r) => r.id === who.id);
                if (target) target.quietYears = 1;
                api.ACTIONS.reach(st, place.key);
              },
            },
            {
              key: 'let',
              label: 'Leave them be',
              cost: `exchanging nothing · drifts out after ${s.tuning.driftOutAfter} quiet years`,
              apply: (st) => {
                const target = st.residents.find((r) => r.id === who.id);
                if (target) { target.exchanges = 0; target.quietYears = 1; target.neverExchanges = true; }
              },
            },
          ],
        };
      },
    },
    {
      id: 'attrition',
      kind: 'scheme',
      scheme: scheme('insurance-bleed'),
      when: (s) => liveplaces(s).some((p) => !p.covered),
      build: (s) => {
        const place = pickOne(s.rng, liveplaces(s).filter((p) => !p.covered));
        const after = Math.min(s.tuning.maxIsolation, place.isolation + 2);
        return {
          title: `Everything in ${place.key} costs more than it did.`,
          lines: [
            'Claims, premiums, repairs, replacements. No single one of them is worth arguing about and '
              + 'together they are what people there have instead of savings.',
            `Isolation ${place.isolation} → ${after}${after >= s.tuning.maxIsolation ? ', which is the edge' : ''}.`,
          ],
          choices: [
            {
              key: 'reach',
              label: `Reach ${place.key} twice over`,
              cost: 'one action · takes back what this cost',
              apply: (st) => {
                const p = st.places.find((x) => x.key === place.key);
                if (p) p.isolation = Math.min(st.tuning.maxIsolation, p.isolation + 2);
                api.ACTIONS.reach(st, place.key);
                api.ACTIONS.reach(st, place.key);
              },
            },
            {
              key: 'absorb',
              label: 'Carry it',
              cost: `isolation ${place.isolation} → ${after}`,
              apply: (st) => {
                const p = st.places.find((x) => x.key === place.key);
                if (p) p.isolation = Math.min(st.tuning.maxIsolation, p.isolation + 2);
              },
            },
          ],
        };
      },
    },
    {
      id: 'moved-back',
      kind: 'scheme',
      scheme: scheme('forced-homecoming'),
      when: (s) => liveplaces(s).length > 3 && findableResidents(s).length > 12,
      build: (s) => {
        const who = pickOne(s.rng, findableResidents(s));
        const from = s.places.find((p) => p.key === who.place);
        const others = liveplaces(s).filter((p) => p.key !== who.place);
        if (!from || others.length === 0) return null;
        const to = pickOne(s.rng, others);
        return {
          title: `${nameOf(s, who)} cannot stay in ${from.key}.`,
          lines: [
            'The housing went, then the work, then the room somebody was letting them have. What is left is '
              + `somewhere they came from, and it is in ${to.key}.`,
            'Their skills go with them. So does the gap they leave.',
          ],
          choices: [
            {
              key: 'help',
              label: `Make sure ${to.key} can hold them`,
              cost: 'one Look there · they move either way',
              apply: (st) => {
                const target = st.residents.find((r) => r.id === who.id);
                if (target) target.place = to.key;
                api.ACTIONS.look(st, to.key);
              },
            },
            {
              key: 'let',
              label: 'They move',
              cost: `${from.key} loses them · ${to.key} gains them`,
              apply: (st) => {
                const target = st.residents.find((r) => r.id === who.id);
                if (target) target.place = to.key;
              },
            },
          ],
        };
      },
    },
    {
      id: 'lost-year',
      kind: 'scheme',
      scheme: scheme('engineered-delay'),
      when: () => true,
      build: (s) => ({
        title: 'Everything took longer than it should have.',
        lines: [
          'Forms that were filed were not filed. Calls that were answered went back to the start of the '
            + 'queue. Nothing that happened is worth describing on its own and the year is most of the way '
            + 'gone.',
          'One action less this year.',
        ],
        choices: [
          {
            key: 'absorb',
            label: 'Get on with what is left',
            cost: 'one action fewer this year',
            apply: (st) => { st.actionsLostThisYear = (st.actionsLostThisYear ?? 0) + 1; },
          },
        ],
      }),
    },
    {
      id: 'unreachable',
      kind: 'scheme',
      scheme: scheme('mail-mirage'),
      when: (s) => liveplaces(s).some((p) => !p.covered),
      build: (s) => {
        const place = pickOne(s.rng, liveplaces(s).filter((p) => !p.covered));
        return {
          title: `Nothing sent to ${place.key} is arriving.`,
          lines: [
            'It is going somewhere. What was posted was collected, and what was expected was not received, '
              + 'and both of those are true at once.',
            `Isolation ${place.isolation} → ${Math.min(s.tuning.maxIsolation, place.isolation + 1)}.`,
          ],
          choices: [
            {
              key: 'reach',
              label: `Reach ${place.key}`,
              cost: 'one action · takes it back',
              apply: (st) => {
                const p = st.places.find((x) => x.key === place.key);
                if (p) p.isolation = Math.min(st.tuning.maxIsolation, p.isolation + 1);
                api.ACTIONS.reach(st, place.key);
              },
            },
            {
              key: 'absorb',
              label: 'Leave it',
              cost: `isolation ${place.isolation} → ${Math.min(s.tuning.maxIsolation, place.isolation + 1)}`,
              apply: (st) => {
                const p = st.places.find((x) => x.key === place.key);
                if (p) p.isolation = Math.min(st.tuning.maxIsolation, p.isolation + 1);
              },
            },
          ],
        };
      },
    },
  ];
}

const st1 = (s) => s.tuning.lookYield;

// --- Drawing ---------------------------------------------------------------------------------------
//
// Which card and when, never whether. The draw is weighted so that most years are ordinary, because
// a deck where every year is an attack teaches that nothing works, which is the argument the other
// side makes.
export const DRAW_WEIGHTS = { ordinary: 5, stopped: 3, quiet: 3, scheme: 4 };

export function drawCard(s, deck) {
  const eligible = deck.filter((card) => card.when(s));
  if (eligible.length === 0) return null;
  // Weighted by kind and then chosen inside it, rather than weighted per card. Weighting per card
  // would make schemes the common year purely because more of them are written, and a deck where
  // most years are an attack teaches that nothing works, which is the argument the other side makes.
  const byKind = new Map();
  for (const card of eligible) {
    if (!byKind.has(card.kind)) byKind.set(card.kind, []);
    byKind.get(card.kind).push(card);
  }
  const weighted = [];
  for (const kind of byKind.keys()) {
    for (let i = 0; i < (DRAW_WEIGHTS[kind] ?? 1); i += 1) weighted.push(kind);
  }
  // Ten tries at a card that can build itself from this board, then the year opens with nothing,
  // which is itself a fine year.
  for (let i = 0; i < 10; i += 1) {
    const card = pickOne(s.rng, byKind.get(pickOne(s.rng, weighted)));
    const built = card.build(s);
    if (built) {
      return {
        id: card.id,
        kind: card.kind,
        scheme: card.scheme ?? null,
        ...built,
      };
    }
  }
  return null;
}

export { num };
