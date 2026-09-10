/* The level-1 walkthrough.
 *
 * Three beats: say what the goal is, point at the tube to pick up from, then
 * point at the tube to drop into. While it runs the board only accepts a tap
 * on the tube being pointed at — a stray tap elsewhere would leave the lesson
 * describing a position the player is no longer in.
 *
 * Which tubes get pointed at is asked of the solver, not hard-coded, so the
 * lesson still makes sense if level 1's data ever changes.
 */
(function () {
'use strict';

var BS = window.BS;
var save = BS.save;
var board = BS.board;

var root = document.getElementById('tutor');
var spot = document.getElementById('tutorSpot');
var hand = document.getElementById('tutorHand');
var msg  = document.getElementById('tutorMsg');
var skip = document.getElementById('tutorSkip');

var live = false;
var step = 0;
var move = null;      /* {from, to} the solver picked */

/** does this level get the walkthrough? */
function wanted(mode, index) {
  return mode === 'classic' && index === 0 && !save.tutorDone();
}

/* ------------------------------ the beats --------------------------- */

var BEATS = [
  { text: 'Mục tiêu: dồn các bi <b>cùng màu</b> về chung một ống.',
    tube: null, hold: 2100 },
  { text: 'Chạm vào ống này để <b>nhấc bi</b> trên cùng lên.',
    tube: function () { return move.from; } },
  { text: 'Giờ chạm ống kia để <b>thả bi</b> vào.<br>Chỉ thả được lên bi cùng màu, hoặc ống trống.',
    tube: function () { return move.to; } }
];

function start() {
  move = board.nextMove();
  if (!move) return;                       /* nothing to teach with */
  live = true;
  step = 0;
  root.classList.add('on');
  board.setGate(gate);
  render();
}

function stop(done) {
  if (!live) return;
  live = false;
  root.classList.remove('on');
  board.setGate(null);
  if (done) save.setTutorDone();
}

/** only the tube the hand is over may be tapped */
function gate(i) {
  var beat = BEATS[step];
  if (!beat || !beat.tube) return true;
  return i === beat.tube();
}

function render() {
  var beat = BEATS[step];
  msg.innerHTML = beat.text;

  if (!beat.tube) {
    spot.classList.remove('on');
    hand.classList.remove('on');
    /* the opening line reads on its own, then the pointing starts */
    setTimeout(function () { if (live && step === 0) { step = 1; render(); } }, beat.hold);
    return;
  }

  var r = board.tubeRect(beat.tube());
  if (!r) return;
  var box = root.getBoundingClientRect();
  var pad = 6;
  spot.style.left   = (r.left - box.left - pad) + 'px';
  spot.style.top    = (r.top - box.top - pad) + 'px';
  spot.style.width  = (r.width + pad * 2) + 'px';
  spot.style.height = (r.height + pad * 2) + 'px';
  spot.style.borderRadius = window.getComputedStyle(
    document.getElementById('tubes').children[beat.tube()]).borderRadius;
  spot.classList.add('on');

  hand.style.left = (r.left - box.left + r.width / 2) + 'px';
  hand.style.top  = (r.bottom - box.top + 10) + 'px';
  hand.classList.remove('on');
  void hand.offsetWidth;
  hand.classList.add('on');
}

/* ------------------------------- wiring ----------------------------- */

BS.on('picked', function (i) {
  if (!live || step !== 1) return;
  if (i !== move.from) return;
  step = 2;
  render();
});

BS.on('moved', function () {
  if (!live) return;
  /* the lesson is over the moment the first real move lands */
  stop(true);
});

/* A new level (or a restart) either starts the lesson or cancels it. */
BS.on('levelReady', function (info) {
  stop(false);
  if (wanted(info.mode, info.index)) setTimeout(start, 620);
});

skip.onclick = function () {
  board.sfx('ui');
  stop(true);
};

/* the spotlight is measured in screen pixels, so it has to follow a resize */
var t = null;
window.addEventListener('resize', function () {
  if (!live) return;
  clearTimeout(t);
  t = setTimeout(render, 120);
});

BS.tutorial = { active: function () { return live; }, stop: stop };

})();
