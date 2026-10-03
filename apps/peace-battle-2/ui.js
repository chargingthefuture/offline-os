// Peace Battle 2 — The Lit Country. The screen around the map.
//
// Loads the data, keeps the save, wires the day bar, the sheets and the two panes, and hands
// every rule to game.js. Nothing in here decides what happens in the game.

import * as G from './game.js';
import { GOALS, OWN_GOALS } from './content.js';
import { createRenderer } from './render.js';

const KEY = 'peace-battle-2';
const $ = (id) => document.getElementById(id);

let data, state, renderer, endRenderer;
let hand = false;
let busy = false;
let lastSeed = '';

async function loadJson(name) {
  const res = await fetch('data/' + name);
  if (!res.ok) throw new Error('could not load ' + name);
  return res.json();
}

async function loadSave() {
  try {
    const hit = await window.storage.get(KEY);
    return hit ? G.deserialize(hit.value) : null;
  } catch (e) {
    console.warn('[peace-battle-2] save unreadable', e);
    return null;
  }
}
function save() { return window.storage.set(KEY, G.serialize(state)); }

async function boot() {
  const [taxonomy, sectors, baseline] = await Promise.all([loadJson('taxonomy.json'), loadJson('sectors.json'), loadJson('baseline.json')]);
  data = G.prepareData(taxonomy, sectors, baseline);
  renderer = createRenderer($('map'), onTap);
  renderer.setSectors(data.sectors.length);
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);
  buildDayBar();
  wire();
  const saved = await loadSave();
  if (saved) { state = saved; startPlaying(); }
  else showStart();
  requestAnimationFrame(frame);
}

function sizeCanvas() {
  const c = $('map');
  const w = c.getBoundingClientRect().width;
  const room = window.innerHeight - c.getBoundingClientRect().top - 90;
  c.style.height = Math.max(260, Math.min(w, room)) + 'px';
  renderer.resize();
}

function frame(now) {
  if (state && !$('play').classList.contains('hidden')) renderer.draw(now);
  requestAnimationFrame(frame);
}

// --- Start ----------------------------------------------------------------------------------------

function showStart(seedText) {
  const pane = $('start');
  const seed = seedText || G.randomSeed();
  let html = '<div class="inner"><h1>Pick your trade</h1><p>Your hearth lights with it. Everything on the map has one.</p>';
  html += '<div class="seedline"><input id="seedIn" value="' + esc(seed) + '" aria-label="Seed" spellcheck="false"></div>';
  html += '<div class="row" style="display:flex;gap:8px;margin:10px 0 18px"><button class="act amber" id="surprise" style="flex:1">Surprise me</button></div>';
  html += '<div class="trades">';
  data.sectors.forEach((sec) => {
    html += '<div><h3>' + esc(sec.name) + '</h3><div class="grid">';
    sec.titles.forEach((t, ti) => { html += '<button data-s="' + sec.i + '" data-t="' + ti + '">' + esc(t) + '</button>'; });
    html += '</div></div>';
  });
  html += '</div></div>';
  pane.innerHTML = html;
  pane.classList.remove('hidden');
  pane.querySelectorAll('.trades button').forEach((b) => b.addEventListener('click', () => begin(+b.dataset.s, +b.dataset.t)));
  $('surprise').addEventListener('click', () => {
    const sec = data.sectors[Math.floor(Math.random() * data.sectors.length)];
    begin(sec.i, Math.floor(Math.random() * sec.titles.length));
  });
}

function begin(sector, title) {
  const seed = ($('seedIn').value || '').trim() || G.randomSeed();
  state = G.createGame(seed, data, { GOALS, OWN_GOALS }, { sector, title, name: data.sectors[sector].titles[title] });
  $('start').classList.add('hidden');
  save();
  startPlaying();
}

function startPlaying() {
  renderer.setState(state);
  renderer.fit();
  hand = false;
  updateHud();
  if (state.ended) showEnd();
}

// --- HUD ------------------------------------------------------------------------------------------

function buildDayBar() {
  const bar = $('daybar');
  bar.innerHTML = '';
  for (let i = 0; i < G.SEGMENTS; i++) {
    const d = document.createElement('div');
    d.className = 'seg';
    bar.appendChild(d);
  }
  bar.lastChild.addEventListener('click', () => {
    if (!G.canSpend(state) || busy) return;
    hand = !hand;
    renderer.setHand(hand ? [20, 20] : null);
    updateHud();
    if (hand) banner('Now tap a card on the map.', true);
    else hideBanner();
  });
}

function updateHud() {
  const s = state;
  const total = data.skills.length;
  const sup = G.supply(s, data);
  $('supN').textContent = Math.round(sup * 100) + '%';
  $('supFill').style.width = (sup * 100).toFixed(2) + '%';
  $('supGray').style.width = ((data.fixed.length / total) * 100).toFixed(2) + '%';
  const ex = s.history.length ? s.history[s.history.length - 1] : 0;
  const scale = Math.max(500, ...s.history);
  $('exN').textContent = ex;
  $('exFill').style.width = ((ex / scale) * 100).toFixed(2) + '%';
  $('exMark').style.left = ((G.MARKER / scale) * 100).toFixed(2) + '%';
  $('dayCounter').textContent = 'Day ' + s.day + ' · Year ' + G.year(s);

  const sun = $('daybar').lastChild;
  sun.className = 'seg';
  if (s.today.fog) { sun.classList.add('taken'); $('dayLabel').textContent = 'The attacks took today.'; $('dayLabel').classList.add('took'); }
  else if (s.today.spent) { sun.classList.add('spent'); $('dayLabel').textContent = 'Spent.'; $('dayLabel').classList.remove('took'); }
  else { sun.classList.add('sun'); if (hand) sun.classList.add('hand'); $('dayLabel').textContent = 'Your five percent.'; $('dayLabel').classList.remove('took'); }
  $('dayNote').textContent = s.lamp.on ? 'Lamp on' : (s.day >= G.LAMP_DAY ? 'Lamp offered at your hearth' : '');

  $('btnPost').disabled = busy || !!s.ended || s.cards.some((c) => c.own);
  $('btnNext').disabled = busy || !!s.ended;
  $('btnNext').textContent = s.today.fog ? 'Next day' : 'Skip the day';
  $('btnNext').classList.toggle('amber', !!s.today.fog);
}

function banner(text, quiet) {
  const b = $('banner');
  b.textContent = text;
  b.classList.toggle('quiet', !!quiet);
  b.classList.remove('hidden');
}
function hideBanner() { $('banner').classList.add('hidden'); }

// --- Taps on the map ---------------------------------------------------------------------------------

function onTap(hit, at) {
  if (busy || !state || state.ended) return;
  if (!hit) { if (hand) renderer.setHand(at); return; }
  if (hit.type === 'card') return openCard(hit.id);
  if (hit.type === 'you') return openYou();
  if (hit.type === 'hearth') return openHearth(hit.i);
}

function openCard(id) {
  const c = state.cards.find((x) => x.id === id);
  if (!c) return;
  const goal = (c.own ? OWN_GOALS : GOALS)[c.g];
  const h = state.hearths[c.h];
  const title = data.sectors[h.s].titles[h.t];
  let html = '<div class="grab"></div><h2>' + esc(goal.goal) + '</h2>';
  html += '<div class="who">' + (c.own ? 'Your goal, on your hearth' : esc(title) + ' · ' + (h.lit ? 'lit' : 'dark') + ' hearth') + '</div>';
  c.tasks.forEach((t, i) => {
    const full = t.got.length >= t.need;
    const mine = t.got.includes(state.you);
    let dots = '';
    for (let k = 0; k < t.need; k++) {
      const who = t.got[k];
      dots += '<span class="dot' + (who === undefined ? '' : who === state.you ? ' you' : ' on') + '"></span>';
    }
    const names = t.got.map((who) => who === state.you ? 'you' : trade(who)).join(', ');
    html += '<div class="task' + (full || mine ? ' full' : '') + '" data-i="' + i + '"><div><div class="tt">' + esc(goal.tasks[t.t]) + '</div>' +
      (names ? '<div class="names">' + esc(names) + '</div>' : '') + '</div><div class="dots">' + dots + '</div></div>';
  });
  if (!G.canSpend(state)) html += '<p class="hint">' + (state.today.fog ? 'The attacks took today. Nothing here is lost.' : 'Your five percent is spent. The others arrive over the next days.') + '</p>';
  else if (!c.own && !c.tasks.some((t) => t.got.includes(state.you))) html += '<p class="hint">Tap a task to put your five percent on it. The card moves once somebody has taken it.</p>';
  else html += '<p class="hint">Tap a task to spend your five percent on it.</p>';
  openSheet(html);
  $('sheet').querySelectorAll('.task').forEach((row) => row.addEventListener('click', () => {
    const i = +row.dataset.i;
    if (!G.spend(state, c.id, i)) return;
    hand = false; renderer.setHand(null);
    closeSheet();
    endDay();
  }));
}

function trade(hi) { const h = state.hearths[hi]; return data.sectors[h.s].titles[h.t]; }

function openHearth(i) {
  const h = state.hearths[i];
  const land = state.lands[h.land];
  let html = '<div class="grab"></div><h2>' + esc(trade(i)) + '</h2><div class="who">' + (land.sing ? 'In a singing land' : h.lit ? 'Lit' : 'Dark') + '</div>';
  html += '<p class="hint">' + (h.lit ? 'This hearth sends slivers to the cards near it.' : 'A card on a dark hearth lights it when the goal is reached. Light also spreads from lit neighbors.') + '</p>';
  openSheet(html);
}

function openYou() {
  const s = state;
  let html = '<div class="grab"></div><h2>Your hearth</h2><div class="who">' + esc(s.trade.name) + (s.youLevel ? ' · burning brighter' : '') + '</div>';
  const own = s.cards.find((c) => c.own);
  if (own) html += '<p class="hint">Your goal is posted: ' + esc(OWN_GOALS[own.g].goal) + '. Tap its card to see who has arrived.</p>';
  html += '<div class="row">';
  html += '<button class="act" id="shPost"' + (own ? ' disabled' : '') + '>Post a goal</button>';
  if (s.lamp.on) html += '<button class="act" disabled>Lamp on</button>';
  else html += '<button class="act amber" id="shLamp"' + (s.day < G.LAMP_DAY ? ' disabled' : '') + '>Take it further</button>';
  html += '</div>';
  html += '<p class="hint">' + (s.lamp.on ? 'The lamp names a first customer and lights one more road a day on its own.' : s.day < G.LAMP_DAY ? 'The lamp is offered from day ' + G.LAMP_DAY + '. Optional; the game is complete without it.' : 'The lamp is optional. The game is complete without it.') + '</p>';
  openSheet(html);
  const p = $('shPost'); if (p) p.addEventListener('click', () => { closeSheet(); openPost(); });
  const l = $('shLamp'); if (l) l.addEventListener('click', () => { if (G.lampOn(state)) { save(); closeSheet(); updateHud(); banner('The lamp is on. Its first customer is a ' + trade(state.lamp.customer).toLowerCase() + '.'); } });
}

function openPost() {
  if (state.cards.some((c) => c.own)) return;
  let html = '<div class="grab"></div><h2>Post a goal</h2><div class="who">On your hearth. Other hearths finish it.</div><div class="opt-list">';
  OWN_GOALS.forEach((g, i) => { html += '<button data-i="' + i + '">' + esc(g.goal) + '<span class="sub2">' + esc(g.tasks.join(' · ')) + '</span></button>'; });
  html += '</div>';
  openSheet(html);
  $('sheet').querySelectorAll('.opt-list button').forEach((b) => b.addEventListener('click', () => {
    if (G.postGoal(state, { GOALS, OWN_GOALS }, +b.dataset.i)) { save(); closeSheet(); updateHud(); }
  }));
}

function openMenu() {
  const s = state;
  let html = '<div class="grab"></div><h2>Seed</h2><div class="who">A seed replays the same map.</div>';
  html += '<div class="seedline"><input id="seedShow" value="' + esc(s.seed) + '" readonly aria-label="This seed"><button class="act" id="copySeed">Copy</button></div>';
  html += '<div class="seedline"><input id="seedNew" placeholder="Another seed" aria-label="Another seed" spellcheck="false"><button class="act" id="playSeed">Play this seed</button></div>';
  html += '<div class="row"><button class="act" id="restart">Start again</button><button class="act" id="closeMenu">Close</button></div>';
  openSheet(html);
  $('copySeed').addEventListener('click', () => copy(s.seed, $('copySeed')));
  $('playSeed').addEventListener('click', () => { const v = $('seedNew').value.trim(); if (v) restart(v); });
  $('restart').addEventListener('click', () => restart());
  $('closeMenu').addEventListener('click', closeSheet);
}

async function restart(seedText) {
  closeSheet();
  $('end').classList.add('hidden');
  await window.storage.remove(KEY);
  state = null;
  hideBanner();
  showStart(seedText);
}

function copy(text, btn) {
  const done = () => { if (btn) { const t = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = t; }, 1200); } };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, done);
  else done();
}

function openSheet(html) { const sh = $('sheet'); sh.innerHTML = html; sh.classList.remove('hidden'); }
function closeSheet() { $('sheet').classList.add('hidden'); }

// --- The day ends -----------------------------------------------------------------------------------

function endDay() {
  if (busy || state.ended) return;
  busy = true;
  hand = false; renderer.setHand(null);
  const done = state.today;
  G.advance(state, data, { GOALS, OWN_GOALS });
  const now = performance.now();
  renderer.dayAnimation(done, now);
  updateHud();
  save();
  setTimeout(() => {
    busy = false;
    updateHud();
    const notes = [];
    for (const r of done.reached) notes.push(r.own ? 'Your goal is reached: ' + r.goal + '.' : 'Reached: ' + r.goal + '.');
    for (const li of done.sung) notes.push('A land sings.');
    if (state.milestone && !state.milestoneShown) { state.milestoneShown = true; save(); notes.unshift('384. The nearer marker.'); }
    if (state.today.fog) notes.push('The attacks took today.');
    if (notes.length) banner(notes.join(' ')); else hideBanner();
    if (state.ended) showEnd();
  }, 1500);
}

// --- Win and lose ------------------------------------------------------------------------------------

function showEnd() {
  const s = state;
  const pane = $('end');
  const won = s.ended === 'win';
  let html = '<div class="inner"><h1>' + (won ? 'The lit country' : 'Two generations, and not done.') + '</h1>';
  html += '<p>' + (won ? 'It took ' + G.year(s) + ' years.' : 'The map as it stands after fifty years.') + '</p>';
  html += '<canvas class="endmap" id="endmap"></canvas>';
  if (won) html += '<p class="line">Not 100%: a phone and a vehicle need supply chains no community this size can run.</p>';
  html += '<div class="seedline"><input value="' + esc(s.seed) + '" readonly aria-label="Seed"><button class="act" id="endCopy">Copy seed</button></div>';
  html += '<div class="row" style="display:flex;gap:8px;margin-top:10px"><button class="act amber" id="endAgain" style="flex:1">Start again</button></div></div>';
  pane.innerHTML = html;
  pane.classList.remove('hidden');
  $('endCopy').addEventListener('click', () => copy(s.seed, $('endCopy')));
  $('endAgain').addEventListener('click', () => restart());
  endRenderer = createRenderer($('endmap'), () => {});
  endRenderer.setSectors(data.sectors.length);
  endRenderer.setState(s);
  endRenderer.resize();
  const tick = (now) => { if (!pane.classList.contains('hidden')) { endRenderer.draw(now); requestAnimationFrame(tick); } };
  requestAnimationFrame(tick);
}

// --- Wiring ---------------------------------------------------------------------------------------

function wire() {
  $('tabPlay').addEventListener('click', () => showTab('play'));
  $('tabAbout').addEventListener('click', () => showTab('about'));
  $('btnPost').addEventListener('click', openPost);
  $('btnNext').addEventListener('click', () => { closeSheet(); endDay(); });
  $('btnMenu').addEventListener('click', openMenu);
  document.addEventListener('pointerdown', (e) => {
    const sh = $('sheet');
    if (!sh.classList.contains('hidden') && !sh.contains(e.target) && !e.target.closest('.actions')) closeSheet();
  });
}

function showTab(which) {
  $('play').classList.toggle('hidden', which !== 'play');
  $('about').classList.toggle('hidden', which !== 'about');
  $('tabPlay').classList.toggle('on', which === 'play');
  $('tabAbout').classList.toggle('on', which === 'about');
  if (which === 'play' && renderer) sizeCanvas();
}

function esc(t) { return String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// For the headless check in the pull request; reads only.
window.__pb2 = () => ({ state, renderer });

boot().catch((e) => {
  console.error(e);
  banner('The game could not load its data. Open it once with a connection.');
});
