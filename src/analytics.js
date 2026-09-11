/* The event log.
 *
 * Writes one row per thing worth knowing - a level started, finished, replayed,
 * a booster spent, a dead end hit, a level skipped - into the Firebase Realtime
 * Database, so the difficulty of a level can be argued from what players
 * actually did rather than from what the solver thinks.
 *
 * Rows land under `events/<YYYY-MM-DD>/<key>`. Sharding by day keeps any one
 * node from growing without bound, makes a day's export a single GET, and
 * makes deleting old data a single DELETE.
 *
 * ⚠ Nothing here may break the game. Every call is fire-and-forget, every
 * failure is swallowed, and nothing the game does waits on a request. An
 * analytics outage must look exactly like an analytics outage, not like a
 * broken level.
 *
 * ⚠ The queue lives in memory and nowhere else. Parking it in localStorage
 * would be the obvious way to survive a reload - and on CrazyGames it would be
 * a bug, because Progress Save backs up localStorage verbatim and would sync
 * the analytics backlog into the player's cloud save. Losing the last few
 * events of a killed tab is the cheaper mistake.
 */
(function () {
'use strict';

var BS = window.BS;
var save = BS.save;

/* ------------------------------- settings ------------------------------- */

var CFG = BS.LOG_CFG = {
  /* The database instance, region and all. Found by asking the project:
     the plain `…-default-rtdb.firebaseio.com` host answers 404 with the real
     one, because this database lives in asia-southeast1. */
  URL: 'https://ballsortcolor-e295a-default-rtdb.asia-southeast1.firebasedatabase.app',

  /** where rows go, under the URL above */
  PATH: 'events',

  /** send at most this often, so a busy level is one request and not ten */
  FLUSH_MS: 4000,

  /** ...or sooner, once this many are waiting */
  FLUSH_AT: 12,

  /** a backlog past this is dropped oldest-first rather than grown for ever */
  MAX_QUEUE: 120
};

/* On by default everywhere a real player can be, off everywhere they cannot.
 *
 * ⚠ Off on localhost, and that is not laziness: tests/ boots the whole game in
 * an iframe dozens of times per run, and every one of those would otherwise
 * post a fake player's fake session. Add ?analytics=1 to switch it on locally
 * when you want to watch rows arrive.
 *
 * ⚠ Off under the playtest link too - that session has every level unlocked
 * and a wallet that never existed, so its rows would be noise in exactly the
 * numbers the log is for. */
function enabled() {
  if (!CFG.URL) return false;
  if (BS.playtest) return false;
  var q = '';
  try { q = String(location.search || ''); } catch (e) {}
  if (/[?&]analytics=1/.test(q)) return true;
  if (/[?&](noanalytics|analytics=0)/.test(q)) return false;
  var h = '';
  try { h = String(location.hostname || ''); } catch (e) {}
  return !(h === 'localhost' || h === '127.0.0.1' || h === '' || h === '[::1]');
}

var ON = enabled();

/* --------------------------------- keys --------------------------------- */

/* One id per browser, and one per page load. Together they say "these rows
   are the same person" and "these rows are the same sitting", which is all
   a funnel needs and rather less than a name. */
var SID = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* Row keys sort by time on their own: `Date.now()` in base 36 is eight
   characters wide until the year 5138, so lexicographic order is chronological
   order and the database never has to sort anything. The tail keeps two rows
   written in the same millisecond apart. */
var seq = 0;
function rowKey() {
  return Date.now().toString(36) + '-' +
         (seq++).toString(36) + Math.random().toString(36).slice(2, 6);
}

function today() {
  var d = new Date();
  function p(n) { return (n < 10 ? '0' : '') + n; }
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/* -------------------------------- sending ------------------------------- */

var queue = [];
var timer = null;

function flush(final) {
  if (!ON || !queue.length) return;
  var batch = queue;
  queue = [];
  clearTimeout(timer);
  timer = null;

  var body = {};
  var day = today();
  for (var i = 0; i < batch.length; i++) body[day + '/' + batch[i].k] = batch[i].v;

  var url = CFG.URL.replace(/\/+$/, '') + '/' + CFG.PATH + '.json';
  try {
    /* PATCH with fully-qualified child paths writes the whole batch in one
       request and one round trip. POST would mint a key per row, which is
       tidier and n times slower. */
    fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      /* the page may be closing; ask the browser to finish the send anyway */
      keepalive: !!final,
      /* the response is of no interest and reading it would only cost a CORS
         preflight round trip we have no use for */
      mode: 'cors'
    })['catch'](function () { requeue(batch); });
  } catch (e) { requeue(batch); }
}

/* A failed batch goes back to the front of the line and is tried again with
   the next flush. It is never retried in a loop: a database that is refusing
   writes will refuse them just as firmly a hundred times in a row. */
function requeue(batch) {
  queue = batch.concat(queue);
  trim();
  schedule();
}

function trim() {
  if (queue.length > CFG.MAX_QUEUE) queue = queue.slice(queue.length - CFG.MAX_QUEUE);
}

function schedule() {
  if (timer || !queue.length) return;
  timer = setTimeout(function () { timer = null; flush(false); }, CFG.FLUSH_MS);
}

/* --------------------------------- the log ------------------------------ */

/**
 * Record one event. `name` is the row's `ev`; `props` is merged in beside it.
 * Safe to call before anything is ready and safe to call when logging is off.
 */
function log(name, props) {
  if (!ON) return;
  try {
    var row = { ev: String(name), t: Date.now(), sid: SID, uid: save.uid() };
    if (props) for (var k in props) {
      if (props[k] !== undefined && props[k] !== null) row[k] = props[k];
    }
    queue.push({ k: rowKey(), v: row });
    trim();
    if (queue.length >= CFG.FLUSH_AT) flush(false);
    else schedule();
  } catch (e) { /* analytics never throws into the game */ }
}

BS.log = {
  event: log,
  flush: function () { flush(true); },
  on: function () { return ON; },
  /** queued but not yet sent; for tests */
  pending: function () { return queue.length; },
  /** switch it on or off at run time; for tests */
  enable: function (v) { ON = !!v; }
};

/* ------------------------- what a level looks like ---------------------- */

/* Every row about a level carries the same shape, so `level_start` and
   `level_complete` can be joined on it and a funnel is one group-by. */
function levelFacts() {
  var b = BS.board;
  if (!b || !b.ready || !b.ready()) return {};
  var mode = b.mode(), index = b.index(), src = b.src();
  var f = {
    mode: mode,
    lv: index + 1,                       /* what the player sees, 1-based   */
    puz: src,                            /* the puzzle actually dealt       */
    par: b.par(mode, src) | 0,
    col: b.colorsOf(mode, src) | 0
  };
  try { f.tubes = b.state().length; } catch (e) {}
  /* a swapped-in puzzle is the interesting case, so say so rather than
     leaving the reader to compare two numbers */
  if (src !== index) f.swapped = true;
  if (b.question && b.question.on()) f.question = true;
  if (b.tier && b.tier()) f.tier = b.tier();
  if (b.special && b.special.on()) {
    f.special = true;
    /* for a special level `lv` is meaningless - it has no number in the run -
       so record the classic level it was offered after instead */
    var r = b.special.resume();
    f.lv = 0;
    f.after = r ? r.index : 0;
  }
  return f;
}

function merge(a, b) {
  var o = {}, k;
  for (k in a) o[k] = a[k];
  for (k in b) o[k] = b[k];
  return o;
}

/* --------------------------------- wiring ------------------------------- */

/* How much the level being played has cost so far, so `level_complete` can
   say what finishing took and not merely that it happened. */
var spend = { undo: 0, tube: 0, hint: 0, coins: 0, stuck: 0 };
function resetSpend() { spend = { undo: 0, tube: 0, hint: 0, coins: 0, stuck: 0 }; }

var startedAt = 0;
var lastLevel = '';

BS.on('levelReady', function (info) {
  var key = info.mode + ':' + info.index;
  /* A restart re-runs loadLevel on the same level. That is a replay, not a
     fresh start, and it keeps the tally - the boosters it burned belong to
     this level whichever attempt spent them. */
  if (key === lastLevel) return;
  lastLevel = key;
  resetSpend();
  startedAt = Date.now();
  log('level_start', levelFacts());
});

BS.on('won', function (info) {
  log('level_complete', merge(levelFacts(), {
    moves: info.moves | 0,
    stars: info.stars | 0,
    ms: startedAt ? Date.now() - startedAt : 0,
    undo: spend.undo, tube: spend.tube, hint: spend.hint,
    spent: spend.coins, stuck: spend.stuck
  }));
});

BS.on('replay', function () {
  log('level_replay', merge(levelFacts(), {
    moves: BS.board.moves ? BS.board.moves() : undefined,
    ms: startedAt ? Date.now() - startedAt : 0,
    undo: spend.undo, tube: spend.tube, hint: spend.hint
  }));
});

BS.on('boosterSpent', function (b) {
  if (spend[b.id] !== undefined) spend[b.id]++;
  spend.coins += b.price | 0;
  log('booster', merge(levelFacts(), {
    id: b.id, how: b.how, price: b.price | 0, moves: b.moves | 0
  }));
});

BS.on('stuck', function (info) {
  spend.stuck++;
  log('level_stuck', merge(levelFacts(), {
    /* "none" is no legal move at all; "dead" is moves that all lose */
    kind: info.kind || 'none',
    moves: info.moves | 0
  }));
});

BS.on('skipped', function () {
  log('level_skip', merge(levelFacts(), {
    ms: startedAt ? Date.now() - startedAt : 0,
    undo: spend.undo, tube: spend.tube, hint: spend.hint
  }));
});

/* Taking or turning down a special level is the one decision the player makes
   about difficulty out loud, so it is worth a row of its own. */
BS.on('bonusAnswer', function (a) {
  log('special_offer', { slot: a.slot | 0, puz: a.puzzle, taken: !!a.taken });
});

/* Last chance to get the tail of the session out. `pagehide` fires where
   `unload` is unreliable, and both are ignored on the phone half the time -
   hence `visibilitychange`, which is the one that actually fires when a player
   switches apps. */
function bail() { flush(true); }
window.addEventListener('pagehide', bail);
window.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'hidden') bail();
});

})();
