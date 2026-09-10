/* The shell around the board: home, level select, daily reward, settings,
 * and the router that moves between them.
 *
 * The board owns the puzzle and nothing else; everything here talks to it
 * through `BS.board` and to storage through `BS.save`.
 */
(function () {
'use strict';

var BS = window.BS;
var save = BS.save;
var ECON = BS.ECON;
var board = BS.board;

var $  = function (sel, root) { return (root || document).querySelector(sel); };
var $$ = function (sel, root) {
  return Array.prototype.slice.call((root || document).querySelectorAll(sel));
};

/** the mode the menus are browsing; the board keeps its own while playing */
var mode = 'classic';
var page = 0;                       /* level-select page, 60 levels a page */
var PER_PAGE = 60;

/* ============================== router ============================== */

var screens = { home: $('#screenHome'), levels: $('#screenLevels'), game: $('#screenGame') };
var current = '';

function show(name) {
  if (current === name) return;
  current = name;
  for (var k in screens) screens[k].classList.toggle('on', k === name);
  document.body.dataset.screen = name;
  if (name === 'home') paintHome();
  if (name === 'levels') paintLevels();
  /* The board measures itself off its own box, and that box is 0×0 while the
     screen is hidden. Toggling the class above already gave it a real size, so
     force the reflow and re-measure now — waiting for a frame leaves a board
     laid out against zero on the screen for that frame, and in a background
     tab (or a headless run) the frame may never come at all. */
  if (name === 'game') { void screens.game.offsetWidth; board.relayout(); }
}

BS.on('goHome', function () { show('home'); });

/* ============================== wallet ============================== */

function paintWallet(v) {
  var n = (v === undefined) ? save.coins() : v;
  $$('.coinNum').forEach(function (e) { e.textContent = n.toLocaleString('en-US'); });
}
BS.on('coins', paintWallet);

/** a little shower of coins from `from` to every wallet on screen */
BS.on('coinFly', function (from) {
  var host = $('#coinFly');
  var a = from.getBoundingClientRect();
  var target = $$('.wallet').filter(function (w) {
    return w.offsetParent && w.getBoundingClientRect().width;
  })[0];
  if (!target || !host || !document.body.animate) return;
  var b = target.getBoundingClientRect();
  for (var i = 0; i < 9; i++) {
    var c = document.createElement('i');
    c.className = 'coin';
    c.style.left = (a.left + a.width / 2) + 'px';
    c.style.top = (a.top + a.height / 2) + 'px';
    host.appendChild(c);
    (function (node, k) {
      node.animate([
        { transform: 'translate(-50%,-50%) scale(.4)', opacity: 0 },
        { transform: 'translate(' + ((Math.random() - 0.5) * 90 - 50) + '%,' +
                     (-60 - Math.random() * 70) + '%) scale(1.2)', opacity: 1, offset: 0.3 },
        { transform: 'translate(' + (b.left + b.width / 2 - a.left - a.width / 2) + 'px,' +
                     (b.top + b.height / 2 - a.top - a.height / 2) + 'px) scale(.5)', opacity: 0 }
      ], { duration: 900, delay: k * 55, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });
      setTimeout(function () { node.remove(); }, 1000 + k * 55);
    })(c, i);
  }
});

/* =============================== home =============================== */

/* Home is deliberately down to one number: which level you are on. The
   progress bar, the cleared count and the mode switch all moved out - level
   select still carries the mode switch for anyone who wants Hard. */
function paintHome() {
  $('#homeLevel').textContent = (save.level(mode) + 1).toLocaleString('en-US');
  $('#dailyDot').classList.toggle('on', ECON.DAILY_ENABLED && save.daily().ready);
  paintWallet();
}

/* show the screen first: the board can only size itself once its box is real */
function play(m, index) {
  show('game');
  board.start(m, index);
}

$('#btnPlay').onclick = function () {
  board.sfx('ui');
  play(mode, save.level(mode));
};
$('#btnDaily').onclick    = function () { board.sfx('ui'); openDaily(); };
if (!ECON.DAILY_ENABLED) $('#btnDaily').hidden = true;
$('#btnSettings').onclick = function () { board.sfx('ui'); openSettings(); };

/* =========================== level select =========================== */

function paintLevels() {
  var total = board.count(mode);
  var pages = Math.ceil(total / PER_PAGE);
  page = Math.min(Math.max(0, page), pages - 1);

  var from = page * PER_PAGE;
  var to = Math.min(total, from + PER_PAGE);
  $('#lvRange').textContent = (from + 1).toLocaleString('en-US') + ' – ' +
                              to.toLocaleString('en-US');
  $('#lvPrev').disabled = page === 0;
  $('#lvNext').disabled = page >= pages - 1;
  $$('#lvMode .mode').forEach(function (b) {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  $('#lvJump').max = total;

  var grid = $('#lvGrid');
  grid.innerHTML = '';
  var frag = document.createDocumentFragment();
  for (var i = from; i < to; i++) {
    frag.appendChild(levelTile(i));
  }
  grid.appendChild(frag);
  paintWallet();
}

function levelTile(i) {
  var locked = save.locked(mode, i);
  var stars = save.stars(mode, i);
  var isNext = i === save.max(mode);

  var b = document.createElement('button');
  b.className = 'lvTile' + (locked ? ' locked' : '') + (isNext ? ' next' : '') +
                (stars ? ' done' : '');
  b.innerHTML = '<b>' + (i + 1) + '</b>' + (locked ? '<i class="lock">🔒</i>' : '');
  b.onclick = function () {
    if (locked) {
      board.sfx('deny');
      board.toast('Clear level ' + (save.max(mode) + 1) + ' to unlock this');
      return;
    }
    board.sfx('ui');
    play(mode, i);
  };
  return b;
}

$('#lvPrev').onclick = function () { page--; board.sfx('ui'); paintLevels(); };
$('#lvNext').onclick = function () { page++; board.sfx('ui'); paintLevels(); };
$$('#lvMode .mode').forEach(function (b) {
  b.onclick = function () {
    mode = b.dataset.mode;
    page = Math.floor(save.level(mode) / PER_PAGE);
    board.sfx('ui');
    paintLevels();
  };
});

function jump() {
  var n = parseInt($('#lvJump').value, 10);
  if (!n) return;
  var i = Math.min(Math.max(1, n), board.count(mode)) - 1;
  if (save.locked(mode, i)) {
    board.sfx('deny');
    board.toast('Level ' + (i + 1) + ' is still locked');
    page = Math.floor(save.max(mode) / PER_PAGE);
    paintLevels();
    return;
  }
  board.sfx('ui');
  play(mode, i);
}
$('#btnJump').onclick = jump;
$('#lvJump').addEventListener('keydown', function (e) {
  if (e.key === 'Enter') jump();
});

/* ============================== overlays ============================ */

function openOverlay(id) {
  $(id).classList.add('show');
}
function closeOverlay(node) {
  node.classList.remove('show');
}
$$('[data-close]').forEach(function (b) {
  b.onclick = function () {
    board.sfx('ui');
    closeOverlay(b.closest('.overlay'));
  };
});
$$('.overlay').forEach(function (o) {
  if (o.id === 'winOverlay') return;           /* the win panel is modal */
  o.addEventListener('click', function (e) { if (e.target === o) closeOverlay(o); });
});

/* ---------------------------- daily reward --------------------------- */

function openDaily() {
  if (!ECON.DAILY_ENABLED) return;
  var st = save.daily();
  var row = $('#dayRow');
  row.innerHTML = '';
  ECON.DAILY_COINS.forEach(function (coins, k) {
    var day = k + 1;
    var d = document.createElement('div');
    var taken = day < st.day || (day === st.day && !st.ready);
    d.className = 'day' + (taken ? ' taken' : '') +
                  (day === st.day && st.ready ? ' now' : '');
    d.innerHTML = '<span>Day ' + day + '</span><b><i class="coin"></i> ' + coins + '</b>' +
                  (taken ? '<i class="tick">✓</i>' : '');
    row.appendChild(d);
  });
  var btn = $('#btnClaim');
  btn.disabled = !st.ready;
  btn.innerHTML = st.ready
    ? 'Claim <i class="coin"></i> ' + (ECON.DAILY_COINS[st.day - 1] || 0)
    : 'Come back tomorrow';
  openOverlay('#dailyOverlay');
}

$('#btnClaim').onclick = function () {
  var got = save.claimDaily();
  if (!got) return;
  board.sfx('coin');
  board.banner('+' + got + ' <i class="coin"></i>', 42, 1400);
  board.fireworks(3, 220);
  BS.emit('coinFly', $('#btnClaim'));
  openDaily();
  paintHome();
};

/* ------------------------------ settings ----------------------------- */

function openSettings() {
  $('#optSfx').checked = board.audio.sfxOn;
  $('#optMusic').checked = board.audio.musicOn;
  $('#optAlert').checked = save.alertsOn();
  openOverlay('#settingsOverlay');
}

$('#btnPrivacy').onclick = function () {
  board.sfx('ui');
  /* ⚠ Not a link, and not a new tab. The host bans outbound links and blocks
     popups from inside its frame, so the copy that ships with the game is
     shown in place. Same origin, so it just works. */
  var f = $('#privacyFrame');
  if (!f.getAttribute('src')) f.setAttribute('src', 'public/privacy.html');
  openOverlay('#privacyOverlay');
};

$('#optAlert').onchange = function () {
  save.setAlerts($('#optAlert').checked);
  board.sfx('ui');
  board.toast($('#optAlert').checked
    ? 'You will be told when the board is stuck'
    : 'No more stuck alerts');
};

$('#btnReset').onclick = function () {
  if (!window.confirm('Erase all progress, coins and items? This cannot be undone.')) return;
  save.reset();
  location.reload();
};

/* ============================ back buttons ========================== */

/* the game screen has no back arrow any more: the gear opens settings, and
   settings is where you leave the level from */
$('#btnGameSet').onclick = function () { board.sfx('ui'); openSettings(); };
$('#btnQuit').onclick = function () {
  board.sfx('ui');
  closeOverlay($('#settingsOverlay'));
  show('home');
};

$$('[data-back]').forEach(function (b) {
  b.onclick = function () {
    board.sfx('ui');
    show(b.closest('.screen').id === 'screenGame' ? 'home' : 'home');
  };
});

document.addEventListener('keydown', function (e) {
  if (e.target.tagName === 'INPUT') return;
  if (e.key !== 'Escape') return;
  var open = $$('.overlay.show').filter(function (o) { return o.id !== 'winOverlay'; })[0];
  if (open) { closeOverlay(open); return; }
  if (current !== 'home') show('home');
});

/* ============================== start-up ============================ */

/* ⚠ Everything below reads the save, so it waits for the save to be real -
   see BS.whenReady in save.js. With no host in the picture this runs
   straight away and nothing about the boot changes. */
BS.whenReady(function () {

mode = 'classic';
page = Math.floor(save.level(mode) / PER_PAGE);
paintWallet();

/* Straight into the level for a returning player; the home screen for a
   first visit, so the first thing they see is the game's own face. */
if (save.seen()) {
  show('home');
} else {
  save.setSeen();
  show('home');
}

/* The daily card is the reason to come back, so offer it once on arrival -
   but only offer it, never force it, and never on top of something else.
   A first-timer who taps PLAY inside that second is mid-walkthrough, and a
   reward card over the lesson buries the one thing they need to read. */
if (ECON.DAILY_ENABLED && save.daily().ready) setTimeout(function () {
  if (current !== 'home') return;
  if (BS.tutorial && BS.tutorial.active()) return;
  if ($$('.overlay.show').length) return;
  openDaily();
}, 700);

});

})();
