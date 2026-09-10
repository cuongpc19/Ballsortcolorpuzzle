/* Ball Sort Puzzle - Color Game (HTML clone)
   Level data extracted from the original APK (v5.4.0):
     classic : 15100 levels, 4 balls / tube
     hard    :  2596 levels, 6 or 8 balls / tube                       */
(function () {
'use strict';

var BS = window.BS;
var save = BS.save;
var ECON = BS.ECON;

/* ============================ level data ============================ */

var CH = '0123456789abc';

var PACKS = {
  classic: { name: 'Classic', depth: 4, data: window.LEVELS_CLASSIC || [],
             par: window.PAR_CLASSIC || '' },
  hard:    { name: 'Hard',    depth: 0, data: window.LEVELS_HARD    || [],
             par: window.PAR_HARD    || '' }
};

/** how many moves the original game's own solution took for this level */
function parOf(mode, index) {
  var t = PACKS[mode].par;
  if (!t || index * 2 + 2 > t.length) return 0;
  return parseInt(t.substr(index * 2, 2), 36) || 0;
}

/** decode one packed level -> {depth, tubes:[[colors bottom..top]]} */
function decodeLevel(mode, index) {
  var pack = PACKS[mode], raw = pack.data[index];
  if (raw == null) return null;
  var depth = pack.depth;
  if (!depth) { depth = +raw[0]; raw = raw.slice(1); }
  var tubes = raw.split('-').map(function (seg) {
    var t = [];
    for (var i = 0; i < seg.length; i++) t.push(CH.indexOf(seg[i]));
    return t;
  });
  return { depth: depth, tubes: tubes };
}

/** how many distinct colours a packed level uses */
function colorsOf(mode, index) {
  var raw = PACKS[mode].data[index];
  if (raw == null) return 0;
  if (!PACKS[mode].depth) raw = raw.slice(1);     /* hard: drop depth char */
  var seen = {}, n = 0;
  for (var i = 0; i < raw.length; i++) {
    var c = raw.charAt(i);
    if (c === '-' || seen[c]) continue;
    seen[c] = 1; n++;
  }
  return n;
}

/* ============================== palette ============================= */

/* A level's colours are just indices 1..N, so which hue sits at which index is
 * ours to choose - and it is deliberately not the original's choice, so the
 * same puzzle reads as a different picture.
 *
 * The swap stays inside each band. A five-colour level uses indices 1-5, a
 * seven-colour one 1-7, and so on, so those groups are what actually has to
 * stay easy to tell apart; shuffling within a band changes every board without
 * ever putting two near-neighbours in the same level.
 */
var COLORS = [
  null,
  { a: '#ff7a72', b: '#d4141c', c: '#8a0308' }, /* 1  red     */
  { a: '#a8f77a', b: '#4ddc10', c: '#218f04' }, /* 2  green   */
  { a: '#7ed4ff', b: '#1f9ce8', c: '#0b5ea8' }, /* 3  blue    */
  { a: '#ffc078', b: '#f08000', c: '#a44b03' }, /* 4  orange  */
  { a: '#c79bff', b: '#8b2fd6', c: '#f0c419', rainbow: true }, /* 5 purple */
  { a: '#fff58a', b: '#e8de10', c: '#a89b04' }, /* 6  yellow  */
  { a: '#ffd0e6', b: '#ff8ec4', c: '#d4488f' }, /* 7  pink    */
  { a: '#dcb083', b: '#a9702f', c: '#63400f' }, /* 8  brown   */
  { a: '#8bf0ea', b: '#14c8c0', c: '#067b76' }, /* 9  teal    */
  { a: '#f070c8', b: '#c4109a', c: '#6b0057' }, /* 10 magenta */
  { a: '#dfe6ee', b: '#9aa3ad', c: '#5a626b' }, /* 11 grey    */
  { a: '#7f88ff', b: '#2634d8', c: '#0d1470' }  /* 12 navy    */
];

/** a colour that is nobody's, for an index that should not exist */
var NO_COLOUR = { a: '#c9ced8', b: '#8b929e', c: '#4c525c' };

function col(ci) { return COLORS[ci] || NO_COLOUR; }

/* the small companion glint under the main highlight, like the artwork */
var GLINT = 'radial-gradient(circle at 21% 31%, #fff 0 3.2%, rgba(255,255,255,0) 5%), ';

function ballBackground(ci) {
  var c = col(ci);
  if (c.rainbow) {
    return GLINT + 'radial-gradient(circle at 34% 26%, ' + c.a + ' 0%, ' + c.b +
           ' 42%, #34d0e0 74%, ' + c.c + ' 100%)';
  }
  return GLINT + 'radial-gradient(circle at 34% 26%, ' + c.a + ' 0%, ' + c.b +
         ' 46%, ' + c.b + ' 62%, ' + c.c + ' 100%)';
}

/* =============================== state ============================== */

var S = {
  mode: 'classic', index: 0, depth: 4, cap: 4,
  tubes: [], sel: -1, moves: 0, history: [],
  extraSlots: 0, won: false, seq: 0, geo: null, combo: 0,
  freeUsed: { undo: 0, tube: 0, hint: 0 },  /* the per-level allowance */
  sinceClear: 0,      /* moves made since the last tube was finished */
  lastClear: 0,       /* timestamp of that moment                    */
  t0: 0               /* when the level started                      */
};

var el = {
  board:    document.getElementById('board'),
  tubes:    document.getElementById('tubes'),
  balls:    document.getElementById('balls'),
  fx:       document.getElementById('fx'),
  levelNum: document.getElementById('levelNum'),
  moveNum:  document.getElementById('moveNum'),
  toast:    document.getElementById('toast'),
  win:      document.getElementById('winOverlay'),
  winLevel: document.getElementById('winLevel'),
  winPraise:document.getElementById('winPraise'),
  winReward:document.getElementById('winReward'),
  winCoins: document.getElementById('winCoins'),
  sky:      document.getElementById('sky'),
  sound:    document.getElementById('btnSound'),
  optSfx:   document.getElementById('optSfx'),
  optMusic: document.getElementById('optMusic'),
  btnUndo:  document.getElementById('btnUndo'),
  btnAdd:   document.getElementById('btnAdd'),
  btnHint:  document.getElementById('btnHint'),
  priceTube:document.getElementById('priceTube'),
  priceHint:document.getElementById('priceHint'),
  levelTag: document.getElementById('levelTag'),
  btnSkip:  document.getElementById('btnSkip'),
  stuck:    document.getElementById('stuckOverlay'),
  skipAsk:  document.getElementById('skipOverlay')
};

var REDUCED = !!(window.matchMedia &&
                 window.matchMedia('(prefers-reduced-motion: reduce)').matches);

/* ============================ preferences =========================== */

function currentOf(mode) {
  return Math.min(Math.max(save.level(mode), 0), PACKS[mode].data.length - 1);
}
function setCurrent(mode, idx) { save.setLevel(mode, idx); }

/* ========================= audio: engine ============================ */
/* everything is synthesised - no audio files needed                    */

var AU = {
  ctx: null, master: null, sfxBus: null, musBus: null, echo: null,
  noise: null, sfxOn: true, musicOn: true, ready: false,
  /* A host page can silence us, and its switch outranks the one in Settings:
     the in-game toggle must never be able to bring sound back over a page the
     player has muted. Kept apart from sfxOn/musicOn so their own preference
     survives being overridden and comes back when the host unmutes. */
  hostMute: false
};

function sfxAudible()   { return AU.sfxOn   && !AU.hostMute; }
function musicAudible() { return AU.musicOn && !AU.hostMute; }

function audioInit() {
  if (AU.ctx) return true;
  var Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return false;
  try { AU.ctx = new Ctor(); } catch (e) { return false; }

  var c = AU.ctx;
  AU.master = c.createGain();
  AU.master.gain.value = 0.9;
  AU.master.connect(c.destination);

  AU.sfxBus = c.createGain();
  AU.sfxBus.gain.value = sfxAudible() ? 1 : 0;
  AU.sfxBus.connect(AU.master);

  AU.musBus = c.createGain();
  AU.musBus.gain.value = 0;              /* faded in when music starts */
  AU.musBus.connect(AU.master);

  /* a short feedback delay gives every sound a bit of sparkle */
  var d = c.createDelay(0.6), fb = c.createGain(), lp = c.createBiquadFilter();
  d.delayTime.value = 0.19;
  fb.gain.value = 0.26;
  lp.type = 'lowpass'; lp.frequency.value = 2600;
  d.connect(lp); lp.connect(fb); fb.connect(d);
  var wet = c.createGain(); wet.gain.value = 0.5;
  d.connect(wet); wet.connect(AU.master);
  AU.echo = d;

  /* reusable white-noise buffer for clicks / shakers / impacts */
  var len = Math.floor(c.sampleRate * 0.5);
  var buf = c.createBuffer(1, len, c.sampleRate);
  var ch0 = buf.getChannelData(0);
  for (var i = 0; i < len; i++) ch0[i] = Math.random() * 2 - 1;
  AU.noise = buf;

  AU.ready = true;
  return true;
}

function resumeAudio() {
  if (!audioInit()) return;
  if (AU.ctx.state === 'suspended') AU.ctx.resume();
  if (musicAudible()) musicStart();
}

/** one synth voice */
function tone(o) {
  if (!AU.ready || !AU.sfxOn) return;
  var c = AU.ctx, t = c.currentTime + (o.at || 0);
  var osc = c.createOscillator(), g = c.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + o.dur);
  var peak = (o.vol == null ? 0.18 : o.vol);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + (o.atk || 0.008));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g);
  g.connect(AU.sfxBus);
  if (o.echo) { var s = c.createGain(); s.gain.value = o.echo; g.connect(s); s.connect(AU.echo); }
  osc.start(t); osc.stop(t + o.dur + 0.03);
}

/** filtered noise burst - clicks, impacts, shakers */
function noiseHit(o) {
  if (!AU.ready || !AU.sfxOn) return;
  var c = AU.ctx, t = c.currentTime + (o.at || 0);
  var src = c.createBufferSource(); src.buffer = AU.noise;
  var f = c.createBiquadFilter();
  f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.f || 1800, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
  f.Q.value = o.q || 1.2;
  var g = c.createGain();
  g.gain.setValueAtTime(o.vol == null ? 0.16 : o.vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f); f.connect(g); g.connect(AU.sfxBus);
  src.start(t); src.stop(t + o.dur + 0.02);
}

function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

/* ========================= audio: sound fx ========================== */

var SFX = {
  /* cartoon cork-pop when a ball is picked up */
  pick: function (h) {
    var base = 520 + (h || 0) * 40;
    tone({ f: base, f2: base * 1.9, dur: 0.13, type: 'sine', vol: 0.20, atk: 0.004, echo: 0.12 });
    noiseHit({ f: 2600, f2: 5200, dur: 0.05, vol: 0.09 });
  },
  /* springy "blop" when it lands, pitched by how full the tube is */
  drop: function (h) {
    var base = 300 + (h || 0) * 46;
    tone({ f: base * 1.45, f2: base * 0.72, dur: 0.16, type: 'sine', vol: 0.22, atk: 0.004 });
    tone({ f: base * 2.9, f2: base * 1.4, dur: 0.07, type: 'triangle', vol: 0.07 });
    noiseHit({ f: 900, f2: 300, dur: 0.07, vol: 0.10 });
  },
  /* comedic "wah-wah" for an illegal move */
  deny: function () {
    tone({ f: 300, f2: 130, dur: 0.26, type: 'sawtooth', vol: 0.11 });
    tone({ f: 152, f2: 66, dur: 0.28, type: 'square', vol: 0.05 });
  },
  /* bright rising arpeggio when a tube is completed */
  complete: function (n) {
    var seq = [72, 76, 79, 84], k;
    for (k = 0; k < seq.length; k++) {
      tone({ f: midi(seq[k] + Math.min(4, (n || 0) * 2)), dur: 0.26, type: 'triangle',
             vol: 0.17, at: k * 0.062, echo: 0.30 });
    }
    noiseHit({ f: 5200, f2: 9000, dur: 0.30, vol: 0.05, at: 0.02 });
  },
  /* full "ta-daa" */
  win: function () {
    var seq = [[72, 0], [76, 0.10], [79, 0.20], [84, 0.32], [88, 0.32]];
    seq.forEach(function (s) {
      tone({ f: midi(s[0]), dur: 0.55, type: 'triangle', vol: 0.15, at: s[1], echo: 0.35 });
      tone({ f: midi(s[0] - 12), dur: 0.5, type: 'sine', vol: 0.07, at: s[1] });
    });
    noiseHit({ f: 6000, f2: 11000, dur: 0.6, vol: 0.05, at: 0.3 });
  },
  ui: function () {
    tone({ f: 880, f2: 1180, dur: 0.05, type: 'square', vol: 0.05 });
  },
  whoosh: function () {
    noiseHit({ f: 500, f2: 2600, dur: 0.16, vol: 0.05, q: 0.8 });
  },
  /* the lid clunking shut on a finished tube */
  lid: function () {
    tone({ f: 210, f2: 128, dur: 0.13, type: 'triangle', vol: 0.20, atk: 0.003 });
    noiseHit({ f: 2400, f2: 600, dur: 0.09, vol: 0.13, q: 0.9 });
    tone({ f: 1500, f2: 900, dur: 0.06, type: 'sine', vol: 0.06, at: 0.01 });
  },
  /* firework shell going up */
  whistle: function () {
    tone({ f: 320, f2: 1150, dur: 0.42, type: 'sine', vol: 0.05, atk: 0.06 });
  },
  /* firework shell going off */
  boom: function () {
    tone({ f: 95, f2: 36, dur: 0.34, type: 'sine', vol: 0.26, atk: 0.004 });
    noiseHit({ f: 1400, f2: 180, dur: 0.42, vol: 0.16, q: 0.6, type: 'lowpass' });
    for (var i = 0; i < 7; i++) {
      noiseHit({ f: 3000 + Math.random() * 4000, dur: 0.05,
                 vol: 0.05, q: 3, at: 0.12 + Math.random() * 0.5 });
    }
  },
  /* coins dropping into the wallet */
  coin: function () {
    [0, 0.07, 0.14].forEach(function (t, k) {
      tone({ f: 1180 + k * 220, dur: 0.11, type: 'triangle', vol: 0.13, at: t, echo: 0.25 });
    });
  },
  /* one star landing in the level-complete popup */
  star: function (i) {
    tone({ f: midi(76 + (i || 0) * 4), dur: 0.30, type: 'triangle', vol: 0.17, echo: 0.35 });
    tone({ f: midi(88 + (i || 0) * 4), dur: 0.16, type: 'sine', vol: 0.06 });
  }
};

function sfx(name, arg) { if (AU.ready && AU.sfxOn) SFX[name] && SFX[name](arg); }

/* ========================= audio: music ============================= */
/* a bouncy 4-bar loop: plucky bass, marimba melody, kick + shaker      */

var BPM = 118;
var STEP = 30 / BPM;                    /* one eighth note in seconds   */

var CHORDS = [                          /* C  -  G  -  Am  -  F         */
  { root: 48, tones: [60, 64, 67] },
  { root: 43, tones: [59, 62, 67] },
  { root: 45, tones: [57, 60, 64] },
  { root: 41, tones: [57, 60, 65] }
];

var MELODY = [                          /* 32 eighth notes, 0 = rest    */
  72, 0, 76, 0,  74, 0,  0, 72,
  71, 0, 74, 0,  79, 0,  0, 76,
  72, 0, 76, 0,  81, 0,  0, 79,
  77, 0, 74, 0,  72, 0, 74,  0
];

var MUS = { timer: null, next: 0, step: 0 };

function musNote(o) {
  var c = AU.ctx, t = o.t;
  var osc = c.createOscillator(), g = c.createGain();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.vol, t + (o.atk || 0.01));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g); g.connect(AU.musBus);
  if (o.echo) { var s = c.createGain(); s.gain.value = o.echo; g.connect(s); s.connect(AU.echo); }
  osc.start(t); osc.stop(t + o.dur + 0.03);
}

function musNoise(o) {
  var c = AU.ctx, t = o.t;
  var src = c.createBufferSource(); src.buffer = AU.noise;
  var f = c.createBiquadFilter();
  f.type = 'highpass'; f.frequency.value = o.hp || 6000;
  var g = c.createGain();
  g.gain.setValueAtTime(o.vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  src.connect(f); f.connect(g); g.connect(AU.musBus);
  src.start(t); src.stop(t + o.dur + 0.02);
}

function scheduleStep(step, t) {
  var bar = Math.floor(step / 8) % 4;
  var ch = CHORDS[bar];
  var inBar = step % 8;

  /* bouncy bass */
  if (inBar === 0 || inBar === 3 || inBar === 4 || inBar === 6) {
    var bn = (inBar === 6) ? ch.root + 7 : ch.root;
    musNote({ t: t, f: midi(bn), dur: 0.26, type: 'triangle', vol: 0.16, atk: 0.006 });
    musNote({ t: t, f: midi(bn - 12), dur: 0.22, type: 'sine', vol: 0.10, atk: 0.006 });
  }

  /* warm chord stabs on the off-beats */
  if (inBar === 2 || inBar === 5) {
    ch.tones.forEach(function (n, i) {
      musNote({ t: t + i * 0.006, f: midi(n), dur: 0.22, type: 'triangle',
                vol: 0.045, atk: 0.012 });
    });
  }

  /* marimba melody */
  var m = MELODY[step % 32];
  if (m) {
    musNote({ t: t, f: midi(m), dur: 0.42, type: 'triangle', vol: 0.11,
              atk: 0.005, echo: 0.22 });
    musNote({ t: t, f: midi(m + 12), dur: 0.16, type: 'sine', vol: 0.035, atk: 0.004 });
  }

  /* kick on the beat, shaker on the off */
  if (inBar % 4 === 0) {
    musNote({ t: t, f: 120, f2: 46, dur: 0.16, type: 'sine', vol: 0.20, atk: 0.004 });
  }
  if (inBar % 2 === 1) {
    musNoise({ t: t, dur: 0.045, vol: inBar === 3 ? 0.045 : 0.028, hp: 7000 });
  }
}

function musicTick() {
  if (!AU.ready) return;
  var c = AU.ctx;
  /* the clock stands still while the context is suspended - resync so we
     don't dump a burst of back-dated notes when it wakes up            */
  if (MUS.next < c.currentTime) MUS.next = c.currentTime + 0.05;
  while (MUS.next < c.currentTime + 0.4) {
    scheduleStep(MUS.step, MUS.next);
    MUS.next += STEP;
    MUS.step++;
  }
}

function musicStart() {
  if (!AU.ready || MUS.timer || !musicAudible()) return;
  if (AU.ctx.state === 'suspended') AU.ctx.resume();
  MUS.next = AU.ctx.currentTime + 0.15;
  MUS.step = 0;
  musicTick();
  MUS.timer = setInterval(musicTick, 60);
  AU.musBus.gain.cancelScheduledValues(AU.ctx.currentTime);
  AU.musBus.gain.setValueAtTime(0.0001, AU.ctx.currentTime);
  AU.musBus.gain.exponentialRampToValueAtTime(0.5, AU.ctx.currentTime + 1.4);
}

function musicStop() {
  if (!MUS.timer) return;
  clearInterval(MUS.timer);
  MUS.timer = null;
  if (AU.ready) {
    AU.musBus.gain.cancelScheduledValues(AU.ctx.currentTime);
    AU.musBus.gain.setValueAtTime(Math.max(0.0001, AU.musBus.gain.value), AU.ctx.currentTime);
    AU.musBus.gain.exponentialRampToValueAtTime(0.0001, AU.ctx.currentTime + 0.4);
  }
}

/** duck the music for a moment so a jingle can shine */
function duck(seconds) {
  if (!AU.ready || !MUS.timer) return;
  var g = AU.musBus.gain, t = AU.ctx.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(0.0001, g.value), t);
  g.exponentialRampToValueAtTime(0.12, t + 0.08);
  g.exponentialRampToValueAtTime(0.5, t + seconds);
}

/* ------------------------- audio preferences ------------------------ */

function applyAudioPrefs(persist) {
  el.optSfx.checked = AU.sfxOn;
  el.optMusic.checked = AU.musicOn;
  /* the HUD button is optional now that sound lives in the settings panel */
  if (el.sound) {
    el.sound.textContent = (AU.sfxOn || AU.musicOn) ? '🔊' : '🔇';
    el.sound.classList.toggle('off', !AU.sfxOn && !AU.musicOn);
  }
  if (AU.ready) AU.sfxBus.gain.value = sfxAudible() ? 1 : 0;
  if (musicAudible()) musicStart(); else musicStop();
  if (persist) save.setAudio(AU.sfxOn, AU.musicOn);
}

/* Deferred: on a host that hands us the player's save asynchronously, reading
   these at parse time would pick up the local copy instead of theirs. */
BS.whenReady(function readAudioPrefs() {
  AU.sfxOn = save.sfxOn();
  AU.musicOn = save.musicOn();
  applyAudioPrefs(false);
});

/* =========================== visual fx ============================== */

function fxEl(tag, css) {
  var e = document.createElement(tag);
  e.style.cssText = css;
  el.fx.appendChild(e);
  return e;
}
function fxKill(e, ms) { setTimeout(function () { e.remove(); }, ms); }

/** expanding ring */
function fxRing(cx, cy, r0, r1, color, life, width) {
  if (REDUCED) return;
  var e = fxEl('u', 'left:' + (cx - r0) + 'px;top:' + (cy - r0) + 'px;width:' +
                    (r0 * 2) + 'px;height:' + (r0 * 2) + 'px;border-color:' + color +
                    ';border-width:' + (width || 3) + 'px');
  if (!e.animate) { e.remove(); return; }
  e.animate([{ transform: 'scale(1)', opacity: 0.85 },
             { transform: 'scale(' + (r1 / r0) + ')', opacity: 0 }],
            { duration: life, easing: 'cubic-bezier(.15,.7,.35,1)', fill: 'forwards' });
  fxKill(e, life + 60);
}

/** dots flying outward */
function fxBurst(cx, cy, color, n, spread, size, life, up) {
  if (REDUCED) return;
  for (var i = 0; i < n; i++) {
    var s = size * (0.55 + Math.random() * 0.9);
    var e = fxEl('b', 'left:' + (cx - s / 2) + 'px;top:' + (cy - s / 2) + 'px;width:' +
                      s + 'px;height:' + s + 'px;background:' + color);
    if (!e.animate) { e.remove(); continue; }
    var ang = (Math.PI * 2 * i) / n + Math.random() * 0.6;
    var dist = spread * (0.5 + Math.random() * 0.75);
    var dx = Math.cos(ang) * dist;
    var dy = Math.sin(ang) * dist - (up || 0);
    var t = life * (0.7 + Math.random() * 0.5);
    e.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: 'translate(' + dx * 0.65 + 'px,' + (dy * 0.65 - spread * 0.12) + 'px) scale(.85)',
        opacity: .95, offset: .55 },
      { transform: 'translate(' + dx + 'px,' + (dy + spread * 0.28) + 'px) scale(.15)', opacity: 0 }
    ], { duration: t, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
    fxKill(e, t + 60);
  }
}

/** twinkling stars */
function fxSparkle(cx, cy, spread, n, size, life) {
  if (REDUCED) return;
  for (var i = 0; i < n; i++) {
    var s = size * (0.7 + Math.random() * 0.8);
    var x = cx + (Math.random() - 0.5) * spread;
    var y = cy + (Math.random() - 0.5) * spread;
    var e = fxEl('s', 'left:' + (x - s / 2) + 'px;top:' + (y - s / 2) + 'px;width:' +
                      s + 'px;height:' + s + 'px');
    if (!e.animate) { e.remove(); continue; }
    var t = life * (0.7 + Math.random() * 0.6);
    e.animate([
      { transform: 'scale(0) rotate(0deg)', opacity: 0 },
      { transform: 'scale(1.15) rotate(70deg)', opacity: 1, offset: 0.35 },
      { transform: 'scale(0) rotate(150deg)', opacity: 0 }
    ], { duration: t, delay: Math.random() * 220, easing: 'ease-out', fill: 'forwards' });
    fxKill(e, t + 320);
  }
}

/** an emoji that pops up and floats away */
function fxPop(cx, cy, text, size, life) {
  if (REDUCED) return;
  var e = fxEl('em', 'left:' + (cx - size) + 'px;top:' + (cy - size) + 'px;width:' +
                     (size * 2) + 'px;font-size:' + size + 'px');
  e.textContent = text;
  if (!e.animate) { e.remove(); return; }
  e.animate([
    { transform: 'translateY(6px) scale(0) rotate(-30deg)', opacity: 0 },
    { transform: 'translateY(-6px) scale(1.25) rotate(10deg)', opacity: 1, offset: 0.32 },
    { transform: 'translateY(-14px) scale(1) rotate(-4deg)', opacity: 1, offset: 0.55 },
    { transform: 'translateY(-' + (size * 1.7) + 'px) scale(.9)', opacity: 0 }
  ], { duration: life, easing: 'cubic-bezier(.2,1.3,.4,1)', fill: 'forwards' });
  fxKill(e, life + 60);
}

/* ============================ fireworks ============================= */

function skyEl(tag, css) {
  var e = document.createElement(tag);
  e.style.cssText = css;
  el.sky.appendChild(e);
  return e;
}

/** board coordinates -> viewport coordinates */
function toSky(x, y) {
  var r = el.board.getBoundingClientRect();
  return { x: x + r.left, y: y + r.top };
}

/** one shell bursting at (cx, cy) in viewport space */
function burst(cx, cy, colour, n, radius, life) {
  if (REDUCED) return;
  var flash = skyEl('u', 'left:' + (cx - radius * 0.16) + 'px;top:' + (cy - radius * 0.16) +
                         'px;width:' + (radius * 0.32) + 'px;height:' + (radius * 0.32) +
                         'px;border-color:' + colour.a + ';border-width:4px');
  if (flash.animate) {
    flash.animate([{ transform: 'scale(.3)', opacity: 1 },
                   { transform: 'scale(3.4)', opacity: 0 }],
                  { duration: 520, easing: 'cubic-bezier(.1,.75,.3,1)', fill: 'forwards' });
  }
  setTimeout(function () { flash.remove(); }, 600);

  for (var i = 0; i < n; i++) {
    var sz = 3 + Math.random() * 4;
    var e = skyEl('b', 'left:' + (cx - sz / 2) + 'px;top:' + (cy - sz / 2) + 'px;width:' +
                       sz + 'px;height:' + sz + 'px;background:' + (i % 3 ? colour.b : colour.a) +
                       ';box-shadow:0 0 ' + (sz * 2.2) + 'px ' + colour.a);
    if (!e.animate) { e.remove(); continue; }
    var ang = (Math.PI * 2 * i) / n + Math.random() * 0.35;
    var sp = radius * (0.55 + Math.random() * 0.65);
    var dx = Math.cos(ang) * sp, dy = Math.sin(ang) * sp;
    var t = life * (0.7 + Math.random() * 0.55);
    e.animate([
      { transform: 'translate(0,0) scale(1.3)', opacity: 1 },
      { transform: 'translate(' + dx * 0.72 + 'px,' + (dy * 0.72 + radius * 0.06) + 'px) scale(1)',
        opacity: 1, offset: 0.42, easing: 'cubic-bezier(.1,.7,.3,1)' },
      { transform: 'translate(' + dx + 'px,' + (dy + radius * 0.62) + 'px) scale(.15)', opacity: 0 }
    ], { duration: t, easing: 'linear', fill: 'forwards' });
    fxKill(e, t + 60);
  }
  sfx('boom');
}

/** a shell that climbs from the bottom of the screen, then explodes */
function shell(cx, cy, colour, delay, n, radius) {
  if (REDUCED) return;
  var H = window.innerHeight;
  var sz = 6;
  var e = skyEl('b', 'left:' + (cx - sz / 2) + 'px;top:' + (H + 10) + 'px;width:' + sz +
                     'px;height:' + sz + 'px;background:' + colour.a +
                     ';box-shadow:0 0 14px ' + colour.a);
  if (!e.animate) { e.remove(); return; }
  var rise = 460 + Math.random() * 200;
  e.animate([
    { transform: 'translateY(0) scaleY(2.4)', opacity: 1 },
    { transform: 'translateY(' + (cy - H - 10) + 'px) scaleY(1)', opacity: .9 }
  ], { duration: rise, delay: delay, easing: 'cubic-bezier(.15,.6,.4,1)', fill: 'backwards' });
  setTimeout(function () { sfx('whistle'); }, delay);
  setTimeout(function () {
    e.remove();
    burst(cx, cy, colour, n, radius, 1100);
  }, delay + rise);
}

/** a whole show: `count` shells scattered over the screen */
function fireworksShow(count, spread) {
  if (REDUCED) return;
  var W = window.innerWidth, H = window.innerHeight;
  for (var i = 0; i < count; i++) {
    var c = col(1 + ((Math.random() * 12) | 0));
    var cx = W * (0.14 + Math.random() * 0.72);
    var cy = H * (0.14 + Math.random() * 0.34);
    shell(cx, cy, c, i * (spread || 220) + Math.random() * 120,
          26 + ((Math.random() * 14) | 0), Math.min(W, H) * (0.22 + Math.random() * 0.14));
  }
}

/** a big word across the middle of the screen */
/* `text` may carry markup - the daily reward flies its coin in this way */
function banner(text, size, life) {
  if (REDUCED) { toast(text.replace(/<[^>]*>/g, '')); return; }
  var e = skyEl('em', 'top:' + (window.innerHeight * 0.34) + 'px;font-size:' + size +
                      'px;transform:translateX(-50%)');
  e.innerHTML = text;
  if (!e.animate) { e.remove(); return; }
  e.animate([
    { transform: 'translateX(-50%) scale(.2) rotate(-14deg)', opacity: 0 },
    { transform: 'translateX(-50%) scale(1.18) rotate(4deg)', opacity: 1, offset: 0.24 },
    { transform: 'translateX(-50%) scale(1) rotate(-1deg)', opacity: 1, offset: 0.4 },
    { transform: 'translateX(-50%) scale(1.02) rotate(0deg)', opacity: 1, offset: 0.74 },
    { transform: 'translateX(-50%) translateY(-46px) scale(.9)', opacity: 0 }
  ], { duration: life, easing: 'cubic-bezier(.2,1.2,.4,1)', fill: 'forwards' });
  fxKill(e, life + 80);
}

/* ============================== loading ============================= */

function loadLevel(mode, index) {
  /* `index` is the level on the box; `src` is the puzzle actually dealt.
     They differ only where the difficulty system has swapped one in. */
  var src = (BS.dda && BS.dda.pick) ? BS.dda.pick(mode, index) : index;
  var lv = decodeLevel(mode, src);
  if (!lv) { src = index; lv = decodeLevel(mode, index); }
  if (!lv) return;
  S.mode = mode;
  S.index = index;
  S.src = src;
  S.depth = S.cap = lv.depth;
  S.seq = 0;
  S.tubes = lv.tubes.map(function (t) {
    return t.map(function (c) { return { id: ++S.seq, c: c }; });
  });
  S.sel = -1;
  S.moves = 0;
  S.history = [];
  S.extraSlots = 0;
  S.won = false;
  S.combo = 0;
  /* `FreeAddTubeNum` / `UseFreeCount` in the original: the free go resets
     with the level, the bag does not. */
  S.freeUsed = { undo: 0, tube: 0, hint: 0 };
  S.sinceClear = 0;
  S.lastClear = Date.now();
  S.t0 = Date.now();
  dealFaceDown();
  dealLucky();
  /* how hard is this one *for this player* - see dda.js */
  S.tier = (BS.dda && BS.dda.tier)
    ? BS.dda.tier(index, colorsOf(mode, src), S.question) : 0;
  paintTier();
  refreshSkip();
  clearHint();
  clearStuck();
  el.balls.innerHTML = '';
  el.fx.innerHTML = '';
  el.sky.innerHTML = '';
  ballEls = {};                    /* forget the previous level's nodes */
  buildTubes();
  layout();
  paint({ instant: true });
  dealIn();
  BS.emit('levelReady', { mode: mode, index: index });
}

function reloadLevel() {
  if (S.geo && !S.won) BS.emit('replay', { mode: S.mode, index: S.index });
  loadLevel(S.mode, S.index);
}

/* ============================== layout ============================= */

/* wall thickness as a fraction of the ball size - the chunky moulded
   look from the store artwork                                          */
var WALL = 0.115;

/* breathing room, measured off the reference layout: the tubes sit well
   clear of each other and of the screen edges instead of filling it   */
var GAP_X = 0.68;      /* horizontal gap, in ball diameters           */
var GAP_Y = 0.70;      /* gap between rows                            */
var SIDE  = 0.06;      /* side margin, as a fraction of board width   */

function computeGeometry() {
  var W = el.board.clientWidth, H = el.board.clientHeight;
  var n = S.tubes.length, depth = S.depth;
  var padX = Math.max(14, W * SIDE);
  /* enough room under the last row for the tubes' drop shadow */
  var padY = Math.max(12, H * 0.03);
  var best = null;

  /* tube outer size in units of d: 1.16 of clear bore + both walls */
  var wSpan = 1.16 + 2 * WALL;
  var hSpan = depth + 0.30 + 2 * WALL;

  for (var rows = 1; rows <= 3; rows++) {
    if (rows > n) break;
    var per = Math.ceil(n / rows);
    var byW = (W - 2 * padX) / (per * wSpan + (per - 1) * GAP_X);
    var byH = (H - 2 * padY) / (rows * (hSpan + 1.15) + (rows - 1) * GAP_Y);
    var dd = Math.min(byW, byH);
    if (!best || dd > best.d) best = { d: dd, rows: rows };
  }

  var d     = Math.max(16, Math.min(74, best.d));
  var bw    = Math.max(2, Math.min(9, Math.floor(d * WALL)));
  var tubeW = d * 1.16 + 2 * bw;
  var tubeH = depth * d + d * 0.30 + 2 * bw;
  var gapX  = d * GAP_X;
  var gapY  = d * GAP_Y;
  var liftH = d * 1.15;
  var rows  = best.rows;

  var counts = [];
  for (var r = 0; r < rows; r++) {
    counts.push(Math.floor(n / rows) + (r < n % rows ? 1 : 0));
  }

  var totalH = rows * (tubeH + liftH) + (rows - 1) * gapY;
  var y0 = (H - totalH) / 2 + liftH;

  var pos = [];
  for (var r2 = 0; r2 < rows; r2++) {
    var cnt = counts[r2];
    var rowW = cnt * tubeW + (cnt - 1) * gapX;
    var x0 = (W - rowW) / 2;
    var y = y0 + r2 * (tubeH + liftH + gapY);
    for (var i = 0; i < cnt; i++) {
      pos.push({ x: x0 + i * (tubeW + gapX), y: y, w: tubeW, h: tubeH });
    }
  }
  /* a part-grown extra tube is shorter; drop its top so its base still sits
     on the same line as everything else in the row */
  if (S.extraSlots > 0 && S.extraSlots < S.cap) {
    var last = pos[S.tubes.length - 1];
    if (last) {
      var shortH = S.extraSlots * d + d * 0.30 + 2 * bw;
      last.y += last.h - shortH;
      last.h = shortH;
    }
  }
  return { d: d, bw: bw, tubeW: tubeW, tubeH: tubeH, liftH: liftH, pos: pos };
}

function buildTubes() {
  el.tubes.innerHTML = '';
  S.tubes.forEach(function (_, i) {
    var t = document.createElement('div');
    t.className = 'tube';
    t.dataset.i = i;
    t.appendChild(document.createElement('i')).className = 'lid';
    el.tubes.appendChild(t);
  });
}

function layout() {
  S.geo = computeGeometry();
  var g = S.geo, nodes = el.tubes.children;
  for (var i = 0; i < nodes.length; i++) {
    var p = g.pos[i]; if (!p) continue;
    var s = nodes[i].style;
    s.left = p.x + 'px'; s.top = p.y + 'px';
    s.width = p.w + 'px'; s.height = p.h + 'px';
    s.borderRadius = (g.d * 0.30) + 'px ' + (g.d * 0.30) + 'px 999px 999px';
    s.setProperty('--bw', g.bw + 'px');
  }
}

/* ============================== geometry ============================ */

function slotPos(ti, bi) {
  var g = S.geo, p = g.pos[ti], d = g.d;
  return { x: p.x + (p.w - d) / 2,
           y: p.y + p.h - g.bw - d * 0.15 - d - bi * d };
}
function liftPos(ti, k) {
  var g = S.geo, p = g.pos[ti], d = g.d;
  return { x: p.x + (p.w - d) / 2, y: p.y - d * 0.95 - k * d };
}
function tubeMouth(ti) {
  var g = S.geo, p = g.pos[ti];
  return { x: p.x + p.w / 2, y: p.y + g.bw + g.d * 0.15 };
}
function tf(x, y, sx, sy) {
  return 'translate(' + x + 'px,' + y + 'px) scale(' + sx + ',' + sy + ')';
}

/* ============================== painting ============================ */

var ballEls = {};

function ballNode(ball) {
  var e = ballEls[ball.id];
  if (!e) {
    e = document.createElement('div');
    e.className = 'ball';
    e.style.background = ballBackground(ball.c);
    el.balls.appendChild(e);
    ballEls[ball.id] = e;
    e._fresh = true;
  }
  faceBall(e, ball);
  coinBall(e, ball);
  return e;
}

/** a lucky coin rides on its ball until the ball is moved */
function coinBall(e, ball) {
  if (ball.coin) {
    if (!e._c) {
      e._c = document.createElement('i');
      e._c.className = 'ballCoin';
      e.appendChild(e._c);
    }
    return;
  }
  if (!e._c) return;
  var c = e._c;
  e._c = null;
  c.classList.add('off');
  setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 420);
}

/* The colour is always painted on the ball itself; the question mark is a lid
   laid over it. Revealing is then just taking the lid off, which is what lets
   it dissolve instead of cutting. */
function faceBall(e, ball) {
  if (ball.hidden) {
    if (!e._q) {
      e._q = document.createElement('i');
      e._q.className = 'qmark';
      e.appendChild(e._q);
    }
    return;
  }
  if (!e._q) return;
  var q = e._q;
  e._q = null;
  q.classList.add('off');
  setTimeout(function () { if (q.parentNode) q.parentNode.removeChild(q); }, 340);
}

function stopBob(e) {
  if (e._bob) { try { e._bob.cancel(); } catch (x) {} e._bob = null; }
}

function startBob(e, pos) {
  if (REDUCED || !e.animate) return;
  var d = S.geo.d;
  e._bob = e.animate([
    { transform: tf(pos.x, pos.y, 1, 1) },
    { transform: tf(pos.x, pos.y - d * 0.11, 1.01, 0.99) },
    { transform: tf(pos.x, pos.y, 1, 1) }
  ], { duration: 1500, delay: 240, iterations: Infinity,
       easing: 'ease-in-out', fill: 'none' });
}

function place(e, pos, instant) {
  var d = S.geo.d;
  e.style.width = d + 'px';
  e.style.height = d + 'px';
  e.style.setProperty('--d', d + 'px');
  if (instant || e._fresh) {
    e.style.transition = 'none';
    e.style.transform = tf(pos.x, pos.y, 1, 1);
    void e.offsetWidth;
    e.style.transition = '';
    e._fresh = false;
  } else {
    e.style.transform = tf(pos.x, pos.y, 1, 1);
  }
  e._pos = pos;
}

/** opts: {instant, skip:{id:true}} - skipped balls are mid-flight */
function paint(opts) {
  opts = opts || {};
  var g = S.geo; if (!g) return;
  var live = {};

  S.tubes.forEach(function (tube, ti) {
    if (!g.pos[ti]) return;
    var run = (S.sel === ti) ? runLen(tube) : 0;
    tube.forEach(function (ball, bi) {
      live[ball.id] = 1;
      var e = ballNode(ball);
      var lifted = run && bi >= tube.length - run;
      var pos = lifted ? liftPos(ti, bi - (tube.length - run)) : slotPos(ti, bi);
      stopBob(e);
      e.classList.toggle('sel', !!lifted);
      if (opts.skip && opts.skip[ball.id]) { e._pos = pos; return; }
      place(e, pos, opts.instant);
      if (lifted && !opts.instant) startBob(e, pos);
    });
  });

  for (var id in ballEls) {
    if (!live[id]) { ballEls[id].remove(); delete ballEls[id]; }
  }

  var nodes = el.tubes.children;
  for (var i = 0; i < nodes.length; i++) {
    /* only a *filled* single-colour tube dims down - empty ones stay
       bright because they are still valid targets                     */
    var sealed = S.tubes[i].length > 0 && isDone(S.tubes[i], i);
    nodes[i].classList.toggle('done', sealed);
    nodes[i].classList.toggle('capped', sealed);
    nodes[i].classList.toggle('lift', S.sel === i);
  }

  el.levelNum.textContent = S.index + 1;
  if (el.moveNum) el.moveNum.textContent = S.moves;
  refreshBoosters();
}

/* ---------------------- the flight of a ball ------------------------ */

/* Rise straight up out of the tube, glide across, then drop in - the
   same three-phase path the original game uses, with squash & stretch. */
function flyBall(e, from, to, apexY, delay, onLand) {
  var d = S.geo.d;
  var d1 = Math.max(0, from.y - apexY);
  var d2 = Math.abs(to.x - from.x);
  var d3 = Math.max(0, to.y - apexY);
  var sum = d1 + d2 + d3 || 1;
  var dur = 150 + Math.min(250, sum * 0.5);
  var L = 0.86;                                   /* touch-down at 86% */

  stopBob(e);
  e.classList.remove('sel');
  e.style.zIndex = 5;
  e.style.transition = 'none';
  e.style.transform = tf(to.x, to.y, 1, 1);
  e._pos = to;

  if (REDUCED || !e.animate) {
    void e.offsetWidth;
    e.style.transition = '';
    e.style.zIndex = '';
    if (onLand) onLand();
    return dur;
  }

  var oRise  = L * (d1 / sum);
  var oCross = L * ((d1 + d2) / sum);

  /* squash & stretch always follows the direction of travel:
     stretched sideways while gliding, stretched tall while falling,
     flattened on impact, then a small rebound.                       */
  var k = [{ offset: 0, transform: tf(from.x, from.y, 1, 1),
             easing: 'cubic-bezier(.15,.65,.35,1)' }];
  if (d1 > d * 0.15) {
    k.push({ offset: oRise, transform: tf(from.x, apexY, 1.05, 0.95),
             easing: 'cubic-bezier(.45,0,.55,1)' });
  }
  if (d2 > d * 0.15) {
    k.push({ offset: oCross, transform: tf(to.x, apexY, 1.09, 0.92),
             easing: 'cubic-bezier(.5,0,.85,.7)' });
  }
  if (d3 > d * 0.5) {
    k.push({ offset: oCross + (L - oCross) * 0.55,
             transform: tf(to.x, apexY + d3 * 0.30, 0.93, 1.10),
             easing: 'linear' });
  }
  k.push({ offset: L, transform: tf(to.x, to.y, 1.20, 0.80), easing: 'ease-out' });
  k.push({ offset: L + (1 - L) * 0.5, transform: tf(to.x, to.y - d * 0.09, 0.96, 1.05),
           easing: 'ease-in-out' });
  k.push({ offset: 1, transform: tf(to.x, to.y, 1, 1) });

  var anim = e.animate(k, { duration: dur, delay: delay || 0, fill: 'backwards' });
  anim.onfinish = function () { e.style.zIndex = ''; e.style.transition = ''; };
  if (onLand) setTimeout(onLand, (delay || 0) + dur * L);
  return dur;
}

/* =========================== face-down balls ======================= */
/* The original calls this `QuestionPostProcessor`: some tubes are dealt face
 * down behind a question mark, and a ball shows its colour only once it comes
 * to the top of its tube (`FadeQuestionBall`). It is a layer laid over an
 * ordinary puzzle rather than a different puzzle, which is why none of it
 * lives in the level data we extracted.
 *
 * Two rules follow. A run of one colour stops at the first face-down ball, so
 * a covered tube gives up one ball at a time - that is their
 * `TopBallSameCountWithoutQuestion`. And a ball that has shown itself stays
 * shown, even when something is poured back on top of it.
 */

/** every tenth level from the eighth is dealt this way */
var Q_EVERY = 10, Q_REM = 8;

/** how much of the board goes face down - a third, not the lot */
var Q_SHARE = 1 / 3;

function questionLevel(index) {
  return ((index + 1) % Q_EVERY) === Q_REM;
}

/* A level has to look the same every time it is opened. Storing a layout for
   15.100 levels to manage that would be silly, so the draw is made from the
   level number and comes out the same on every visit. */
function questionTubes(count, seed) {
  var order = [], i;
  for (i = 0; i < count; i++) order.push(i);
  var r = (seed * 2654435761 + 0x9e3779b9) >>> 0;
  for (i = count - 1; i > 0; i--) {
    r = (r * 1103515245 + 12345) >>> 0;
    var j = r % (i + 1), t = order[i]; order[i] = order[j]; order[j] = t;
  }
  return order.slice(0, Math.max(1, Math.round(count * Q_SHARE)));
}

/** turn the chosen tubes face down - everything beneath the top ball */
function dealFaceDown() {
  S.question = questionLevel(S.index);
  if (!S.question) return;
  var filled = [], i;
  for (i = 0; i < S.tubes.length; i++) if (S.tubes[i].length) filled.push(i);
  questionTubes(filled.length, S.index + 1).forEach(function (k) {
    var tube = S.tubes[filled[k]];
    for (var b = 0; b < tube.length - 1; b++) tube[b].hidden = true;
  });
  revealTops();
}

/** whatever is sitting on top of its tube has shown itself */
function revealTops() {
  if (!S.question) return;
  S.tubes.forEach(function (tube, ti) {
    if (!tube.length) return;
    tube[tube.length - 1].hidden = false;
    /* a finished tube has nothing left worth hiding */
    if (isDone(tube, ti)) {
      tube.forEach(function (b) { b.hidden = false; });
    }
  });
}

/* ============================= lucky coin ========================== */
/* `LuckyCoinPostProcessor`: from level 5 a level may hide a coin on one of
 * its balls, worth 10 or 20, at one chance in ten - and half that once the
 * wallet is already fat. Theirs rolls a die; ours draws the same odds out of
 * the level number, so a level either has the coin or it does not and no
 * amount of reloading re-rolls it. Banked once per level for good, so it
 * cannot be farmed by restarting.
 */

function hash32(n) {
  n = (n | 0) + 0x9e3779b9 | 0;
  n = Math.imul(n ^ (n >>> 15), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return (n ^ (n >>> 16)) >>> 0;
}

function luckyPlan(mode, index) {
  if (mode !== 'classic' || index < ECON.LUCKY_FROM) return null;
  if (save.luckyTaken(mode, index)) return null;
  var h = hash32(index + 1);
  var prob = save.coins() >= ECON.LUCKY_LIMIT ? ECON.LUCKY_LIMIT_PROB : ECON.LUCKY_PROB;
  if ((h % 1000) / 1000 >= prob) return null;
  return { coins: ECON.LUCKY_COINS[(h >>> 12) % ECON.LUCKY_COINS.length], seed: h };
}

/** pin the coin to a ball, if this level has one */
function dealLucky() {
  S.lucky = null;
  var plan = luckyPlan(S.mode, S.index);
  if (!plan) return;
  /* never on a face-down ball - a coin nobody can see is not a reward */
  var open = [];
  S.tubes.forEach(function (t) {
    t.forEach(function (b) { if (!b.hidden) open.push(b); });
  });
  if (!open.length) return;
  var b = open[plan.seed % open.length];
  b.coin = plan.coins;
  S.lucky = plan.coins;
}

/** the coin is claimed the moment its ball is picked up and moved */
function collectLucky(moved) {
  for (var i = 0; i < moved.length; i++) {
    var b = moved[i];
    if (!b.coin) continue;
    var worth = b.coin;
    b.coin = 0;
    S.lucky = null;
    if (!save.takeLucky(S.mode, S.index, worth)) return;
    var e = ballEls[b.id], p = e && e._pos;
    sfx('coin');
    buzz([12, 30, 12]);
    if (p) {
      fxSparkle(p.x + S.geo.d / 2, p.y + S.geo.d / 2,
                S.geo.d * 2.2, 10, S.geo.d * 0.4, 620);
    }
    if (e) BS.emit('coinFly', e);
    toast('Lucky coin!  +' + worth);
    BS.emit('lucky', { mode: S.mode, index: S.index, coins: worth });
    return;
  }
}

/* =========================== stuck alerts ========================= */
/* `NoMoveSystem`: when the board has nothing left to give, say so rather than
 * leave the player staring at it. Two different dead ends, which need
 * different words:
 *
 *   nothing legal is left        - a panel; they genuinely cannot go on
 *   moves remain but none of them win - a quiet nudge; they still can move,
 *                                  they just cannot get there from here
 *
 * The second needs the solver, and a search that ran out of budget is not the
 * same as a search that proved there is no way out - only the proof is worth
 * saying out loud, so a capped search stays quiet.
 */

var STUCK_DELAY = 800, DEAD_DELAY = 1600, stuckTimer = null;

function anyMove() {
  for (var i = 0; i < S.tubes.length; i++) {
    for (var j = 0; j < S.tubes.length; j++) if (canMove(i, j)) return true;
  }
  return false;
}

function clearStuck() {
  if (stuckTimer) { clearTimeout(stuckTimer); stuckTimer = null; }
}

function checkStuck() {
  clearStuck();
  if (S.won || !save.alertsOn()) return;
  if (!anyMove()) {
    stuckTimer = setTimeout(function () { showStuck('none'); }, STUCK_DELAY);
    return;
  }
  stuckTimer = setTimeout(function () {
    var plain = solverBoard();
    if (!plain) return;
    var out = solve(plain, S.cap, 60000);
    if (out === null && !solveCapped) showStuck('dead');
  }, DEAD_DELAY);
}

function showStuck(kind) {
  if (S.won || el.win.classList.contains('show')) return;
  if (kind === 'dead') {
    /* they can still move, so do not stop the game - just say it plainly and
       point at the way back */
    toast('No way to finish from here — undo, or add a tube');
    breathe(el.btnUndo);
    breathe(el.btnAdd);
    sfx('deny');
    return;
  }
  el.stuck.classList.add('show');
  sfx('deny');
  buzz([16, 60, 16]);
  BS.emit('stuck', { mode: S.mode, index: S.index });
}

function hideStuck() { el.stuck.classList.remove('show'); }

/* the `BreathHintHandle` of the original, on a button rather than a tube */
function breathe(node) {
  if (!node) return;
  node.classList.remove('breath');
  void node.offsetWidth;
  node.classList.add('breath');
  setTimeout(function () { node.classList.remove('breath'); }, 3200);
}

/* ============================== skip ============================== */
/* Earned, never sold. `SkiplevelConfig` gives one out every four to six wins
 * from level 3, which makes it a mercy for the level that beat you rather
 * than a shortcut anyone can buy their way through the game with.
 */

function skipAllowed() {
  return S.index >= ECON.SKIP_FROM && save.skipReady() && !S.won;
}

/** ask first - skipping cannot be taken back */
function askSkip() {
  if (!skipAllowed()) {
    toast(save.skipReady() ? 'Skip opens at level ' + (ECON.SKIP_FROM + 1)
                           : 'Win a few more levels to earn a skip');
    sfx('deny');
    return;
  }
  hideStuck();
  el.skipAsk.classList.add('show');
  sfx('ui');
}

function doSkip() {
  el.skipAsk.classList.remove('show');
  if (!skipAllowed() || !save.useSkip()) return;
  clearStuck();
  /* A skipped level is opened, not beaten: it unlocks the next one and
     nothing else. No stars, no coins, no personal best - the level is still
     sitting there unfinished for whenever they want another go. */
  save.unlock(S.mode, S.index + 1);
  BS.emit('skipped', { mode: S.mode, index: S.index });
  sfx('whoosh');
  toast('Level skipped');
  nextLevel();
  refreshSkip();
}

function refreshSkip() {
  if (!el.btnSkip) return;
  var on = S.index >= ECON.SKIP_FROM && save.skipReady();
  var was = !el.btnSkip.hidden;
  el.btnSkip.hidden = !on;
  /* it has just appeared - draw the eye to it once, then leave it alone */
  if (on && !was) breathe(el.btnSkip);
}

/* ============================ hard levels ========================= */
/* The original marks levels hard on a fixed cadence - `hard_step: 5` means
 * every fifth level wears the badge whoever is holding the phone. Ours asks
 * the difficulty system instead, so the badge lands on a level that is hard
 * *for this player*: see dda.js. A hard level also gets glassier tubes,
 * because an occasion should look like one.
 */
function paintTier() {
  var t = S.tier | 0;
  el.tubes.classList.toggle('hard', t === 1);
  el.tubes.classList.toggle('superhard', t >= 2);
  if (!el.levelTag) return;
  /* The badge stands where the word "Level" does rather than after it: the
     restart button is pinned to the centre of the bar, and a pill that grows
     to the right walks straight into it. */
  el.levelTag.textContent = t >= 2 ? 'SUPER' : t === 1 ? 'HARD' : '';
  el.levelTag.className = 'levelTag' + (t >= 2 ? ' sh' : '');
  el.levelTag.hidden = !t;
  if (el.levelTag.parentNode) el.levelTag.parentNode.classList.toggle('tagged', !!t);
}

/* ============================== rules ============================== */

function topColor(t) { return t.length ? t[t.length - 1].c : 0; }

function runLen(tube) {
  if (!tube.length) return 0;
  var c = topColor(tube), n = 1;
  /* a face-down ball ends the run whatever colour it turns out to be */
  while (n < tube.length && tube[tube.length - 1 - n].c === c &&
         !tube[tube.length - 1 - n].hidden) n++;
  return n;
}

/* The extra tube from the booster grows a quarter at a time, so capacity is a
   per-tube question now: every tube holds S.cap except that last one, which
   holds however many slots have been paid for. */
function capOf(ti) {
  return (S.extraSlots > 0 && ti === S.tubes.length - 1) ? S.extraSlots : S.cap;
}

function isDone(tube, ti) {
  if (!tube.length) return true;
  if (tube.length !== capOf(ti)) return false;
  var c = tube[0].c;
  return tube.every(function (b) { return b.c === c; });
}

function isWin() { return S.tubes.every(isDone); }

function canMove(from, to) {
  if (from === to) return 0;
  var a = S.tubes[from], b = S.tubes[to];
  if (!a.length) return 0;
  if (b.length >= capOf(to)) return 0;
  if (b.length && topColor(b) !== topColor(a)) return 0;
  return Math.min(runLen(a), capOf(to) - b.length);
}

/* ============================== moving ============================= */

function performMove(from, to, n, record) {
  var g = S.geo, d = g.d;
  var a = S.tubes[from], b = S.tubes[to];
  var fromPos = a.slice(a.length - n).map(function (ball, k) {
    var e = ballEls[ball.id];
    return (e && e._pos) || slotPos(from, a.length - n + k);
  });
  var colour = col(a[a.length - 1].c);

  var moved = a.splice(a.length - n, n);
  for (var i = 0; i < moved.length; i++) b.push(moved[i]);
  /* before the paint below, so the ball underneath starts showing itself as
     the one on top lifts off rather than after it lands */
  revealTops();
  collectLucky(moved);
  if (record) {
    S.history.push({ from: from, to: to, n: n });
    S.moves++;
    S.sinceClear++;
  }

  /* little puff at the mouth of the tube we left */
  var mo = tubeMouth(from);
  fxRing(mo.x, mo.y, d * 0.42, d * 1.05, 'rgba(255,255,255,.5)', 340, 2);
  sfx('whoosh');

  var apexY = Math.min(g.pos[from].y, g.pos[to].y) - g.d * 1.05;
  var skip = {};
  moved.forEach(function (ball) { skip[ball.id] = 1; });
  paint({ skip: skip });

  var base = b.length - moved.length;
  var last = 0, dur = 0;
  moved.forEach(function (ball, k) {
    var delay = k * 70;
    var slot = base + k;
    last = delay;
    dur = flyBall(ballEls[ball.id], fromPos[k], slotPos(to, slot), apexY, delay,
      function () { landFx(to, slot, colour); });
  });

  BS.emit('moved', { from: from, to: to, n: n });

  var full = isDone(S.tubes[to], to) && S.tubes[to].length;
  setTimeout(function () {
    if (full) { S.combo++; celebrate(to); }
    if (isWin() && !S.won) { S.won = true; setTimeout(win, full ? 700 : 320); }
    else checkStuck();
  }, last + dur * 0.9);
}

/** impact feedback where a ball touches down */
function landFx(ti, slot, colour) {
  var d = S.geo.d;
  var p = slotPos(ti, slot);
  var cx = p.x + d / 2, cy = p.y + d * 0.9;
  bump(ti);
  fxRing(cx, cy, d * 0.34, d * 1.0, colour.a, 300, 2);
  fxBurst(cx, cy, colour.b, 6, d * 0.62, d * 0.12, 340, d * 0.1);
  sfx('drop', slot);
  buzz(9);
}

function bump(ti) {
  var t = el.tubes.children[ti]; if (!t) return;
  t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump');
}

/* The pool above the rest, for a tube that took a genuinely long time. It has
   to sound rare - if every tube got this line the line would stop landing. */
var EPIC_WON = ['UNSTOPPABLE!', 'ABSOLUTE LEGEND!', 'YOU NEVER GAVE UP!',
                'THAT WAS BRUTAL!', 'MASTERCLASS!', 'WHAT A FIGHT!'];

var HARD_WON = ['So stubborn!', 'Top of the top!', 'On fire!', 'Outstanding!',
                'Masterful!', 'Unbelievable!', 'That was sweet!'];
var NICE_ONE = ['Nice!', 'Ace!', 'Great!', 'Sweet!', 'Super!'];

function pick(a) { return a[(Math.random() * a.length) | 0]; }

/** a tube just got filled with one colour - go big */
function celebrate(ti) {
  var tube = S.tubes[ti], d = S.geo.d, p = S.geo.pos[ti];
  var colour = col(tube[0].c);
  var cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  var top = p.y;

  /* How hard was this one to earn? Moves and time both count, because a long
     think and a long grind feel the same from the player's side: it has been
     ages since anything good happened. The top tier is meant to be rare. */
  var effort = S.sinceClear;
  var waited = Date.now() - S.lastClear;
  var tier = (effort >= 24 || waited > 55000) ? 3
           : (effort >= 13 || waited > 26000) ? 2
           : (effort >= 6  || waited > 12000) ? 1 : 0;
  S.sinceClear = 0;
  S.lastClear = Date.now();

  var t = el.tubes.children[ti];
  if (t) { t.classList.remove('cheer'); void t.offsetWidth; t.classList.add('cheer'); }

  var reach = Math.min(window.innerWidth, window.innerHeight);
  var big = [1.1, 1.6, 2.0, 2.6][tier];

  duck(big);
  sfx('lid');
  setTimeout(function () { sfx('complete', S.combo + tier); }, 190);
  buzz(tier === 3 ? [22, 40, 22, 40, 22, 40, 46]
     : tier === 2 ? [18, 40, 18, 40, 34] : [14, 40, 20]);

  fxRing(cx, top + d * 0.2, d * 0.5, d * (2.9 + tier * 0.5), colour.a, 620, 4);
  fxRing(cx, cy, d * 0.7, d * (2.4 + tier * 0.4), 'rgba(255,255,255,.7)', 520, 2);
  fxBurst(cx, cy, colour.b, 14 + tier * 7, d * (2.1 + tier * 0.5), d * 0.2, 720, d * 0.5);
  fxBurst(cx, cy, colour.a, 9 + tier * 4, d * (1.5 + tier * 0.35), d * 0.15, 620, d * 0.3);
  fxSparkle(cx, cy, d * (2.2 + tier * 0.5), 8 + tier * 4, d * 0.42, 560);
  fxPop(cx, top - d * 0.5,
        tier === 3 ? '👑' : tier === 2 ? '🏆' : (S.combo > 1 ? '🌟' : '⭐'),
        d * (0.9 + tier * 0.12), 900);

  /* The longer the drought, the louder the applause. Tier 3 is the one the
     player waited a long time for, so it gets the full treatment - the same
     confetti the end of a level gets. */
  if (tier >= 1) {
    var sky = toSky(cx, top);
    setTimeout(function () {
      burst(sky.x, sky.y - d, colour, [0, 22, 34, 50][tier], reach * [0, 0.2, 0.3, 0.44][tier],
            [0, 1000, 1200, 1500][tier]);
    }, 150);
  }

  if (tier === 3) {
    fireworksShow(7, 300);
    confetti();
    banner(pick(EPIC_WON), Math.min(54, window.innerWidth * 0.132), 2300);
    setTimeout(function () {
      toast(effort + ' moves of grinding — and you cracked it!');
    }, 820);
    /* one more volley once the first has cleared, so it really does feel long */
    setTimeout(function () { fireworksShow(4, 260); }, 900);
  } else if (tier === 2) {
    fireworksShow(4, 260);
    banner(pick(HARD_WON), Math.min(46, window.innerWidth * 0.11), 1900);
    setTimeout(function () { toast(effort + ' moves to crack it — superb!'); }, 700);
  } else if (tier === 1) {
    banner(pick(NICE_ONE), Math.min(34, window.innerWidth * 0.085), 1400);
  }
  /* a combo used to raise a "Nice! ×3" toast here - it fired on ordinary play
     and read as noise, so clearing tubes back to back is now celebrated by the
     sound and the sparkles alone */

  if (REDUCED) return;
  /* the balls take a happy little hop, bottom-up */
  tube.forEach(function (ball, k) {
    var e = ballEls[ball.id]; if (!e || !e.animate) return;
    var q = e._pos;
    e.animate([
      { transform: tf(q.x, q.y, 1, 1) },
      { transform: tf(q.x, q.y - d * (0.42 + tier * 0.1), 0.95, 1.06), offset: 0.38, easing: 'ease-out' },
      { transform: tf(q.x, q.y, 1.16, 0.84), offset: 0.74, easing: 'ease-in' },
      { transform: tf(q.x, q.y - d * 0.06, 0.98, 1.03), offset: 0.88 },
      { transform: tf(q.x, q.y, 1, 1) }
    ], { duration: 520, delay: (tube.length - 1 - k) * 58, easing: 'ease-out' });
  });
}

/** balls drop in from above when a level starts */
function dealIn() {
  if (REDUCED) return;
  var d = S.geo.d;
  S.tubes.forEach(function (tube, ti) {
    tube.forEach(function (ball, bi) {
      var e = ballEls[ball.id]; if (!e || !e.animate) return;
      var p = e._pos;
      e.animate([
        { transform: tf(p.x, p.y - d * 7, 1, 1), opacity: 0 },
        { transform: tf(p.x, p.y, 1.16, 0.84), offset: 0.72, opacity: 1,
          easing: 'cubic-bezier(.4,0,.7,1)' },
        { transform: tf(p.x, p.y, 0.96, 1.05), offset: 0.87, easing: 'ease-in-out' },
        { transform: tf(p.x, p.y, 1, 1) }
      ], { duration: 460, delay: 30 + (ti * 3 + bi) * 15, fill: 'backwards' });
    });
  });
}

/* =========================== auto-import =========================== */
/* The original calls this `AutoImportSystem`, gated on a level number from
 * its server (`setting_imp_level`): tap a tube and the ball takes itself to
 * the right place, so a first-timer cannot make an illegal move while they
 * are still working out that a move is two taps. Where the choice is real -
 * two different tubes would both accept the ball - it stops and lets them
 * pick, which is their `TwoSelectOne`.
 */

/* Off. It undercut the walkthrough standing right next to it: the hand spends
 * two levels teaching that a move is tap the tube you are taking from, then
 * tap the tube you are putting into - and then the ball started leaving on the
 * first tap, so the second half of the lesson never happened. A move is two
 * taps here, from the first level to the last.
 *
 * The machinery stays because it is small and tested; raising this number
 * turns it back on for that many levels from the start.
 */
var AUTO_LEVELS = BS.AUTO_LEVELS = 0;

function autoImportOn() {
  /* the walkthrough is busy teaching the two-tap move; do not undercut it */
  if (BS.tutorial && BS.tutorial.active()) return false;
  return S.mode === 'classic' && S.index < AUTO_LEVELS;
}

/**
 * Where tube `i` would pour if the player did not have to say. Returns -1
 * when the answer is genuinely up to them.
 */
function soleTarget(i) {
  var match = -1, matches = 0, empty = -1;
  for (var j = 0; j < S.tubes.length; j++) {
    if (!canMove(i, j)) continue;
    if (S.tubes[j].length) { matches++; match = j; }
    else if (empty === -1) empty = j;
  }
  /* two tubes of the same colour could both take it - that is a real choice */
  if (matches > 1) return -1;
  if (matches === 1) return match;
  /* no colour to land on: every empty tube is the same move, so just go */
  return empty;
}

/* ============================== input ============================== */

el.tubes.addEventListener('click', function (ev) {
  var t = ev.target.closest('.tube');
  if (!t || S.won) return;
  tapTube(+t.dataset.i);
});

function tapTube(i) {
  clearHint();
  clearStuck();
  var d = S.geo.d;

  if (S.sel === -1) {
    if (!S.tubes[i].length || isDone(S.tubes[i], i)) { nudge(i); sfx('deny'); return; }
    if (autoImportOn()) {
      var only = soleTarget(i);
      if (only !== -1) {
        sfx('pick', S.tubes[i].length);
        buzz(7);
        performMove(i, only, canMove(i, only), true);
        return;
      }
    }
    S.sel = i;
    var run = runLen(S.tubes[i]);
    var mouth = tubeMouth(i);
    var c = col(topColor(S.tubes[i]));
    fxRing(mouth.x, mouth.y, d * 0.4, d * 1.15, c.a, 380, 2);
    fxSparkle(mouth.x, mouth.y - d * 0.4, d * 1.1, 3, d * 0.3, 460);
    sfx('pick', S.tubes[i].length);
    buzz(7);
    paint();
    BS.emit('picked', i);
    return;
  }
  /* put it back down; -1 says nothing is held, which the walkthrough reads
     as its cue to point again */
  if (S.sel === i) { S.sel = -1; sfx('ui'); paint(); BS.emit('picked', -1); return; }

  var n = canMove(S.sel, i);
  if (!n) {
    nudge(i);
    sfx('deny');
    S.sel = -1;
    paint();
    return;
  }
  var from = S.sel;
  S.sel = -1;
  performMove(from, i, n, true);
}

function nudge(i) {
  var node = el.tubes.children[i]; if (!node) return;
  node.classList.remove('bad'); void node.offsetWidth; node.classList.add('bad');
  buzz([8, 30, 8]);
}

/* ============================= boosters ============================ */
/* Same shape as the original APK: a free allowance that resets every level,
   then the bag, and when the bag is empty the button turns into a price. */

function freeLeft(id) {
  return Math.max(0, (ECON.FREE_PER_LEVEL[id] | 0) - (S.freeUsed[id] | 0));
}

/** what pressing this booster would cost right now */
function boosterState(id) {
  if (freeLeft(id) > 0) return { kind: 'free', n: freeLeft(id) };
  if (save.own(id) > 0) return { kind: 'own', n: save.own(id) };
  return { kind: 'buy', n: 0, price: ECON.PRICE[id] | 0 };
}

/**
 * Spend one use. Returns true if the booster may fire. With nothing free and
 * nothing left in the bag it charges the coin price instead; when that cannot
 * be paid it says so and returns false.
 */
function takeBooster(id) {
  if (freeLeft(id) > 0) { S.freeUsed[id]++; refreshBoosters(); BS.emit('boosterUsed', id); return true; }
  if (save.useBooster(id)) { refreshBoosters(); BS.emit('boosterUsed', id); return true; }
  /* nothing free and nothing in the bag: the button is showing a price, so
     honour it and charge for this one use */
  var price = ECON.PRICE[id] | 0;
  if (save.spend(price)) {
    refreshBoosters();
    BS.emit('boosterUsed', id);
    return true;
  }
  sfx('deny');
  toast('Need ' + price + ' coins for ' +
        ({ undo: 'an undo', tube: 'an extra tube', hint: 'a hint' }[id]));
  return false;
}

/** paint the three booster buttons from the bag */
function refreshBoosters() {
  [['undo', el.btnUndo, null],
   ['tube', el.btnAdd, el.priceTube],
   ['hint', el.btnHint, el.priceHint]].forEach(function (row) {
    var id = row[0], btn = row[1], tag = row[2];
    if (!btn) return;
    var st = boosterState(id);
    var badge = btn.querySelector('.price');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'price';
      btn.appendChild(badge);
    }
    /* a count rides in the corner of the icon; a price sits under it, where
       it reads as a label for the button rather than a badge on it */
    var cost = btn.querySelector('.cost');
    if (!cost) {
      cost = document.createElement('span');
      cost.className = 'cost';
      btn.appendChild(cost);
    }
    btn.classList.toggle('free', st.kind === 'free');
    btn.classList.toggle('buy', st.kind === 'buy');
    if (st.kind === 'buy') cost.innerHTML = '<i class="coin"></i>' + st.price;
    else                   badge.textContent = st.n;
  });
  el.btnUndo.disabled = !S.history.length;
  if (el.btnAdd) el.btnAdd.disabled = S.extraSlots >= S.cap;
}

BS.on('bag', refreshBoosters);
BS.on('coins', function () { if (S.geo) refreshBoosters(); });

/* ============================== actions ============================= */

function undo() {
  if (!S.history.length) return;
  if (!takeBooster('undo')) return;
  var m = S.history.pop();
  S.moves = Math.max(0, S.moves - 1);
  S.won = false;
  S.sel = -1;
  clearHint();
  sfx('ui');
  performMove(m.to, m.from, m.n, false);
}

/* One press buys a quarter of a tube, not a whole one. Four presses fill it
   out, and that is the ceiling for the level - an extra tube is meant to be a
   way out of a jam, not a way to widen the puzzle. */
function addTube() {
  if (S.extraSlots >= S.cap) { toast('The extra tube is already full'); sfx('deny'); return; }
  if (!takeBooster('tube')) return;
  var first = S.extraSlots === 0;
  S.extraSlots++;
  if (first) S.tubes.push([]);
  S.sel = -1;
  clearHint();
  if (first) buildTubes();
  layout();
  paint();
  var idx = S.tubes.length - 1;
  var node = el.tubes.children[idx];
  if (node) node.classList.add('cheer');
  var p = S.geo.pos[idx], d = S.geo.d;
  if (p) {
    fxSparkle(p.x + p.w / 2, p.y + p.h / 2, d * 2, 7, d * 0.36, 520);
    fxPop(p.x + p.w / 2, p.y - d * 0.4, '✨', d * 0.8, 780);
  }
  sfx('complete', 0);
  toast(S.extraSlots >= S.cap ? 'Extra tube full'
                              : 'Extra tube ' + S.extraSlots + '/' + S.cap);
}

/* ------------------------------ hint -------------------------------- */

var hintTimer = null;

/* The solver assumes every tube holds S.cap, which a part-grown extra tube
   does not. While it is empty it can simply be left out - it is the last
   index, so the others keep their numbers. With balls in it there is no
   honest board to hand over, so we do not guess. */
function solverBoard() {
  var plain = S.tubes.map(function (t) {
    return t.map(function (b) { return b.c; });
  });
  if (S.extraSlots > 0 && S.extraSlots < S.cap) {
    if (plain[plain.length - 1].length) return null;
    plain.pop();
  }
  return plain;
}

function clearHint() {
  var nodes = el.tubes.children;
  for (var i = 0; i < nodes.length; i++) nodes[i].classList.remove('hintFrom', 'hintTo');
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
}

function hint() {
  clearHint();
  if (S.won) return;
  if (!takeBooster('hint')) return;
  var plain = solverBoard();
  var path = plain && solve(plain, S.cap, 150000);
  if (!path) {
    /* nothing to point at - give the charge back */
    if (S.freeUsed.hint > 0) S.freeUsed.hint--; else save.addBooster('hint', 1);
    refreshBoosters();
    toast('Stuck — undo, or add a tube');
    sfx('deny');
    return;
  }
  var m = path[0];
  S.sel = -1;
  paint();
  el.tubes.children[m.i].classList.add('hintFrom');
  el.tubes.children[m.j].classList.add('hintTo');
  sfx('ui');
  hintTimer = setTimeout(clearHint, 3000);
}

/** DFS solver - returns the list of moves or null */
var solveCapped = false;

function solve(start, cap, nodeCap) {
  var seen = Object.create(null), nodes = 0, path = [];
  solveCapped = false;

  function key(st) {
    var a = [], i;
    for (i = 0; i < st.length; i++) a.push(st[i].join(','));
    a.sort();
    return a.join('|');
  }
  function finished(st) {
    for (var i = 0; i < st.length; i++) {
      var t = st[i];
      if (!t.length) continue;
      if (t.length !== cap) return false;
      for (var j = 1; j < t.length; j++) if (t[j] !== t[0]) return false;
    }
    return true;
  }
  function dfs(st) {
    if (++nodes > nodeCap) { solveCapped = true; return false; }
    if (finished(st)) return true;
    var k = key(st);
    if (seen[k]) return false;
    seen[k] = 1;

    var moves = [], i, j;
    for (i = 0; i < st.length; i++) {
      var a = st[i];
      if (!a.length) continue;
      var c = a[a.length - 1], run = 1;
      while (run < a.length && a[a.length - 1 - run] === c) run++;
      if (run === a.length && a.length === cap) continue;
      for (j = 0; j < st.length; j++) {
        if (i === j) continue;
        var b = st[j];
        if (b.length >= cap) continue;
        if (b.length && b[b.length - 1] !== c) continue;
        if (!b.length && run === a.length) continue;
        var cnt = Math.min(run, cap - b.length);
        var score = 0;
        if (b.length) {
          var pure = true;
          for (var q = 0; q < b.length; q++) if (b[q] !== c) { pure = false; break; }
          if (pure) score += 10;
          if (pure && b.length + cnt === cap) score += 30;
        } else score -= 6;
        if (cnt === run) score += 4;
        if (run === a.length) score += 3;
        moves.push({ i: i, j: j, cnt: cnt, s: score });
      }
    }
    moves.sort(function (x, y) { return y.s - x.s; });

    for (var m = 0; m < moves.length; m++) {
      var mv = moves[m];
      var st2 = new Array(st.length);
      for (var t = 0; t < st.length; t++) st2[t] = st[t].slice();
      var taken = st2[mv.i].splice(st2[mv.i].length - mv.cnt, mv.cnt);
      for (var u = 0; u < taken.length; u++) st2[mv.j].push(taken[u]);
      path.push(mv);
      if (dfs(st2)) return true;
      path.pop();
    }
    return false;
  }

  try { return dfs(start.map(function (t) { return t.slice(); })) ? path : null; }
  catch (e) { return null; }
}

/* ============================== win flow ============================ */

function win() {
  duck(3.4);
  sfx('win');
  buzz([14, 60, 14, 60, 30]);

  /* the grand finale goes off straight away, the panel follows */
  fireworksShow(11, 190);
  confetti();
  banner('COMPLETE!', Math.min(52, window.innerWidth * 0.125), 1500);

  /* Face down or not, a level is scored the same way: against the number of
     moves the original's own solution took. Nothing is discounted for playing
     blind - it is the same puzzle underneath and it counts the same. */
  var par = parOf(S.mode, S.src);
  var ref = par || Math.max(1, S.moves);
  var stars = S.moves <= ref * 1.10 ? 3 : S.moves <= ref * 1.45 ? 2 : 1;

  var res = save.finish(S.mode, S.index, S.moves, stars);
  save.skipWin();          /* four to six wins buys the next skip */
  BS.emit('won', { mode: S.mode, index: S.index, moves: S.moves,
                   par: par, stars: stars, question: !!S.question });

  setTimeout(function () {
    showWinPanel(stars, res);
  }, 950);
}

var PRAISE = [[], ['Level cleared!', 'Done!', 'You got through!'],
                  ['Well played!', 'Pretty good!', 'Nicely done!'],
                  ['Perfect!', 'Nothing to fault!', 'Flawless!']];

function showWinPanel(stars, res) {
  el.winLevel.textContent = 'Level ' + (S.index + 1);

  /* The reward line only shows on a first clear - a replay pays nothing and
     saying "+0" would read as a bug. */
  el.winReward.classList.toggle('on', res.coins > 0);
  el.winCoins.textContent = '+' + res.coins;

  /* Stars are still scored and still saved - they are only off the panel for
     now, so this lands on an empty list and simply does nothing. */
  var st = el.win.querySelectorAll('.star');
  var shown = Math.min(stars, st.length);
  var i;
  for (i = 0; i < st.length; i++) st[i].classList.remove('on');
  el.winPraise.classList.remove('on');
  el.winPraise.textContent = pick(PRAISE[stars]);

  el.win.classList.add('show');

  for (i = 0; i < shown; i++) {
    (function (k) {
      setTimeout(function () {
        st[k].classList.add('on');
        sfx('star', k);
        var r = st[k].getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2,
              { a: '#ffe27a', b: '#ffab2e' }, 12, 90, 700);
      }, 260 + k * 260);
    })(i);
  }
  setTimeout(function () {
    el.winPraise.classList.add('on');
    if (res.coins > 0) {
      el.winReward.classList.add('pop');
      sfx('coin');
      BS.emit('coinFly', el.winReward);
    }
    if (stars === 3) { fireworksShow(4, 220); banner('PERFECT!', 40, 1400); }
  }, 260 + stars * 260);
}

function confetti() {
  if (REDUCED) return;
  var host = document.getElementById('confetti');
  if (!host) {
    host = document.createElement('div');
    host.id = 'confetti';
    document.body.appendChild(host);
  }
  host.innerHTML = '';
  var W = window.innerWidth, H = window.innerHeight;
  for (var i = 0; i < 70; i++) {
    var p = document.createElement('i');
    p.style.background = col(1 + (i % 12)).b;
    p.style.left = (Math.random() * W) + 'px';
    p.style.width = (5 + Math.random() * 7) + 'px';
    p.style.height = (8 + Math.random() * 10) + 'px';
    if (Math.random() < 0.3) p.style.borderRadius = '50%';
    host.appendChild(p);
    if (!p.animate) continue;
    p.animate([
      { transform: 'translateY(-40px) rotate(0deg)', opacity: 1 },
      { transform: 'translateY(' + (H + 70) + 'px) translateX(' +
                   ((Math.random() - 0.5) * 180) + 'px) rotate(' +
                   (360 + Math.random() * 900) + 'deg)', opacity: 0.9 }
    ], { duration: 1500 + Math.random() * 1400, delay: Math.random() * 420,
         easing: 'cubic-bezier(.25,.6,.4,1)', fill: 'forwards' });
  }
  setTimeout(function () { host.innerHTML = ''; }, 3600);
}

function nextLevel() {
  el.win.classList.remove('show');
  var last = PACKS[S.mode].data.length - 1;
  if (S.index >= last) { toast('You have finished this mode!'); BS.emit('goHome'); return; }
  var i = S.index + 1;
  setCurrent(S.mode, i);
  sfx('ui');
  loadLevel(S.mode, i);
}

/* ============================== toast =============================== */

var toastTimer = null;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 1600);
}

function buzz(pattern) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
}

/* ============================== wiring ============================= */

document.getElementById('btnUndo').onclick    = undo;
/* Restarting is free for now - it only asks, because a mis-tap would throw
   away the whole board. To charge for it again, check and spend
   ECON.REPLAY_COST here and name the price in the dialog. */
var elAsk = document.getElementById('askOverlay');

function askRestart() {
  elAsk.classList.add('show');
  sfx('ui');
}
document.getElementById('btnRestart').onclick = askRestart;
document.getElementById('askYes').onclick = function () {
  elAsk.classList.remove('show');
  sfx('ui');
  reloadLevel();
};
document.getElementById('btnAdd').onclick     = addTube;
document.getElementById('btnHint').onclick    = hint;
document.getElementById('btnNext').onclick    = nextLevel;
if (el.btnSkip) el.btnSkip.onclick = askSkip;
bindById('skipYes', doSkip);
bindById('stuckOk', function () { sfx('ui'); hideStuck(); });

function bindById(id, fn) {
  var n = document.getElementById(id);
  if (n) n.onclick = fn;
}
document.getElementById('btnReplay').onclick  = function () {
  el.win.classList.remove('show'); sfx('ui'); reloadLevel();
};
document.getElementById('btnHome').onclick = function () {
  el.win.classList.remove('show'); sfx('ui'); BS.emit('goHome');
};

function toggleSound() {
  var anyOn = AU.sfxOn || AU.musicOn;
  AU.sfxOn = AU.musicOn = !anyOn;
  applyAudioPrefs(true);
  if (AU.sfxOn) sfx('ui');
}
if (el.sound) el.sound.onclick = toggleSound;
el.optSfx.onchange = function () {
  AU.sfxOn = el.optSfx.checked; applyAudioPrefs(true); if (AU.sfxOn) sfx('pick', 2);
};
el.optMusic.onchange = function () {
  AU.musicOn = el.optMusic.checked; applyAudioPrefs(true);
};

document.addEventListener('keydown', function (e) {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'z' || e.key === 'Z') undo();
  if (e.key === 'r' || e.key === 'R') askRestart();
  if (e.key === 'h' || e.key === 'H') hint();
  if (e.key === 'm' || e.key === 'M') toggleSound();
  if (e.key === 'Escape') { S.sel = -1; clearHint(); paint(); }
});

/* browsers only allow audio after the first real interaction */
['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
  window.addEventListener(ev, function once() {
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (e2) {
      window.removeEventListener(e2, once);
    });
    resumeAudio();
    applyAudioPrefs(false);
  }, { passive: true });
});

document.addEventListener('visibilitychange', function () {
  if (!AU.ready) return;
  if (document.hidden) { musicStop(); AU.ctx.suspend(); }
  else { AU.ctx.resume(); if (AU.musicOn) musicStart(); }
});

var rTimer = null;
window.addEventListener('resize', function () {
  clearTimeout(rTimer);
  rTimer = setTimeout(function () { layout(); paint({ instant: true }); }, 80);
});

/* ============================ public api =========================== */

applyAudioPrefs(false);

BS.board = {
  /** how many levels a mode has */
  count: function (mode) { return PACKS[mode].data.length; },
  name: function (mode) { return PACKS[mode].name; },
  par: parOf,
  /** open a level; `index` is 0-based */
  start: function (mode, index) {
    index = Math.min(Math.max(0, index | 0), PACKS[mode].data.length - 1);
    setCurrent(mode, index);
    el.win.classList.remove('show');
    loadLevel(mode, index);
  },
  /** the board only knows its size once its screen is actually visible */
  relayout: function () { if (S.geo) { layout(); paint({ instant: true }); } },
  mode: function () { return S.mode; },
  index: function () { return S.index; },
  /** the puzzle the current level was dealt; differs when swapped */
  src: function () { return S.src; },
  colorsOf: colorsOf,
  ready: function () { return !!S.geo; },
  sfx: sfx,
  toast: toast,
  /** the board as plain colour arrays, bottom-up; for tests */
  state: function () {
    return S.tubes.map(function (t) { return t.map(function (b) { return b.c; }); });
  },
  /** how hard this level is for this player: 0 normal, 1 hard, 2 super hard */
  tier: function () { return S.tier | 0; },
  /** the lucky coin waiting on the board, in coins, or null */
  lucky: function () { return S.lucky; },
  /** the dead-end alerts */
  stuck: {
    anyMove: anyMove,
    check: checkStuck,
    show: showStuck,
    hide: hideStuck,
    open: function () { return el.stuck.classList.contains('show'); }
  },
  /** the earned skip */
  skip: {
    allowed: skipAllowed,
    ask: askSkip,
    take: doSkip
  },
  /** levels dealt face down - see the face-down section above */
  question: {
    on: function () { return !!S.question; },
    /** whether the level at this 0-based index is one of them */
    at: questionLevel,
    /** which balls are still face down, bottom-up per tube; for tests */
    hidden: function () {
      return S.tubes.map(function (t) {
        return t.map(function (b) { return !!b.hidden; });
      });
    }
  },
  /** one-tap play, on for the opening levels only */
  autoImport: {
    on: function () { return autoImportOn(); },
    target: soleTarget,
    levels: function () { return AUTO_LEVELS; },
    /** test seam: widen or switch off the level gate */
    setLevels: function (n) { AUTO_LEVELS = BS.AUTO_LEVELS = n | 0; }
  },
  /** the solver's next move from where the board stands, or null */
  nextMove: function () {
    var plain = solverBoard();
    var path = plain && solve(plain, S.cap, 150000);
    return path && path.length ? { from: path[0].i, to: path[0].j } : null;
  },
  /* The whole way out, not just the next step. Asking again after every move
     is not the same thing: the search returns *a* solution, not the same one
     twice, so a caller that re-plans each move can be handed a route that
     walks back over the move it just made. Anything driving the board to the
     end - the tests do - wants one plan and should stick to it.

     A move of several balls is the same as that many single moves, so a plan
     stays walkable even where the board only parts with one ball at a time,
     which is what a face-down tube does. */
  plan: function () {
    var plain = solverBoard();
    var path = plain && solve(plain, S.cap, 150000);
    return path ? path.map(function (m) {
      return { from: m.i, to: m.j, n: m.cnt };
    }) : null;
  },
  /** screen rectangle of tube #i, for the walkthrough spotlight */
  tubeRect: function (i) {
    var t = el.tubes.children[i];
    return t ? t.getBoundingClientRect() : null;
  },
  /* Where the top ball of tube #i comes to rest, in screen pixels - or the
     slot a ball would drop into when the tube is empty. Read off the geometry
     rather than the ball's own box: at the moment the walkthrough asks, the
     balls are often still falling into place from the level's opening. */
  slotRect: function (i) {
    var tube = S.tubes[i];
    if (!S.geo || !tube) return null;
    var box = el.balls.getBoundingClientRect();
    var p = slotPos(i, Math.max(0, tube.length - 1)), d = S.geo.d;
    return { left: box.left + p.x, top: box.top + p.y, width: d, height: d,
             right: box.left + p.x + d, bottom: box.top + p.y + d };
  },
  tubeCount: function () { return S.tubes.length; },
  moves: function () { return S.moves; },
  banner: banner,
  fireworks: fireworksShow,
  burst: burst,
  audio: {
    resume: resumeAudio,
    apply: applyAudioPrefs,
    /** the host page's mute; outranks the in-game toggle both ways */
    setHostMute: function (v) {
      v = !!v;
      if (v === AU.hostMute) return;
      AU.hostMute = v;
      applyAudioPrefs(false);
    },
    get hostMute() { return AU.hostMute; },
    get sfxOn() { return AU.sfxOn; },
    set sfxOn(v) { AU.sfxOn = v; },
    get musicOn() { return AU.musicOn; },
    set musicOn(v) { AU.musicOn = v; }
  }
};

BS.emit('boardReady');

})();
