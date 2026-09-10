/* The opening walkthrough.
 *
 * Two wordless beats: a hand points at the tube to pick a ball up from, then
 * at the tube to drop it into. It only ever suggests — every tube stays
 * tappable, so a player who has their own idea is free to follow it. Pick up
 * a ball the lesson did not ask for and the hand steps aside rather than
 * point at a position that is no longer the one the player is in; put that
 * ball back and it points again.
 *
 * It runs on the first `GUIDE_LEVELS` levels, once each, and stays with the
 * player for the whole of them: after a move lands the hand lets go, and if
 * the player then sits still for `IDLE` it points at the solver's next move,
 * again and again until the level is out of moves to make. Someone who knows
 * what they are doing never sees it a second time; someone stuck is never
 * left alone. The original gates the same thing on a level number from its
 * server (`guide_level`) — the number is not in the APK, so this one is ours.
 *
 * Which tubes get pointed at is asked of the solver, not hard-coded, so the
 * lesson still makes sense if the level data ever changes.
 */
(function () {
'use strict';

var BS = window.BS;
var save = BS.save;
var board = BS.board;

var root = document.getElementById('tutor');
var hand = document.getElementById('tutorHand');

/** how many levels from the start get the pointing hand */
var GUIDE_LEVELS = BS.GUIDE_LEVELS = 2;
/** how long a guided player may sit still before the hand offers the next move */
var IDLE = BS.GUIDE_IDLE = 1500;

var live = false;
var step = 0;
var move = null;      /* {from, to} the solver picked */
var taughtIndex = 0;  /* the level the running lesson belongs to */
var idleT = null;     /* the "still nothing? here you go" timer */

/** does this level get the walkthrough? */
function wanted(mode, index) {
  return mode === 'classic' && index < GUIDE_LEVELS && index >= save.taughtUpTo();
}

/* the tubes the hand visits, in order */
var BEATS = [
  function () { return move.from; },
  function () { return move.to; }
];

function start() {
  move = board.nextMove();
  if (!move) return;                       /* nothing to teach with */
  live = true;
  step = 0;
  root.classList.add('on');
  render();
}

function stop(done) {
  if (!live) return;
  live = false;
  clearTimeout(idleT);
  hand.classList.remove('on');
  root.classList.remove('on');
  if (done) save.setTaught(taughtIndex);
}

function render() {
  var beat = BEATS[step];
  if (!beat) return;

  var ti = beat();
  var tube = board.tubeRect(ti);
  if (!tube) return;
  var box = root.getBoundingClientRect();

  /* The hand points at what the player is being asked to tap: the ball on top
     of the tube, or - when the tube is empty - the slot the ball will land in.
     Its fingertip is at the top of the glyph, so it is parked just inside that
     target; under the tube, where it used to sit, it read as pointing at
     nothing. */
  var ball = board.slotRect(ti);
  var cx = tube.left + tube.width / 2;
  var cy = ball ? ball.top + ball.height * 0.55 : tube.bottom - tube.width * 0.55;

  hand.style.left = (cx - box.left) + 'px';
  hand.style.top  = (cy - box.top) + 'px';
  hand.classList.remove('on');
  void hand.offsetWidth;
  hand.classList.add('on');
}

/** point at the next move once the player has been still for a moment */
function arm() {
  clearTimeout(idleT);
  idleT = setTimeout(function () {
    if (!live) return;
    move = board.nextMove();
    if (!move) { stop(true); return; }
    step = 0;
    render();
  }, IDLE);
}

/* ------------------------------- wiring ----------------------------- */

BS.on('picked', function (i) {
  if (!live) return;
  clearTimeout(idleT);                            /* the player is busy */
  if (i === move.from && step === 0) { step = 1; render(); return; }
  if (i === -1) { step = 0; render(); return; }   /* back to an empty hand */
  if (i === move.from) return;                    /* still the tube we asked for */
  /* a ball the lesson did not ask for is in the air: stop pointing until it
     is put back, or until the move lands and ends the lesson */
  hand.classList.remove('on');
});

BS.on('moved', function () {
  if (!live) return;
  /* one move in, the player has the idea: the level counts as taught even if
     the hand carries on offering the next move for the rest of it */
  save.setTaught(taughtIndex);
  hand.classList.remove('on');
  step = 0;
  move = board.nextMove();
  if (!move) { stop(true); return; }   /* solved - nothing left to point at */
  arm();
});

/* A new level (or a restart) either starts the lesson or cancels it. */
BS.on('levelReady', function (info) {
  stop(false);
  if (!wanted(info.mode, info.index)) return;
  taughtIndex = info.index;
  setTimeout(start, 620);
});

/* the hand is placed in screen pixels, so it has to follow a resize */
var t = null;
window.addEventListener('resize', function () {
  if (!live) return;
  clearTimeout(t);
  t = setTimeout(render, 120);
});

BS.tutorial = { active: function () { return live; }, stop: stop };

})();
