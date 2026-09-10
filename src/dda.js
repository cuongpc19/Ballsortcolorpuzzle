/* Dynamic difficulty.
 *
 * Rebuilt from the shape the original APK's `DynamicLevelMgr` shows: a
 * performance score kept per player, nudged by what the player does —
 *
 *     OnDynamicUndo / OnDynamicAddTube / OnDynamicReplay / OnDynamicGameWin
 *     undo_score    / addtube_score    / replay_score
 *
 * — clamped inside a range (`min_performance_score` / `max_performance_score`),
 * with the score deciding which of two level pools the next puzzle is drawn
 * from (`dda_range1` / `dda_range2`, `dda_levelpool`), and none of it running
 * before `dda_start_level`.
 *
 * Their pools are downloaded; ours are already here. From level 101 the
 * classic set is exactly 7500 levels of 9 colours (par ~27.8) and 7500 of 12
 * colours (par ~37.9), alternating almost every other level — so the two
 * pools the system needs were shipped inside the level data all along, and
 * the nearest level of either pool is on average half a level away.
 *
 * The player is told none of this. There is no toggle, no badge, no message:
 * the level number counts up as it always did, and only *which* puzzle sits
 * behind it moves. That is the point — a hint solves the puzzle for you, this
 * just hands you one worth solving.
 */
(function () {
'use strict';

var BS = window.BS;
var save = BS.save;
var board = BS.board;

/* ---------------------------------------------------------------------
 * The live game reads all of this from a remote config, so the numbers
 * below are ours; the shape is theirs. Tuned against the coin economy: a
 * restart hurts about as much as eight undos, because a restart is the
 * clearest signal a player is beaten by a level.
 * ------------------------------------------------------------------- */
var CFG = BS.DDA_CFG = {
  /** 0-based; level 101 on the box. The hand-built ramp below it is left alone. */
  START_LEVEL: 100,

  /* Kept away from 0 and 100 on purpose. A score pinned at an extreme takes
     as long to come back as it took to get there, and the player whose form
     just changed is exactly the one the system should react to fastest. From
     either bound a threshold is at most 45 points away — three or four bad
     levels. */
  SCORE_MIN: 10,
  SCORE_MAX: 90,
  SCORE_START: 50,

  /* The score moves once per level, at the win, out of everything that level
     cost. Scoring each action as it happened made winning itself worth
     points — and everyone wins eventually, so every player drifted to the
     top however badly they had played. What separates players is not whether
     they finished but what finishing took. */
  UNDO: -1,
  TUBE: -6,
  HINT: -3,
  REPLAY: -8,
  /* how the move count compares to the original developer's own solution */
  CLEAN: +8,      /* at or under par                */
  TIDY: +4,       /* within 15% over               */
  LOOSE: 0,       /* within 50% over               */
  MESSY: -4,      /* worse than that               */
  /** no single level may swing the score more than this */
  MAX_STEP: 14,
  /* A pull back towards the middle applied every level. Without it the score
     is a pure integrator: any steady habit, however mild, walks it into a
     bound and pins it there, and a player who then improves needs forty good
     levels before anything changes. With it the score settles in proportion
     to how the player is actually doing, and answers a change of form in
     three or four levels from anywhere. */
  DECAY: 0.10,

  /* Hysteresis. One band would flip the player between pools on a single
     undo; two thresholds mean a change of pool takes real evidence. */
  TO_HARD: 55,
  TO_EASY: 45,

  /** how often the pool is re-chosen, in levels (`DynamicLastRefreshLevel`) */
  REFRESH_EVERY: 3,

  EASY_COLORS: 9,
  HARD_COLORS: 12,

  /** give up scanning for a level of the wanted colour after this many */
  SCAN_LIMIT: 400,

  /** no "hard" badge before this 0-based level - see tier() */
  TAG_FROM: 4
};

/* ------------------------------- state ------------------------------ */

var st = null;

/** what the level being played has cost so far; not persisted */
var tally = { undo: 0, tube: 0, hint: 0, replay: 0 };
function resetTally() { tally = { undo: 0, tube: 0, hint: 0, replay: 0 }; }

function load() {
  if (st) return st;
  st = save.dda() || {
    score: CFG.SCORE_START,
    group: 'easy',
    last: -999,          /* level index the pool was last chosen at */
    /* One cursor per pool. A pool is walked forward, never re-read, so no
       puzzle is ever dealt twice — and because the cursor is also dragged
       forward by the level number it can never fall behind the player.
       This is what stops a long run inside one pool from running out of
       search window and quietly handing back a level of the wrong pool. */
    cursor: { easy: 0, hard: 0 }
  };
  if (!st.cursor) st.cursor = { easy: 0, hard: 0 };
  return st;
}
function flush() { save.setDda(st); }

function clamp(v) { return Math.max(CFG.SCORE_MIN, Math.min(CFG.SCORE_MAX, v)); }

function bump(delta) {
  load();
  var v = st.score + delta;
  v += (CFG.SCORE_START - v) * CFG.DECAY;
  st.score = clamp(Math.round(v));
  flush();
}

/** re-read the pool from the score, but only every REFRESH_EVERY levels */
function refreshGroup(index) {
  load();
  if (index - st.last < CFG.REFRESH_EVERY) return;
  st.last = index;
  if (st.score >= CFG.TO_HARD) st.group = 'hard';
  else if (st.score <= CFG.TO_EASY) st.group = 'easy';
  /* between the two thresholds the pool stays where it is */
  flush();
}

/* ------------------------------ picking ----------------------------- */

/**
 * Which puzzle to deal for a displayed level. Frozen on first sight so the
 * level keeps that puzzle for ever — a record against a level that changed
 * underneath the player would be meaningless.
 */
function pick(mode, index) {
  var frozen = save.pickOf(mode, index);
  if (frozen !== null) return frozen;

  /* the ladder below START_LEVEL is hand-made; leave it exactly as it is */
  if (mode !== 'classic' || index < CFG.START_LEVEL) return index;

  load();
  refreshGroup(index);

  var group = st.group;
  var want = group === 'hard' ? CFG.HARD_COLORS : CFG.EASY_COLORS;
  var total = board.count(mode);

  /* start at whichever is further along: the level itself, or wherever this
     pool has been read up to */
  var j = Math.max(index, st.cursor[group] + 1);
  var src = index;
  for (var n = 0; n < CFG.SCAN_LIMIT; n++, j++) {
    /* a pool read to its end starts again - after this many levels a puzzle
       coming round once more is not something anyone will notice */
    if (j >= total) j = CFG.START_LEVEL;
    if (board.colorsOf(mode, j) === want) { src = j; break; }
  }

  st.cursor[group] = src;
  flush();
  save.setPick(mode, index, src);
  return src;
}

/* ------------------------------- wiring ----------------------------- */

BS.on('boosterUsed', function (id) { tally[id] = (tally[id] | 0) + 1; });
BS.on('replay', function () { tally.replay++; });

/* a fresh level starts a fresh tally; a restart keeps it, because the cost of
   the restart belongs to this level */
BS.on('levelReady', function (info) {
  if (lastLevel !== info.mode + ':' + info.index) resetTally();
  lastLevel = info.mode + ':' + info.index;
});
var lastLevel = '';

BS.on('won', function (info) {
  bump(scoreFor(info, tally));
  resetTally();
});

/* The hardest board this player has actually finished, which is what the
   "hard" badge is measured against. Deliberately a second listener: BS.emit
   swallows whatever a handler throws, so anything sharing with the scoring
   above could quietly eat the score reset instead of just failing itself. */
BS.on('won', function (info) {
  if (!info || !info.mode) return;
  var c = board.colorsOf(info.mode, board.src()) | 0;
  load();
  if (c > (st.peak | 0)) { st.peak = c; flush(); }
});

/* Skipping is the loudest thing a player can say about a level: it beat them.
   Worth the same as giving up and starting over. */
BS.on('skipped', function () { bump(CFG.REPLAY); resetTally(); });

/* --------------------- how hard is this one, for you -------------------
 * The original marks levels hard on a cadence - `hard_step: 5`, so every
 * fifth level, the same five for everybody. That is a label, not a measure.
 *
 * Ours measures. A level is hard when it asks for more than this player has
 * ever managed: more colours than the most they have ever cleared. That puts
 * the badge on the step up - the first nine-colour board, the first twelve -
 * and on nobody else's schedule. Playing face down counts for a step of its
 * own, and the two together are as hard as it gets.
 */

/** 0 normal, 1 hard, 2 super hard */
function tier(index, colours, question) {
  /* The opening levels climb 1 -> 2 -> 3 colours in four levels. Every one of
     them is a step up, and calling them all hard while the walkthrough is
     still running would wear the word out before it is worth anything. */
  if (index < CFG.TAG_FROM) return 0;
  load();
  var peak = st.peak | 0;
  var t = (peak > 0 && colours > peak) ? 1 : 0;
  if (question) t++;
  return Math.min(2, t);
}

/** what one finished level is worth */
function scoreFor(info, t) {
  var d;
  if (!info.par) d = CFG.LOOSE;
  else if (info.moves <= info.par) d = CFG.CLEAN;
  else if (info.moves <= info.par * 1.15) d = CFG.TIDY;
  else if (info.moves <= info.par * 1.5) d = CFG.LOOSE;
  else d = CFG.MESSY;

  d += CFG.UNDO * (t.undo | 0) + CFG.TUBE * (t.tube | 0) +
       CFG.HINT * (t.hint | 0) + CFG.REPLAY * (t.replay | 0);

  return Math.max(-CFG.MAX_STEP, Math.min(CFG.MAX_STEP, d));
}

/* --------------------------------- api ------------------------------ */

BS.dda = {
  pick: pick,
  /** for tests and for looking at what the system is doing */
  state: function () {
    load();
    return { score: st.score, group: st.group, last: st.last,
             cursor: { easy: st.cursor.easy, hard: st.cursor.hard } };
  },
  tier: tier,
  /** the most colours this player has ever cleared */
  peak: function () { load(); return st.peak | 0; },
  setPeak: function (v) { load(); st.peak = v | 0; flush(); },
  /** used by the tests to put the player in a known place */
  setScore: function (v) { load(); st.score = clamp(v); st.last = -999; flush(); },
  /** what a level would be worth - exposed so the tests can pin it down */
  scoreFor: scoreFor,
  tally: function () { return { undo: tally.undo, tube: tally.tube,
                                hint: tally.hint, replay: tally.replay }; },
  cfg: CFG
};

})();
