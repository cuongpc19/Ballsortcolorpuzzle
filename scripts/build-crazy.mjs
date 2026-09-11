// Build the CrazyGames bundle, and check the things a checklist would
// otherwise be trusted to remember.
//
//   node scripts/build-crazy.mjs
//
// There is no bundler here on purpose - the game is plain HTML, CSS and JS and
// loads in the order index.html lists. So the "build" is a copy with one edit:
// the host SDK layer is spliced in ahead of every other script. The checks at
// the end are the point. Every one of them is a mistake that is cheap to catch
// here and expensive to discover at the upload screen.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync,
         statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(ROOT, 'dist');

/* What the game is made of. Anything not listed does not ship - an allow-list
   rather than a deny-list, because the deny-list is the one that goes stale the
   day somebody adds a folder. */
/* ⚠ `public/` carries the privacy policy, and the policy has to be *in* the
   bundle: the host bans outbound links, so Settings -> Privacy reads the copy
   that shipped rather than opening theirs. */
const SHIP_DIRS = ['src', 'data', 'assets', 'public'];
const SHIP_FILES = ['index.html', 'style.css'];

/* ⚠ Never ship a dev tool. A reviewer finding the test harness is the same
   mistake as shipping a level editor, and `tests/` sits right next to `src/`. */
const NEVER = ['tests', 'scripts', 'Manythings', 'node_modules', '.git'];

const say = (s) => console.log(s);
const mb = (n) => (n / 1024 / 1024).toFixed(2) + ' MB';

/* ─────────────────────────────── copy ─────────────────────────────── */

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

for (const d of SHIP_DIRS) {
  const from = join(ROOT, d);
  if (!existsSync(from)) continue;
  cpSync(from, join(DIST, d), { recursive: true });
}
for (const f of SHIP_FILES) cpSync(join(ROOT, f), join(DIST, f));

/* ───────────────────────── splice in the SDK ──────────────────────── */

/* ⚠ Ahead of save.js, not after it. save.js captures `BS.store` at parse time,
   so a platform layer that loads later installs a store nothing is using and
   every write goes to the browser instead of the player's cloud save. */
const htmlPath = join(DIST, 'index.html');
let html = readFileSync(htmlPath, 'utf8');
const anchor = '<script src="src/save.js"></script>';
if (!html.includes(anchor)) {
  console.error(`✗ khong tim thay ${anchor} trong index.html - da doi thu tu script?`);
  process.exit(1);
}
html = html.replace(anchor, '<script src="src/platform-crazy.js"></script>\n' + anchor);

/* ⚠ The playtest link unlocks all 17,696 levels. Harmless on a build only the
   author opens, a cheat code on a hosted one - and a reviewer who finds it has
   found a level skip. The tag goes, and so does the file. */
html = html.replace(/[ \t]*<script src="src\/playtest\.js"><\/script>\r?\n/, '');
writeFileSync(htmlPath, html);
rmSync(join(DIST, 'src', 'playtest.js'), { force: true });

/* ─────────────────────────────── checks ───────────────────────────── */

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(p);
  }
})(DIST);

const bytes = files.reduce((a, f) => a + statSync(f).size, 0);
const rel = (f) => relative(DIST, f).split(sep).join('/');

const problems = [];

/* Absolute paths break inside the host's iframe: it serves the game from a
   sub-path, so a leading slash walks out of the game and into their site. */
const absolute = (html.match(/(?:src|href)="\/[^"]*"/g) ?? []);
if (absolute.length) problems.push(`duong dan tuyet doi trong index.html: ${absolute.join(' ')}`);

/* The SDK layer has to actually be in there - proved, not assumed. Only the
   text files are read: the images are a megabyte of noise that cannot contain
   a URL, and decoding them as UTF-8 to find out would be the slow way to learn
   nothing. */
const TEXT = /\.(js|html|css|json|txt|md)$/i;
const sdkFiles = files.filter((f) => TEXT.test(f) &&
  readFileSync(f, 'utf8').includes('crazygames.com'));
if (!sdkFiles.length) problems.push('khong co file nao goi SDK CrazyGames');

/* ...and it has to be wired into the page, not merely sitting in the folder. */
if (!html.includes('src/platform-crazy.js')) problems.push('index.html khong nap platform-crazy.js');

/* The policy is a submission requirement and an in-game screen; missing, it
   fails review twice over. */
if (!existsSync(join(DIST, 'public', 'privacy.html'))) {
  problems.push('thieu public/privacy.html - form nop va man Cai dat deu can no');
}

/* ...and the playtest link must be gone from both the folder and the page. */
if (existsSync(join(DIST, 'src', 'playtest.js'))) problems.push('playtest.js lot vao dist');
if (html.includes('playtest.js')) problems.push('index.html van nap playtest.js');

/* No dev tool may have hitched a ride. */
for (const bad of NEVER) {
  if (existsSync(join(DIST, bad))) problems.push(`${bad}/ lot vao dist`);
}

/* Their hard limits. 20 MB is not a limit but a gate: over it the game is not
   eligible for the mobile home page, which is most of the traffic. */
if (files.length > 1500) problems.push(`${files.length} file - tran la 1500`);
if (bytes > 250 * 1024 * 1024) problems.push(`${mb(bytes)} - tran la 250 MB`);

/* Every local file index.html asks for must exist in the bundle. A renamed
   asset is a 404 the reviewer sees and nobody else does. */
for (const m of html.matchAll(/(?:src|href)="(?!https?:|data:|#)([^"]+)"/g)) {
  const want = m[1].split('?')[0];
  if (!existsSync(join(DIST, want))) problems.push(`index.html tro toi ${want} nhung khong co trong dist`);
}

say('');
say(`Ban "crazy": ${files.length} file · ${mb(bytes)}`);
say(bytes <= 20 * 1024 * 1024
  ? '  ✓ duoi 20 MB - du dieu kien len trang chu ban mobile'
  : '  ⚠ tren 20 MB - mat suat trang chu mobile');
say(absolute.length ? '  ⚠ co duong dan tuyet doi' : '  ✓ duong dan tuong doi');
say(`  ✓ co SDK CrazyGames (${sdkFiles.length} file)`);
say(`  ✓ khong co ${NEVER.join(', ')}`);
say('  ✓ khong co link playtest');

if (problems.length) {
  say('');
  for (const p of problems) say(`  ✗ ${p}`);
  process.exit(1);
}
say('');
say('  Keo THE CONTENTS of dist/ vao o upload cua Developer Portal.');
say('  ⚠ Dung nen zip - o upload tu choi file nen.');
