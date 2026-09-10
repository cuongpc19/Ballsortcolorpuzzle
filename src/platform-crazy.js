/* CrazyGames. Ships only in the `crazy` build - scripts/build-crazy.mjs puts
 * this tag in ahead of every other script, and the plain web build has no line
 * of it anywhere.
 *
 * ⚠ Everything here has to survive the SDK never arriving. An adblocker that
 * swallows their script does not fire `onerror` on the tag, so waiting on it
 * without a timeout parks that whole class of player on a dead page forever.
 * `BS.ready` resolves either way, and every call below no-ops when `sdk` is
 * null. A session without cloud save is a degraded session; a session that
 * never boots is a lost player.
 *
 * ⚠ Loaded first, before save.js, because it installs `BS.store` - and save.js
 * captures that store at parse time.
 */
(function () {
'use strict';

var BS = window.BS = window.BS || {};

/* Their script, fetched at runtime from their host.
 *
 * ⚠ Created here rather than written as a <script src> in index.html. A
 * classic script tag in <head> blocks the HTML parser, so a slow answer from
 * this host would hold up the whole page and the game would simply never
 * start - no error, nothing in the console, just no board. An element created
 * from code cannot do that: the document has long finished parsing by then.
 *
 * ⚠ The platform hosts the file and forbids bundling it, so this has to stay
 * a network fetch of their URL. */
var SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

/** budget for fetching the script alone, inside the overall init budget */
var LOAD_TIMEOUT_MS = 2000;

/** ⚠ the whole boot waits on this, so it has to be short enough to sit under
 *  any patience a player has for a blank screen */
var INIT_TIMEOUT_MS = 2500;

var sdk = null;

/* ---------------------------------------------------------------- storage */

var local = {
  getItem: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  setItem: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  removeItem: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
};

/* Read the host first, write to both.
 *
 * ⚠ Writing to both is not belt and braces. A session where the SDK never
 * arrived must still leave a *fresh* local copy; writing only to the host
 * leaves the local one frozen at whenever the SDK last worked, and that stale
 * copy is what the next offline session shows the player. */
BS.store = {
  getItem: function (k) {
    if (sdk) {
      try {
        var v = sdk.data.getItem(k);
        if (v !== null && v !== undefined) return v;
      } catch (e) { /* fall through to the local copy */ }
    }
    return local.getItem(k);
  },
  setItem: function (k, v) {
    local.setItem(k, v);
    try { if (sdk) sdk.data.setItem(k, v); } catch (e) {}
  },
  removeItem: function (k) {
    local.removeItem(k);
    try { if (sdk) sdk.data.removeItem(k); } catch (e) {}
  }
};

/* ------------------------------------------------------------------- boot */

function loadScript() {
  return new Promise(function (resolve) {
    var settled = false;
    function done(ok) { if (!settled) { settled = true; resolve(ok); } }
    try {
      /* already there: a host page that preloads it, or a second call */
      if (window.CrazyGames) return done(true);
      var el = document.createElement('script');
      el.src = SDK_URL;
      el.async = true;
      el.onload = function () { done(true); };
      el.onerror = function () { done(false); };
      document.head.appendChild(el);
      /* ⚠ on top of onerror, not instead of it: an adblocked request can hang
         without ever firing either handler */
      setTimeout(function () { done(false); }, LOAD_TIMEOUT_MS);
    } catch (e) { done(false); }
  });
}

function findSdk(startedAt, loaded) {
  /* The script never arrived, so there is nothing to wait for. Polling the
     rest of the budget out would only add dead time to the boot of every
     player behind an adblocker - and they are the ones already waiting
     longest. One look, in case a host page had it all along, then give up. */
  if (!loaded) return Promise.resolve((window.CrazyGames && window.CrazyGames.SDK) || null);
  return new Promise(function (resolve) {
    var timer = setTimeout(function () { resolve(null); }, INIT_TIMEOUT_MS);
    /* ⚠ onload firing does not mean window.CrazyGames.SDK is assigned yet on
       every build of their script, so poll rather than trust the event */
    (function tick() {
      var s = window.CrazyGames && window.CrazyGames.SDK;
      if (s) { clearTimeout(timer); resolve(s); }
      else if (Date.now() - startedAt < INIT_TIMEOUT_MS) setTimeout(tick, 60);
    })();
  });
}

BS.ready = (function () {
  var startedAt = Date.now();
  return loadScript()
    .then(function (loaded) { return findSdk(startedAt, loaded); })
    .then(function (found) {
      if (!found) return;
      /* ⚠ init() is async and must finish before anything is read: this is
         where the host preloads the player's cloud save. Raced against the
         remaining budget so a hung handshake cannot hold the game hostage. */
      var left = Math.max(0, INIT_TIMEOUT_MS - (Date.now() - startedAt));
      return Promise.race([
        found.init(),
        new Promise(function (r) { setTimeout(r, left); })
      ]).then(function () { sdk = found; }, function () { sdk = null; });
    })
    .then(function () { wire(); }, function () { wire(); });
})();

/* ------------------------------------------------------- host <-> game */

function call(name) {
  try { if (sdk && sdk.game && sdk.game[name]) sdk.game[name](); } catch (e) {}
}

/* Whether the host is allowed to interrupt with an ad right now.
 *
 * ⚠ Derived from the state of the screen rather than emitted from each place
 * that opens a panel. The one call site you forget is the one that drops an ad
 * into the middle of a move, and this game opens overlays from four files. */
function playing() {
  var game = document.getElementById('screenGame');
  if (!game || !game.classList.contains('on')) return false;
  if (document.querySelector('.overlay.show')) return false;
  return true;
}

var wasPlaying = false;
function syncPlaying() {
  var now = playing();
  if (now === wasPlaying) return;
  wasPlaying = now;
  call(now ? 'gameplayStart' : 'gameplayStop');
}

function readHostMute() {
  try {
    var live = sdk && sdk.game && sdk.game.settings;
    if (live && typeof live.muteAudio === 'boolean') return live.muteAudio;
  } catch (e) {}
  /* ⚠ the flag their QA tests with. Without it the game only ever goes quiet
     when a live SDK says so, which is exactly what a reviewer opening the URL
     by hand does not have. */
  try { return new URLSearchParams(location.search).get('muteAudio') === 'true'; }
  catch (e) { return false; }
}

function pushMute() {
  if (BS.board && BS.board.audio && BS.board.audio.setHostMute) {
    BS.board.audio.setHostMute(readHostMute());
  }
}

function wire() {
  /* Bracket what is left of the boot. It cannot start any earlier than this:
     there is no SDK to tell until the handshake finishes, and by then the
     level data has already parsed. What remains - ui.js painting the first
     screen off the save the host just handed us - is real, and runs on this
     same promise right after this function returns. */
  call('loadingStart');
  setTimeout(function () { call('loadingStop'); }, 0);

  /* ⚠ addSettingsChangeListener, not a window event. There is no volume event
     to listen for - guessing one would have meant declaring "supports muting
     through the SDK" on the submission form while happily playing over a page
     the player had silenced. */
  try {
    if (sdk && sdk.game && sdk.game.addSettingsChangeListener) {
      sdk.game.addSettingsChangeListener(function () { pushMute(); });
    }
  } catch (e) {}
  pushMute();

  /* The screen and the overlays are all inside <body>, and both the screen
     switch and every overlay are class changes, so one subtree observer sees
     the lot. */
  try {
    new MutationObserver(syncPlaying).observe(document.body, {
      subtree: true, attributes: true, attributeFilter: ['class']
    });
  } catch (e) {}
  syncPlaying();

  /* A flourish on the host page when the player does well. Finishing a level
     only - a lucky coin is luck, not an achievement, and a flourish that
     fires for everything stops meaning anything. */
  if (BS.on) BS.on('won', function () { call('happytime'); });
}

BS.platform = {
  name: 'crazy',
  hasSdk: function () { return !!sdk; },
  hostMuted: readHostMute
};

})();
