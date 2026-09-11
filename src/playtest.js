/* Playtest links. Dormant unless the URL asks for it:
 *
 *   ?playtest=hard      the 2,596 special levels, every one of them open
 *   ?playtest=classic   the 15,100 classic levels, every one of them open
 *   &level=231          open straight into that level
 *
 * For judging level design, not for playing. Ships in the web build only -
 * scripts/build-crazy.mjs drops the file and its tag, because a link that
 * unlocks every level is a cheat code in front of a reviewer.
 *
 * ⚠ Loaded before save.js, because it installs `BS.store` and save.js captures
 * that store at parse time. A tag after save.js would install a store nothing
 * reads - and then every playtest write would land in the real save.
 *
 * ⚠ The store is in memory on purpose. Unlocking all 17,696 levels is a change
 * nobody wants written over their actual progress, and a playtest that quietly
 * banked coins or burned the lucky-coin flags would corrupt the very numbers
 * the design is being judged on. Close the tab and none of it happened.
 */
(function () {
'use strict';

var BS = window.BS = window.BS || {};

var q = {};
try {
  var sp = new URLSearchParams(location.search);
  sp.forEach(function (v, k) { q[k] = v; });
} catch (e) { return; }

if (!('playtest' in q)) return;

var mode = (q.playtest === 'hard') ? 'hard' : 'classic';
var level = parseInt(q.level, 10);
if (!(level > 0)) level = 0;

/* Everything open. `save.locked()` is `index > max`, so one big number does it
   for both modes without either level table being loaded yet. */
var OPEN = 1e6;

var mem = {};
BS.store = {
  getItem: function (k) { return (k in mem) ? mem[k] : null; },
  setItem: function (k, v) { mem[k] = String(v); },
  removeItem: function (k) { delete mem[k]; }
};

/* Seeded straight into the store rather than through `save`, which does not
   exist yet. The keys are save.js's own - see the `K` map at the top of it. */
mem.bsp_max   = JSON.stringify({ classic: OPEN, hard: OPEN });
mem.bsp_level = JSON.stringify({ classic: 0, hard: 0 });
mem.bsp_seen  = '1';          /* no first-visit fuss */
mem.bsp_tutor = '1';          /* no level-1 walkthrough in the way */
mem.bsp_coins = '9999';       /* boosters affordable, so traps are testable */
mem.bsp_alert = '1';

/* ⚠ Not decoration. save.js runs a one-shot wallet reset at parse time that
   pulls any wallet it has not stamped back to START_COINS - which is 0 - so
   without this stamp the coins above are gone before the first paint. */
mem.bsp_wallet_v2 = '1';

BS.playtest = { mode: mode, level: level ? level - 1 : -1 };

/* A visible mark, because a build where every level is open looks exactly like
   a save with every level cleared, and the two must never be confused. */
document.addEventListener('DOMContentLoaded', function () {
  var b = document.createElement('div');
  b.id = 'playtestFlag';
  b.textContent = (mode === 'hard' ? 'HARD POOL' : 'CLASSIC') + ' · playtest · tiến độ không lưu';
  document.body.appendChild(b);
});

})();
