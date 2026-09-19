// The screen. Work items 6, 7, 8 and 9 of issue #47.
//
// Everything above this in the bundle is the model, dropped in unchanged from the files the headless
// sweep runs. Nothing here decides a rule. It draws the board, offers the year's card, and passes
// the player's choice back into the same actions the sweep uses.

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var S = null; // the run
  var selectedPlace = null;
  var selectedSector = null;
  var events = [];
  var showSchemeNames = false;

  var STORE_KEY = 'peace-battle-2';

  // --- Storage -----------------------------------------------------------------------------------
  //
  // A run is the seed plus the moves that produced it, so what is kept is the seed and enough to say
  // where the run got to. Replaying from a seed is what makes a shared seed mean anything.
  function save() {
    try {
      window.storage.set(STORE_KEY, {
        seed: S ? S.seed : null,
        names: showSchemeNames,
      });
    } catch (e) { /* storage can be unavailable; the game still runs */ }
  }

  function load() {
    try { return window.storage.get(STORE_KEY) || {}; } catch (e) { return {}; }
  }

  // --- Small helpers ------------------------------------------------------------------------------

  var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };
  var short = function (name) {
    return name
      .replace('United States — state not given', 'US, state not given')
      .replace('United States — elsewhere', 'US, elsewhere')
      .replace('United States — ', '')
      .replace('Outside the US and UK', 'Outside US and UK');
  };
  var billions = function (n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + ' billion';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + ' million';
    return fmt(n);
  };

  function say(text, tone) {
    events.unshift({ text: text, tone: tone || '' });
    if (events.length > 4) events.pop();
  }

  // --- Starting a run -----------------------------------------------------------------------------

  function start(seed) {
    S = buildStartingState(seed >>> 0, DEFAULT_TUNING, SOURCES);
    S.seed = seed >>> 0;
    S.given = GIVEN;
    S.surname = SURNAME;
    S.actsLeft = actionsThisYear(S);
    selectedPlace = S.places[0].key;
    selectedSector = null;
    events = [];
    say('The board opens where the Directory reached. Everywhere else is somewhere to grow to.');
    beginYear(S);
    S.actsLeft = actionsThisYear(S);
    save();
    draw();
  }

  // --- The card -----------------------------------------------------------------------------------

  var KIND_LABEL = {
    ordinary: 'This year',
    stopped: 'Something has stopped',
    quiet: 'Nothing has shown',
    scheme: 'Something was done to the network',
  };

  function drawCardBox() {
    var box = $('cardBox');
    box.innerHTML = '';
    if (!S.card || S.over) return;
    var card = S.card;

    var el = document.createElement('div');
    el.className = 'card' + (card.kind === 'scheme' ? ' scheme' : '');

    var kind = document.createElement('div');
    kind.className = 'kind';
    kind.textContent = KIND_LABEL[card.kind] || 'This year';
    el.appendChild(kind);

    var h = document.createElement('h2');
    h.textContent = card.title;
    el.appendChild(h);

    card.lines.forEach(function (line) {
      var p = document.createElement('p');
      p.textContent = line;
      el.appendChild(p);
    });

    var picks = document.createElement('div');
    picks.className = 'picks';
    card.choices.forEach(function (choice) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick';
      var label = document.createElement('span');
      label.className = 'pl';
      label.textContent = choice.label;
      var cost = document.createElement('span');
      cost.className = 'pc';
      cost.textContent = choice.cost;
      b.appendChild(label);
      b.appendChild(cost);
      b.addEventListener('click', function () {
        chooseOnCard(S, choice.key);
        say(choice.label + '.', card.kind === 'scheme' ? 'bad' : '');
        draw();
      });
      picks.appendChild(b);
    });
    el.appendChild(picks);

    // Item 7. The card face carries the effect; the name sits behind this, closed unless the player
    // has said otherwise. Somebody should be able to play without reading the name of a method they
    // have lived through, and ClickLog's scheme tags mark real incidents — they are evidence, and the
    // game is not.
    if (card.scheme) {
      var named = document.createElement('details');
      named.className = 'named';
      if (showSchemeNames) named.open = true;
      var sum = document.createElement('summary');
      sum.textContent = 'What this was';
      named.appendChild(sum);
      var p = document.createElement('p');
      p.innerHTML = 'This is the one called <span class="nm"></span>. It is on the named list the app '
        + 'uses to tag real incidents, and the Dictionary carries what it means.';
      p.querySelector('.nm').textContent = card.scheme.label;
      named.appendChild(p);
      el.appendChild(named);
    }

    box.appendChild(el);
  }

  // --- The board ----------------------------------------------------------------------------------

  function placeState(place) {
    if (place.cutOff) return { cls: 'gone', text: 'cut off' };
    if (place.covered) return { cls: 'held', text: 'reached for good' };
    var running = placesThatRun(S).some(function (p) { return p.key === place.key; });
    if (!running) return { cls: 'stop', text: 'stopped' };
    if (place.isolation > 0) return { cls: 'run', text: 'isolation ' + place.isolation };
    return { cls: 'run', text: 'running' };
  }

  function drawPlaces() {
    var wrap = $('places');
    wrap.innerHTML = '';
    var findable = findableResidents(S);
    S.places.forEach(function (place) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pbtn';
      b.setAttribute('aria-pressed', String(place.key === selectedPlace));
      var here = findable.filter(function (r) { return r.place === place.key; }).length;
      var st = placeState(place);
      b.innerHTML = '<span class="n"></span><span class="v"></span><span class="st ' + st.cls + '"></span>';
      b.querySelector('.n').textContent = short(place.key);
      b.querySelector('.v').textContent = here;
      b.querySelector('.st').textContent = st.text;
      b.addEventListener('click', function () {
        selectedPlace = place.key;
        selectedSector = null;
        draw();
      });
      wrap.appendChild(b);
    });
  }

  function drawRoster() {
    var place = S.places.find(function (p) { return p.key === selectedPlace; });
    if (!place) return;
    var findable = findableResidents(S);
    var group = components(S).find(function (g) { return g.indexOf(place.key) >= 0; }) || [place.key];
    var inNetwork = findable.filter(function (r) { return group.indexOf(r.place) >= 0; });
    var here = findable.filter(function (r) { return r.place === place.key; });

    $('placeName').textContent = short(place.key);
    var st = placeState(place);
    var region = REGION_POINTS[place.region];
    $('placeState').textContent = (region ? region.name + ' · ' : '') + here.length + ' here · joined to '
      + (group.length - 1) + (group.length === 2 ? ' other place' : ' other places') + ' · ' + st.text;

    var roster = $('roster');
    roster.innerHTML = '';
    S.teams.forEach(function (team) {
      var inNet = inNetwork.filter(function (r) {
        return team.sectors.some(function (sec) { return r.sectors[sec]; });
      });
      var atPlace = here.filter(function (r) {
        return team.sectors.some(function (sec) { return r.sectors[sec]; });
      });
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'job' + (inNet.length === 0 ? ' empty' : (inNet.length < 3 ? ' thin' : ''));
      var sector = team.sectors.slice().sort(function (a, c) {
        return teachingCapacity(S, c, findable) - teachingCapacity(S, a, findable);
      })[0];
      b.setAttribute('aria-pressed', String(sector === selectedSector));
      var whoText = inNet.length === 0
        ? 'nobody in the network'
        : inNet.length + ' in the network' + (atPlace.length ? ' · ' + atPlace.length + ' here' : '');
      b.innerHTML = '<span class="jn"></span><span class="who"></span>';
      b.querySelector('.jn').textContent = team.name;
      b.querySelector('.who').textContent = whoText;
      if (inNet.length > 0 && inNet.length < 3) {
        var hint = document.createElement('span');
        hint.className = 'hint';
        hint.textContent = 'one bad year from empty';
        b.querySelector('.jn').appendChild(hint);
      }
      b.addEventListener('click', function () {
        selectedSector = sector;
        draw();
      });
      roster.appendChild(b);
    });
  }

  function drawMap() {
    var svg = $('map');
    var open = {};
    S.places.forEach(function (p) { open[p.key] = p; });
    var parts = [];

    // The view frames what is open rather than the whole world, so six places at the start are a
    // board rather than a cluster in the corner of an empty rectangle. It widens as the network does.
    var xs = [];
    var ys = [];
    S.places.forEach(function (place) {
      var at = LAYOUT[place.key];
      if (at) { xs.push(at.x); ys.push(at.y); }
    });
    var pad = 9;
    var minX = Math.min.apply(null, xs) - pad;
    var maxX = Math.max.apply(null, xs) + pad;
    var minY = Math.min.apply(null, ys) - pad;
    var maxY = Math.max.apply(null, ys) + pad;
    var w = Math.max(maxX - minX, 34);
    var h = Math.max(maxY - minY, 31);
    // Keep the drawn box the same shape as the element so nothing is squashed.
    var ratio = 100 / 92;
    if (w / h < ratio) w = h * ratio; else h = w / ratio;
    var cx = (minX + maxX) / 2;
    var cy = (minY + maxY) / 2;
    svg.setAttribute('viewBox', (cx - w / 2).toFixed(1) + ' ' + (cy - h / 2).toFixed(1)
      + ' ' + w.toFixed(1) + ' ' + h.toFixed(1));
    // Everything drawn scales with the box, so a six-place board and a thirty-four-place one read
    // the same rather than one having hairline links and the other fat ones.
    var unit = w / 100;

    S.places.forEach(function (place) {
      var from = LAYOUT[place.key];
      if (!from) return;
      (S.links.get(place.key) || []).forEach(function (other) {
        var to = LAYOUT[other];
        if (!to || other < place.key) return;
        var live = !place.cutOff && open[other] && !open[other].cutOff;
        parts.push('<line class="link' + (live ? ' live' : '') + '" x1="' + from.x + '" y1="' + from.y
          + '" x2="' + to.x + '" y2="' + to.y + '" stroke-width="' + (0.7 * unit).toFixed(2) + '"/>');
      });
    });

    var findable = findableResidents(S);
    var selectedRadius = 0;
    S.places.forEach(function (place) {
      var at = LAYOUT[place.key];
      if (!at) return;
      var here = findable.filter(function (r) { return r.place === place.key; }).length;
      var st = placeState(place);
      var fill = place.cutOff ? '#a2412c'
        : (place.covered ? '#6f9fd8' : (st.cls === 'stop' ? '#e5794b' : '#57a87a'));
      var radius = Math.max(1.4, Math.min(3.4, 1.2 + Math.sqrt(here) / 3)) * unit;
      if (place.key === selectedPlace) selectedRadius = radius;
      parts.push('<g class="node" data-place="' + place.key.replace(/"/g, '') + '">'
        + '<circle cx="' + at.x + '" cy="' + at.y + '" r="' + radius.toFixed(2) + '" fill="' + fill + '"/>'
        + (place.key === selectedPlace
          ? '<circle class="sel" cx="' + at.x + '" cy="' + at.y + '" r="' + (radius + 1.6 * unit).toFixed(2)
            + '" stroke-width="' + (0.7 * unit).toFixed(2) + '"/>'
          : '')
        + '</g>');
    });

    // Only the selected place is named on the map. Labelling every region collided with the nodes on
    // a full board and told the reader nothing the list below does not; where the selected place sits
    // is the one thing the picture cannot say on its own.
    var chosen = LAYOUT[selectedPlace];
    if (chosen) {
      // Clear of the node and its selection ring, both of which grow with the place.
      var size = 2.9 * unit;
      var above = chosen.y - (selectedRadius + 1.6 * unit + size * 0.9);
      parts.push('<text x="' + chosen.x + '" y="' + above.toFixed(2) + '" '
        + 'font-size="' + size.toFixed(2) + '">' + short(selectedPlace) + '</text>');
    }

    svg.innerHTML = parts.join('');
    Array.prototype.forEach.call(svg.querySelectorAll('.node'), function (node) {
      node.addEventListener('click', function () {
        selectedPlace = node.getAttribute('data-place');
        selectedSector = null;
        draw();
      });
    });
  }

  function drawBars() {
    var bars = $('bars');
    bars.innerHTML = '';
    var present = presentSkills(S);
    var sectors = Object.keys(S.skillsBySector);
    sectors.map(function (sector) {
      var total = S.skillsBySector[sector];
      var held = total - missingInSector(S, sector, present).length;
      return { sector: sector, total: total, held: held };
    }).sort(function (a, b) {
      return (a.held / a.total) - (b.held / b.total) || b.total - a.total;
    }).forEach(function (row) {
      var el = document.createElement('div');
      el.className = 'barrow';
      var pct = row.total === 0 ? 100 : (row.held / row.total) * 100;
      el.innerHTML = '<span class="nm"></span><span class="num"></span>'
        + '<span class="track"><span class="fill' + (row.held >= row.total ? ' done' : '')
        + '" style="width:' + pct.toFixed(1) + '%"></span></span>';
      el.querySelector('.nm').textContent = row.sector;
      el.querySelector('.num').textContent = row.held + '/' + row.total;
      bars.appendChild(el);
    });
  }

  function drawEvents() {
    var box = $('events');
    box.innerHTML = '';
    if (events.length === 0) { box.textContent = ' '; return; }
    events.forEach(function (e) {
      var d = document.createElement('div');
      if (e.tone) d.className = e.tone;
      d.textContent = e.text;
      box.appendChild(d);
    });
  }

  function drawOver() {
    var box = $('overBox');
    box.innerHTML = '';
    if (!S.over) return;
    var el = document.createElement('div');
    el.className = 'over';
    var reached = S.places.filter(function (p) { return !p.cutOff; })
      .reduce(function (a, p) { return a + p.standsFor; }, 0);
    var t = document.createElement('div');
    t.className = 't';
    t.textContent = S.over.won ? 'Every skill present, year ' + S.over.year : 'Two generations, and not done';
    el.appendChild(t);
    var p1 = document.createElement('p');
    p1.textContent = S.over.won
      ? 'All ' + S.taxonomySkills + ' of them held by somebody findable, in a place still joined to the '
        + 'network. ' + S.places.length + ' places open, ' + fmt(reached) + ' of 5,000,000 reached.'
      : (S.taxonomySkills - missingCount(S)) + ' of ' + S.taxonomySkills + ' skills present at the end. '
        + S.places.filter(function (p) { return p.cutOff; }).length + ' places cut off, '
        + fmt(reached) + ' of 5,000,000 still reached.';
    el.appendChild(p1);
    var p2 = document.createElement('p');
    p2.textContent = 'Community Value Index settled ' + billions(S.settledIndex) + ', against '
      + billions(S.projectedIndex) + ' waiting to happen. Neither is money and neither can be cashed.';
    el.appendChild(p2);
    box.appendChild(el);
  }

  // --- Actions -------------------------------------------------------------------------------------

  function spend(ok) {
    if (!ok) { say('Nothing to do there.', 'bad'); draw(); return; }
    S.actsLeft -= 1;
    if (S.actsLeft <= 0) {
      var before = presentSkills(S).size;
      var peopleBefore = S.residents.length;
      endYear(S);
      var after = presentSkills(S).size;
      var gained = after - before;
      var arrived = S.residents.length - peopleBefore;
      if (gained > 0) say(gained + (gained === 1 ? ' skill' : ' skills') + ' present that were not.', 'good');
      if (arrived > 0) say(arrived + (arrived === 1 ? ' person' : ' people') + ' found.', 'good');
      var lost = S.places.filter(function (p) { return p.cutOff; }).length;
      if (lost > 0) say(lost + (lost === 1 ? ' place is' : ' places are') + ' cut off.', 'bad');
      if (!S.over) {
        beginYear(S);
        S.actsLeft = actionsThisYear(S);
      }
    }
    save();
    draw();
  }

  function wire() {
    $('teach').addEventListener('click', function () {
      if (!selectedSector) { say('Pick a job in the list first.', 'bad'); draw(); return; }
      spend(ACTIONS.teach(S, selectedSector, selectedPlace));
    });
    $('look').addEventListener('click', function () { spend(ACTIONS.look(S, selectedPlace)); });
    $('reach').addEventListener('click', function () { spend(ACTIONS.reach(S, selectedPlace)); });
    $('arith').addEventListener('click', function () { spend(ACTIONS.showTheArithmetic(S)); });
    $('openWay').addEventListener('click', function () {
      var room = regionsWithRoom(S);
      if (room.size === 0) { say('Everywhere is open.', 'bad'); draw(); return; }
      // Somewhere already started before somewhere new, because a region's first place costs two
      // actions and leaving one half-open spends them twice.
      var started = [];
      var fresh = [];
      room.forEach(function (count, key) {
        if (S.places.some(function (p) { return p.region === key; })) started.push(key);
        else fresh.push(key);
      });
      var target = started[0] || fresh[0];
      var openBefore = S.places.length;
      var ok = ACTIONS.openAWay(S, target);
      if (ok && S.places.length === openBefore) {
        say('Getting there at all takes more than one year of effort. One more action and somebody is '
          + 'in ' + (REGION_POINTS[target] ? REGION_POINTS[target].name : 'there') + '.');
      } else if (ok) {
        var latest = S.places[S.places.length - 1];
        selectedPlace = latest.key;
        say('A way into ' + latest.key + '.', 'good');
      }
      spend(ok);
    });
    $('reset').addEventListener('click', function () {
      start((Math.random() * 0xffffffff) >>> 0);
    });
    $('seedPlay').addEventListener('click', function () {
      var raw = $('seedInput').value.replace(/[^0-9]/g, '');
      if (!raw) { say('A seed is a number.', 'bad'); draw(); return; }
      start(Number(raw) >>> 0);
    });
    $('seedCopy').addEventListener('click', function () {
      var value = String(S.seed);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(function () {
          say('Seed ' + value + ' copied. Anybody who plays it gets this exact world.', 'good');
          draw();
        }, function () { fallbackCopy(value); });
      } else { fallbackCopy(value); }
    });
  }

  function fallbackCopy(value) {
    var input = $('seedInput');
    input.value = value;
    input.select();
    try { document.execCommand('copy'); } catch (e) { /* the number is in the field either way */ }
    say('Seed ' + value + ' is in the field. Anybody who plays it gets this exact world.');
    draw();
  }

  // --- Item 9: what this is, behind a disclosure ------------------------------------------------------

  function drawAbout() {
    var about = $('about');
    if (about.dataset.built === 'yes') {
      about.querySelector('#nameToggle').checked = showSchemeNames;
      return;
    }
    about.dataset.built = 'yes';
    about.innerHTML = '<summary>What this is</summary>'
      + '<h3>Where the board came from</h3>'
      + '<p>147 people, because that is how many are on the Charging The Future Directory. Not those '
      + 'people: the shape of them. How many hold one skill and how many hold nine, which parts of '
      + 'the work they sit in, how thin each capability is. Everybody here was generated from those '
      + 'counts, and no name or skill was read from anybody’s listing.</p>'
      + '<p>The six places it opens with are where the Directory currently says its people are. That '
      + 'is not the same as where survivors are. Country is a required field, and on a listing built '
      + 'for somebody rather than by them it was filled in from what could be worked out — which '
      + 'skews to the United States, because writing in English reads as American whether or not it '
      + 'is. People correct it themselves once they claim a listing. So the opening board is a '
      + 'starting position, not a census.</p>'
      + '<h3>Why it is not one walled place</h3>'
      + '<p>A single settlement is the shape this adversary is built to take: one address, one set of '
      + 'links, one thing to cut. So no place here holds all thirteen jobs and none is meant to. A '
      + 'place runs when the network it is joined to can fill them, which is why somewhere with four '
      + 'people runs — it is joined to somewhere with the rest, and cutting that link is the '
      + 'attack that matters.</p>'
      + '<h3>How a year goes</h3>'
      + '<p>A card, then your actions, then the year resolves. The dice choose which and when, never '
      + 'whether: which person is reached, which skill turns up, which place isolation grows in. A '
      + 'good run is not a lucky one.</p>'
      + '<p>Actions grow as the board does, because a network of thirty places cannot be held with '
      + 'the three moves six places were held with.</p>'
      + '<h3>Why teaching is the only thing that finishes it</h3>'
      + '<p>Teaching reaches people in proportion to how many already do that work. One person '
      + 'teaches one; sixty-eight teach the board. Du Bois counted it: 2,000 trained 50,000, who '
      + 'taught nine millions. So the thin parts of the list are the hard part — three of the '
      + 'twenty carry a dozen or more skills and rest on one person each, and nobody with those '
      + 'skills walks in by chance. Only teaching reaches them.</p>'
      + '<h3>Who gets in</h3>'
      + '<p>Somebody arrives, you see what they can do, and you never learn what they are. There is '
      + 'no way to check and there is no control here that would let you. The network runs on '
      + 'exchange, so somebody offering none stops being around without anybody deciding it. That is '
      + 'the filter, and it is why looking for people is worth less than the number on the button.</p>'
      + '<h3>Nothing stays held</h3>'
      + '<p>A place reached for good comes off the worry list, and some years it comes back on. The '
      + 'other side does not stop when a place stops being interesting. Holding the network is not a '
      + 'job that finishes, which is the difference between this and a game you can solve.</p>'
      + '<h3>The two figures</h3>'
      + '<p>Settled is what was actually exchanged. Waiting is what the open posts would add if every '
      + 'one of them closed, and most never do. Both are a relative index in the spirit of GDP. '
      + 'Neither is money, a price, or anything anybody can cash.</p>'
      + '<h3>Winning and losing</h3>'
      + '<p>Win by having all 657 skills present in the same year — each held by somebody '
      + 'findable, in a place still joined to the network. 657 is what the list held on '
      + '<span id="countedOn"></span>; it grows, so the number here is the one this was built with. '
      + 'Lose when two generations pass and it is not done. There is no opponent: what you are '
      + 'playing against is the clock, the people who say it cannot be done, and what is done to the '
      + 'links between places.</p>'
      + '<h3>Seeds</h3>'
      + '<p>A seed is the world in one number. The same number gives the same board, the same draws and the '
      + 'same dice, so two people playing one seed are playing the identical run and can compare what '
      + 'they built. Nothing is sent anywhere — the number is the entire arrangement.</p>'
      + '<h3>The named list</h3>'
      + '<p>What is done to the network here is drawn from the app’s own named list of methods. '
      + 'The card tells you what happened; the name sits behind a line you can open if you want it. '
      + 'It is closed to begin with because somebody should be able to play this without reading the '
      + 'name of something they have lived through.</p>'
      + '<label class="toggle"><input type="checkbox" id="nameToggle"> Open the names by default</label>';
    $('countedOn').textContent = SOURCES.taxonomy.pulledOn;
    var toggle = $('nameToggle');
    toggle.checked = showSchemeNames;
    toggle.addEventListener('change', function () {
      showSchemeNames = toggle.checked;
      save();
      draw();
    });
  }

  // --- Drawing everything ---------------------------------------------------------------------------

  function draw() {
    var present = presentSkills(S);
    $('skills').textContent = present.size;
    $('total').textContent = S.taxonomySkills;
    $('year').textContent = S.year;
    $('years').textContent = S.years;
    $('acts').textContent = S.over ? 0 : S.actsLeft;
    $('people').textContent = findableResidents(S).length;
    $('reached').textContent = fmt(S.places
      .filter(function (p) { return !p.cutOff; })
      .reduce(function (a, p) { return a + p.standsFor; }, 0));
    $('settled').textContent = billions(S.settledIndex);
    $('projected').textContent = billions(S.projectedIndex);
    $('seedInput').value = String(S.seed);

    var busy = !!S.card || !!S.over;
    ['teach', 'look', 'reach', 'arith', 'openWay'].forEach(function (id) {
      $(id).disabled = busy;
    });

    drawCardBox();
    drawOver();
    drawPlaces();
    drawRoster();
    drawEvents();
    drawMap();
    drawBars();
    drawAbout();
  }

  // --- Go ------------------------------------------------------------------------------------------

  var saved = load();
  showSchemeNames = !!saved.names;
  wire();
  start(typeof saved.seed === 'number' ? saved.seed : (Math.random() * 0xffffffff) >>> 0);
}());
