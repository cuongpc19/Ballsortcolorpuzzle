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
  tutor:  'bsp_tutor',    /* has the level-1 walkthrough been finished     */
  dda:    'bsp_dda',      /* {score, group, last, recent[]} - see dda.js   */
  pick:   'bsp_pick',     /* {c500: 501} - which puzzle a level was given  */
  bag:    'bsp_bag',      /* {undo,tube,hint} - boosters owned             */
  alert:  'bsp_alert',    /* stuck alerts on or off                        */
  lucky:  'bsp_lucky',    /* {c8: 1} - lucky coins already banked          */
  skip:   'bsp_skip'      /* {wins, need, ready} - skip bookkeeping        */
};

/* --------------------------------- economy ------------------------------ */

var ECON = BS.ECON = {
  /* A new player starts broke: the first coins have to be won. */
  START_COINS: 0,
  /* Every win pays the same flat 10, stars or not. Read it against the prices
     below: one win buys an undo, five buy an extra tube, so a booster is a
     real decision rather than a free tap. */
  WIN_COINS: 10,
  STAR_BONUS: 0,
  /* Coming back day after day pays far more than playing does, which is the
     point: it is the reason to open the game tomorrow.

     ⚠ Switched off for now (2026-09-10). The card, the streak and the claim
     all still work — flip this back to true and the button, the badge and the
     arrival prompt come back with it. Nothing is deleted, so a player who
     already had a streak keeps it. */
  DAILY_ENABLED: false,
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
  /** coins for one use, once the free allowance and the bag are both empty */
  PRICE: { undo: 10, tube: 50, hint: 15 },
  /* ⚠ Restart is FREE for now: nothing reads this. Wire it back up in
     board.js askRestart() to start charging again. */
  REPLAY_COST: 50,

  /* ---------------------------------------------------------------------
   * Lucky coin. The original's numbers exactly, from the one config whose
   * default ships switched on:
   *   {"enable":true,"start":5,"probability":0.1,"coins":[10,20],
   *    "limit":3000,"limit_prob":0.05}
   * ------------------------------------------------------------------- */
  LUCKY_FROM: 4,                 /* 0-based, so level 5                    */
  LUCKY_PROB: 0.10,
  LUCKY_COINS: [10, 20],
  LUCKY_LIMIT: 3000,             /* a fat wallet needs the coin less...    */
  LUCKY_LIMIT_PROB: 0.05,        /* ...so the odds halve                   */

  /* Skip is earned, never sold - the original hands one out every few wins
     (`SkiplevelConfig`: startlevel 3, wintimes [4,6]) rather than putting it
     in the shop, which keeps it a mercy instead of a shortcut you can buy. */
  SKIP_FROM: 15,                 /* 0-based, so it opens at level 16       */
  SKIP_WINS: [4, 6],
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

/* ⚠ ONE-SHOT (2026-09-10): the test build handed out 10.000 coins, so a
   browser that ran it is still carrying them. Pull every wallet back to
   START_COINS once. Safe to delete once no test device is left - level
   progress is untouched either way. */
(function resetTestWallet() {
  if (read('bsp_wallet_v2', 0)) return;
  write('bsp_wallet_v2', 1);
  write(K.coins, ECON.START_COINS);
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

  /* ------- stuck alerts ------- */

  /* `NoMoveAlertPrefsKey` in the original, and a switch in its settings too:
     some people would rather be left to work it out. */
  alertsOn: function () { return read(K.alert, true) !== false; },
  setAlerts: function (v) { write(K.alert, !!v); },

  /* ------- lucky coins ------- */

  luckyTaken: function (mode, index) {
    return read(K.lucky, {})[slot(mode, index)] === 1;
  },
  /** bank the coin for this level; pays once ever, so replaying earns nothing */
  takeLucky: function (mode, index, coins) {
    var m = read(K.lucky, {}), s = slot(mode, index);
    if (m[s] === 1) return 0;
    m[s] = 1;
    write(K.lucky, m);
    save.addCoins(coins);
    return coins;
  },

  /* ------- the skip credit ------- */

  skipState: function () {
    var s = read(K.skip, null);
    if (!s) { s = { wins: 0, need: ECON.SKIP_WINS[0], ready: false }; write(K.skip, s); }
    return s;
  },
  skipReady: function () { return save.skipState().ready === true; },
  /** a win moves the counter along; true when it has just earned a skip */
  skipWin: function () {
    var s = save.skipState();
    if (s.ready) return false;              /* one in hand is the ceiling */
    s.wins++;
    if (s.wins < s.need) { write(K.skip, s); return false; }
    s.ready = true;
    s.wins = 0;
    s.need = ECON.SKIP_WINS[0] + Math.floor(Math.random() *
             (ECON.SKIP_WINS[1] - ECON.SKIP_WINS[0] + 1));
    write(K.skip, s);
    return true;
  },
  useSkip: function () {
    var s = save.skipState();
    if (!s.ready) return false;
    s.ready = false;
    write(K.skip, s);
    return true;
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

  /**
   * How far the walkthrough has got: levels below this number have been
   * taught. A count rather than a flag because the lesson now covers more
   * than one level, and a player who jumps straight to level 2 should still
   * be shown it.
   *
   * ⚠ The key is older than the count - the first builds wrote `true` here,
   * meaning level 1 had been taught. Read that as 1.
   */
  taughtUpTo: function () {
    var v = read(K.tutor, 0);
    return v === true ? 1 : (v | 0);
  },
  setTaught: function (index) {
    if (index + 1 > save.taughtUpTo()) write(K.tutor, index + 1);
  },

  /* ------- dynamic difficulty ------- */

  dda: function () { return read(K.dda, null); },
  setDda: function (v) { write(K.dda, v); },

  /**
   * Which puzzle a displayed level was served. Frozen the first time the
   * level is opened, so a level keeps its puzzle for ever — otherwise a
   * record or a star count would belong to whichever puzzle happened to be
   * dealt that day.
   */
  pickOf: function (mode, index) {
    var v = read(K.pick, {})[slot(mode, index)];
    return v === undefined ? null : v;
  },
  setPick: function (mode, index, src) {
    var m = read(K.pick, {});
    m[slot(mode, index)] = src;
    write(K.pick, m);
  },

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

  /** every level whose puzzle has been frozen, for tests and debugging */
  allPicks: function () { return read(K.pick, {}); },

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
