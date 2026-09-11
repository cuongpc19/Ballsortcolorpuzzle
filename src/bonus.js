/* Special levels, offered between classic ones.
 *
 * Every fifth classic level ends with an offer: a harder board from the
 * special pool, for double coins, with a skip button of its own. Take it or
 * leave it - either way the next classic level is waiting afterwards.
 *
 * ⚠ A special level has no number in the classic run. It does not advance the
 * player, it cannot be reached from level select, and beating it unlocks
 * nothing. That is the whole shape of the thing: a detour, not a step. The
 * level counter reads the same before and after.
 *
 * Which board fills which slot is decided at build time by
 * scripts/gen-bonus.mjs and shipped in data/bonus.js - so every player gets
 * the same special level in the same slot, and nothing here is dynamic. See
 * that script for why the pool is not simply walked in order.
 */
(function () {
'use strict';

var BS = window.BS;
var save = BS.save;

/** offered after classic level 5, 10, 15 ... */
var EVERY = 5;

/* three base-36 digits per slot, 0-based into the special pool */
var ORDER = window.BONUS_ORDER || '';
var COUNT = (ORDER.length / 3) | 0;

/** which board slot `slot` is, 0-based into the special pool; -1 if none */
function puzzleFor(slot) {
  if (!(slot >= 1) || slot > COUNT) return -1;
  var n = parseInt(ORDER.substr((slot - 1) * 3, 3), 36);
  return isNaN(n) ? -1 : n;
}

/** the slot a classic level sits in front of, or 0 */
function slotAt(index) {
  var lv = (index | 0) + 1;
  if (lv < EVERY || lv % EVERY) return 0;
  var s = lv / EVERY;
  return s <= COUNT ? s : 0;
}

BS.bonus = {
  EVERY: EVERY,
  /** how many slots the shipped list covers */
  count: function () { return COUNT; },
  puzzleFor: puzzleFor,
  slotAt: slotAt,

  /* The slot owed after winning classic `index`, or 0 for none.
   *
   * ⚠ Compared against the highest slot already settled, not a per-slot flag.
   * Replaying level 5 must not re-offer a level the player already took or
   * turned down, and a player who jumps ahead through level select should not
   * come back to a queue of forty owed detours. */
  dueAfter: function (mode, index) {
    if (mode !== 'classic') return 0;
    var s = slotAt(index);
    return (s && s > save.bonusDone()) ? s : 0;
  },

  /** played or turned down - either way it is done with */
  settle: function (slot) { save.setBonusDone(slot); }
};

})();
