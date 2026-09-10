/* Progress, wallet and settings.
 *
 * Every key is prefixed `bsp_` so another build's leftovers in the same origin
 * are ignored rather than misread. Keys are split rather than kept in one blob
 * because each write is then tiny — the stars map is the only one that grows,
 * and it only gains an entry for a level actually finished.
 *
 * ⚠ Once people have played, a key may be ADDED but never RENAMED: a rename
 * silently hands every existing player an empty save.
 */
(function () {
'use strict';

var BS = window.BS = window.BS || {};

var K = {
  level:  'bsp_level',    /* {classic,hard} - the level they are on        */
  max:    'bsp_max',      /* {classic,hard} - highest level unlocked       */
  stars:  'bsp_stars',    /* {c777: 2}      - stars earned per level       */
  best:   'bsp_best',     /* {c777: 29}     - fewest moves per level       */
  coins:  'bsp_coins',
  sfx:    'bsp_sfx',
  music:  'bsp_music',
  daily:  'bsp_daily',    /* {streak, last: 'YYYY-MM-DD'}                  */
  seen:   'bsp_seen',     /* has the home screen been shown once           */
  bag:    'bsp_bag'       /* {undo,tube,hint} - boosters owned             */
};

/* --------------------------------- economy ------------------------------ */

var ECON = BS.ECON = {
  START_COINS: 300,
  /* A win pays this, plus a bonus per star above the first: 10 / 15 / 20.
     Read it against the prices below - two clean wins buy a hint, six buy an
     extra tube, so a booster is a real decision rather than a free tap. */
  WIN_COINS: 10,
  STAR_BONUS: 5,
  /* Coming back day after day pays far more than playing does, which is the
     point: it is the reason to open the game tomorrow. */
  DAILY_COINS: [100, 150, 250],
  /* ---------------------------------------------------------------------
   * Boosters follow the shape the original APK uses, which its IL2CPP
   * metadata spells out plainly:
   *
   *   UndoNumber / AddUndo / ReduceUndo   - undos are an owned count
   *   TubeCount / TubeBoosterCount        - so are extra tubes
   *   FreeAddTubeNum + UseFreeCount       - ...on top of a free allowance
   *                                         that resets every level
   *   ClearHintNum / _maxHintLimit        - the hint has a per-level limit
   *   EventShopUndoCoinClick / ...RVClick - out of stock, you buy with coins
   *                                         or watch a rewarded video
   *
   * There are no ads here, so the video path is dropped and coins are the
   * only top-up. The live game reads its own numbers from a remote config
   * (DynamicUndoCount, DynamicAddTubeScore, ...), so the prices and counts
   * below are ours - the shape is theirs.
   * ------------------------------------------------------------------- */
  START_BAG:  { undo: 5, tube: 2, hint: 3 },
  /** free uses granted at the start of every level, before the bag is touched */
  FREE_PER_LEVEL: { undo: 0, tube: 1, hint: 1 },
  /** what the shop sells: coins -> how many of the booster */
  PACKS: [
    { id: 'undo', icon: '↺',  name: 'Hoàn tác', qty: 3, price: 30 },
    { id: 'tube', icon: '＋', name: 'Thêm ống', qty: 2, price: 60 },
    { id: 'hint', icon: '💡', name: 'Gợi ý',    qty: 3, price: 45 }
  ]
};

/* --------------------------------- storage ------------------------------ */

function read(key, dflt) {
  try {
    var v = localStorage.getItem(key);
    return v === null ? dflt : JSON.parse(v);
  } catch (e) { return dflt; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

/** one level's slot in the stars / best maps */
function slot(mode, index) { return mode.charAt(0) + index; }

/* ------------------------------- migration ------------------------------ */
/* The first builds kept everything in one `ballsort.progress.v1` blob. Carry
   it across once so nobody who played those loses their place. */
(function migrate() {
  if (read(K.level, null) !== null) return;
  var old = read('ballsort.progress.v1', null);
  if (!old) return;
  write(K.level, { classic: old.classic | 0, hard: old.hard | 0 });
  write(K.max, { classic: old['classic.max'] | 0, hard: old['hard.max'] | 0 });
  if (old.sfx === false) write(K.sfx, false);
  if (old.music === false) write(K.music, false);
  var best = {};
  for (var k in old) {
    var m = /^b\.(classic|hard)\.(\d+)$/.exec(k);
    if (m) best[slot(m[1], +m[2])] = old[k];
  }
  if (Object.keys(best).length) write(K.best, best);
})();

/* --------------------------------- api ---------------------------------- */

var save = BS.save = {

  /* ------- where the player is ------- */

  level: function (mode) {
    return (read(K.level, {})[mode] | 0);
  },
  setLevel: function (mode, index) {
    var m = read(K.level, {});
    m[mode] = index;
    write(K.level, m);
  },
  /** highest level reached; everything past it is locked */
  max: function (mode) {
    return (read(K.max, {})[mode] | 0);
  },
  unlock: function (mode, index) {
    var m = read(K.max, {});
    if (index > (m[mode] | 0)) { m[mode] = index; write(K.max, m); }
  },
  locked: function (mode, index) {
    return index > save.max(mode);
  },

  /* ------- how well they did ------- */

  stars: function (mode, index) {
    return read(K.stars, {})[slot(mode, index)] | 0;
  },
  best: function (mode, index) {
    return read(K.best, {})[slot(mode, index)] | 0;
  },
  totalStars: function (mode) {
    var m = read(K.stars, {}), n = 0, pre = mode.charAt(0);
    for (var k in m) if (k.charAt(0) === pre) n += m[k];
    return n;
  },
  /** how many levels of this mode have been finished at least once */
  cleared: function (mode) {
    var m = read(K.stars, {}), n = 0, pre = mode.charAt(0);
    for (var k in m) if (k.charAt(0) === pre) n++;
    return n;
  },

  /* ------- the wallet ------- */

  coins: function () {
    var v = read(K.coins, null);
    if (v === null) { write(K.coins, ECON.START_COINS); return ECON.START_COINS; }
    return v | 0;
  },
  addCoins: function (n) {
    var v = Math.max(0, save.coins() + (n | 0));
    write(K.coins, v);
    BS.emit('coins', v);
    return v;
  },
  /** true if the player could afford it and it has been taken */
  spend: function (n) {
    if (save.coins() < n) return false;
    save.addCoins(-n);
    return true;
  },

  /**
   * Record a finished level. Returns what it paid and whether anything about
   * the result was a personal best, so the popup can show it.
   */
  finish: function (mode, index, moves, stars) {
    var starMap = read(K.stars, {});
    var bestMap = read(K.best, {});
    var s = slot(mode, index);

    var hadStars = starMap[s] | 0;
    var prevBest = bestMap[s] | 0;
    var firstTime = !hadStars;
    var record = !prevBest || moves < prevBest;

    if (stars > hadStars) { starMap[s] = stars; write(K.stars, starMap); }
    if (record) { bestMap[s] = moves; write(K.best, bestMap); }
    save.unlock(mode, index + 1);

    /* Only the first clear pays. Replaying a level for a better score is
       worth doing for the stars, but it must not be a coin faucet. */
    var coins = firstTime
      ? ECON.WIN_COINS + ECON.STAR_BONUS * Math.max(0, stars - 1)
      : 0;
    if (coins) save.addCoins(coins);

    return {
      coins: coins, firstTime: firstTime, record: record,
      best: record ? moves : prevBest, prevStars: hadStars
    };
  },

  /* ------- settings ------- */

  sfxOn: function () { return read(K.sfx, true) !== false; },
  musicOn: function () { return read(K.music, true) !== false; },
  setAudio: function (sfxOn, musicOn) {
    write(K.sfx, !!sfxOn);
    write(K.music, !!musicOn);
  },

  seen: function () { return read(K.seen, false) === true; },
  setSeen: function () { write(K.seen, true); },

  /* ------- the booster bag ------- */

  bag: function () {
    var b = read(K.bag, null);
    if (!b) { b = { undo: ECON.START_BAG.undo, tube: ECON.START_BAG.tube,
                    hint: ECON.START_BAG.hint }; write(K.bag, b); }
    return b;
  },
  own: function (id) { return save.bag()[id] | 0; },
  /** add (or with a negative n, take) boosters; never goes below zero */
  addBooster: function (id, n) {
    var b = save.bag();
    b[id] = Math.max(0, (b[id] | 0) + (n | 0));
    write(K.bag, b);
    BS.emit('bag', b);
    return b[id];
  },
  /** take one from the bag; false if the bag is empty */
  useBooster: function (id) {
    if (save.own(id) <= 0) return false;
    save.addBooster(id, -1);
    return true;
  },
  /** buy a shop pack by index; false if it is not affordable */
  buyPack: function (i) {
    var pack = ECON.PACKS[i];
    if (!pack || !save.spend(pack.price)) return false;
    save.addBooster(pack.id, pack.qty);
    return true;
  },

  /* ------- daily reward ------- */

  /**
   * `{ day, ready }` - which day of the streak is next, and whether it can be
   * taken now. The streak resets if a whole day was missed.
   */
  daily: function () {
    var d = read(K.daily, null) || { streak: 0, last: '' };
    var today = save.today();
    if (d.last === today) return { day: d.streak, ready: false, streak: d.streak };
    var next = (d.last === save.today(-1)) ? d.streak + 1 : 1;
    if (next > ECON.DAILY_COINS.length) next = 1;   /* the card loops */
    return { day: next, ready: true, streak: d.streak };
  },
  claimDaily: function () {
    var st = save.daily();
    if (!st.ready) return 0;
    var coins = ECON.DAILY_COINS[st.day - 1] || 0;
    write(K.daily, { streak: st.day, last: save.today() });
    save.addCoins(coins);
    return coins;
  },
  /** local YYYY-MM-DD, `shift` days from today */
  today: function (shift) {
    var d = new Date();
    if (shift) d.setDate(d.getDate() + shift);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) +
           '-' + ('0' + d.getDate()).slice(-2);
  },

  /** wipe everything - used by the settings screen */
  reset: function () {
    for (var k in K) { try { localStorage.removeItem(K[k]); } catch (e) {} }
    try { localStorage.removeItem('ballsort.progress.v1'); } catch (e) {}
  }
};

/* ----------------------------- tiny event bus ---------------------------- */
/* The wallet shows in three places; they all listen instead of polling. */

var handlers = {};
BS.on = function (name, fn) { (handlers[name] = handlers[name] || []).push(fn); };
BS.emit = function (name, arg) {
  (handlers[name] || []).forEach(function (fn) { try { fn(arg); } catch (e) {} });
};

})();
