// The world the board grows into. Work item 1 of issue #47.
//
// The previous build had six fixed places and that was the whole world. This one starts there and
// opens outward, because a single walled place is the shape the adversary is built to take — one
// address, one set of links, one thing to cut. Distribution is the defense, so growing the network
// has to be something the player does rather than something the board hands them.
//
// Two things in here are read off committed data and two are decisions. The opening six and their
// links come from opening-board.json, unchanged. The world list and the apportionment below are
// decisions, and they are written here rather than computed so that nobody mistakes them for
// measurements.

// --- What the opening board is, and is not --------------------------------------------------------
//
// The six starting places are where the Directory currently says its people are. That is not the
// same as where survivors are, and no copy in the game may present it as such.
//
// Country is a required field on a listing, and on a community-generated listing it was filled in
// from what could be worked out rather than from what the person said. It skews toward the United
// States, because somebody writing in English on Quora reads as American whether or not they are and
// there is no way to tell from outside. People correct it themselves once they claim their listing.
//
// So "Outside the US and UK" is not a place. It is the Directory's own unknown, standing in for
// everybody it could not locate, and it is the seed the rest of the world opens from.

export const OPENING_PLACES = [
  'United States — state not given',
  'United States — elsewhere',
  'United States — California',
  'United States — Florida',
  'United Kingdom',
  'Outside the US and UK',
];

// --- The world ------------------------------------------------------------------------------------
//
// Regions rather than a globe, because the map is drawn on a phone and because the mechanic that
// matters is which places can reach each other. Everything inside a region is linked; a region
// reaches the rest of the world through its bridges, which is what makes cutting one expensive.
//
// `weight` is this game's apportionment of the five million, not a population estimate and not a
// claim about where anybody is. It exists so the reached figure on screen means something, and it is
// deliberately coarse.

export const REGIONS = [
  {
    key: 'north-america',
    name: 'North America',
    x: 20,
    y: 34,
    bridges: ['west-europe', 'south-america', 'east-asia'],
    places: [
      { name: 'Canada', weight: 90 },
      { name: 'Mexico', weight: 120 },
    ],
  },
  {
    key: 'south-america',
    name: 'South America',
    x: 29,
    y: 74,
    bridges: ['north-america', 'west-europe', 'africa'],
    places: [
      { name: 'Brazil', weight: 190 },
      { name: 'Colombia', weight: 80 },
      { name: 'Argentina', weight: 80 },
    ],
  },
  {
    key: 'west-europe',
    name: 'Western Europe',
    x: 47,
    y: 26,
    bridges: ['north-america', 'east-europe', 'africa', 'middle-east'],
    places: [
      { name: 'Ireland', weight: 40 },
      { name: 'France', weight: 120 },
      { name: 'Germany', weight: 130 },
      { name: 'Spain', weight: 90 },
    ],
  },
  {
    key: 'east-europe',
    name: 'Eastern Europe',
    x: 58,
    y: 24,
    bridges: ['west-europe', 'middle-east', 'south-asia'],
    places: [
      { name: 'Poland', weight: 80 },
      { name: 'Ukraine', weight: 80 },
      { name: 'Romania', weight: 55 },
    ],
  },
  {
    key: 'africa',
    name: 'Africa',
    x: 52,
    y: 62,
    bridges: ['west-europe', 'south-america', 'middle-east'],
    places: [
      { name: 'Nigeria', weight: 210 },
      { name: 'Kenya', weight: 95 },
      { name: 'South Africa', weight: 105 },
      { name: 'Ghana', weight: 70 },
      { name: 'Egypt', weight: 110 },
    ],
  },
  {
    key: 'middle-east',
    name: 'Middle East',
    x: 64,
    y: 45,
    bridges: ['west-europe', 'east-europe', 'africa', 'south-asia'],
    places: [
      { name: 'Turkey', weight: 95 },
      { name: 'Jordan', weight: 45 },
    ],
  },
  {
    key: 'south-asia',
    name: 'South Asia',
    x: 74,
    y: 48,
    bridges: ['middle-east', 'east-europe', 'east-asia'],
    places: [
      { name: 'India', weight: 260 },
      { name: 'Pakistan', weight: 130 },
      { name: 'Bangladesh', weight: 110 },
    ],
  },
  {
    key: 'east-asia',
    name: 'East Asia',
    x: 85,
    y: 40,
    bridges: ['south-asia', 'oceania', 'north-america'],
    places: [
      { name: 'Philippines', weight: 115 },
      { name: 'Indonesia', weight: 175 },
      { name: 'Japan', weight: 110 },
      { name: 'South Korea', weight: 75 },
    ],
  },
  {
    key: 'oceania',
    name: 'Oceania',
    x: 88,
    y: 76,
    bridges: ['east-asia', 'south-asia'],
    places: [
      { name: 'Australia', weight: 80 },
      { name: 'New Zealand', weight: 40 },
    ],
  },
];

// The opening six sit in their own region, which is the one the Directory reached. It bridges
// outward like any other, and "Outside the US and UK" is what those bridges leave from, because it
// is where the Directory already knows it has people it cannot place.
export const OPENING_REGION = {
  key: 'reached',
  name: 'Where the Directory reached',
  x: 20,
  y: 52,
  bridges: ['north-america', 'west-europe', 'africa', 'south-america'],
};

export const BRIDGE_HEAD = 'Outside the US and UK';

export const SURVIVOR_POPULATION = 5_000_000;

// --- How a place opens ------------------------------------------------------------------------------
//
// One action, and the dice choose which place inside the region — which and when, never whether.
//
// A region opens before its places can be reached individually, which is what stops the board from
// unfolding as one long list. Reaching into a new region is the expensive move; the places inside it
// are cheaper once somebody is there, which is the same thing a link is for.
export const OPENING_COST = {
  // A place opened has not been held yet, so it arrives already under pressure. This is what keeps
  // growth from being free: every place added is another thing that can be cut, and the isolation
  // spread below scales with how many are open.
  newPlaceIsolation: 1,
  // People who were already there and become findable once there is a way to reach them. Drawn from
  // the Directory's own histograms, like every other newcomer.
  peopleAtFirstReach: 4,
  // A region's first place costs more to open than its later ones, because somebody has to get there
  // at all before anybody can be found.
  firstInRegionExtra: 2,
};

export function allPlaceNames() {
  return [...OPENING_PLACES, ...REGIONS.flatMap((r) => r.places.map((p) => p.name))];
}

export function regionOf(placeName) {
  if (OPENING_PLACES.includes(placeName)) return OPENING_REGION.key;
  for (const region of REGIONS) {
    if (region.places.some((p) => p.name === placeName)) return region.key;
  }
  return null;
}

// Links form as places join: everything inside a region is connected to everything else inside it,
// and a region reaches the world through the bridges named above. So cutting a bridge isolates a
// region rather than a place, which is the cost of a network that spread thin.
export function linksFor(placeName, openNames) {
  const region = regionOf(placeName);
  const open = new Set(openNames);
  const out = new Set();
  for (const other of open) {
    if (other === placeName) continue;
    if (regionOf(other) === region) out.add(other);
  }
  const bridges = region === OPENING_REGION.key
    ? OPENING_REGION.bridges
    : (REGIONS.find((r) => r.key === region)?.bridges ?? []);
  // A region's bridges land on whichever of its neighbours is open, at that neighbour's own bridge
  // head — the first place opened there. The opening region's bridge head is the bucket the
  // Directory could not place, which is the honest place for the world to start from.
  for (const neighbour of bridges) {
    const head = bridgeHeadOf(neighbour, openNames);
    if (head && head !== placeName) out.add(head);
  }
  // And back the other way, so a place opening inside a region the rest of the world already
  // bridges to does not sit unreachable.
  if (isBridgeHead(placeName, openNames)) {
    for (const other of open) {
      if (other === placeName) continue;
      const otherRegion = regionOf(other);
      if (otherRegion === region) continue;
      if (!isBridgeHead(other, openNames)) continue;
      const otherBridges = otherRegion === OPENING_REGION.key
        ? OPENING_REGION.bridges
        : (REGIONS.find((r) => r.key === otherRegion)?.bridges ?? []);
      if (otherBridges.includes(region)) out.add(other);
    }
  }
  return [...out];
}

// The first place opened in a region is what the rest of the world connects through.
export function bridgeHeadOf(regionKey, openNames) {
  if (regionKey === OPENING_REGION.key) {
    return openNames.includes(BRIDGE_HEAD) ? BRIDGE_HEAD : null;
  }
  const region = REGIONS.find((r) => r.key === regionKey);
  if (!region) return null;
  for (const place of region.places) {
    if (openNames.includes(place.name)) return place.name;
  }
  return null;
}

function isBridgeHead(placeName, openNames) {
  return bridgeHeadOf(regionOf(placeName), openNames) === placeName;
}

// --- Apportioning the five million ------------------------------------------------------------------
//
// Display only. Nothing in the loop reads it: the index settles on findable people in running
// places, not on a headcount a place stands for. It exists so "reached" on screen is a figure rather
// than a count of pins.
//
// The opening six keep the relative sizes the generated board gave them, scaled so that everything
// on the world board sums to the five million.
export function apportion(openingStandsFor) {
  const openingTotal = Object.values(openingStandsFor).reduce((a, b) => a + b, 0);
  const worldWeight = REGIONS.reduce((a, r) => a + r.places.reduce((b, p) => b + p.weight, 0), 0);
  // The Directory has reached a small part of the world, so the opening six are given a share of the
  // whole that matches how little of it they are: one weight point each per fifty thousand people
  // the generated board put behind them, which lands the six at a little under a tenth.
  const openingWeight = openingTotal / 50_000;
  const total = openingWeight + worldWeight;
  const out = {};
  for (const [name, standsFor] of Object.entries(openingStandsFor)) {
    const share = (standsFor / openingTotal) * openingWeight;
    out[name] = Math.round((share / total) * SURVIVOR_POPULATION);
  }
  for (const region of REGIONS) {
    for (const place of region.places) {
      out[place.name] = Math.round((place.weight / total) * SURVIVOR_POPULATION);
    }
  }
  return out;
}
