# Shipping to CrazyGames

Written after the first build so the next one is a five-minute job. The hard-won
parts are borrowed from the sibling MarbleSort project — its `CRAZYGAMES.md` is
the longer story, and where the two disagree, believe it, because it has been
through a review and this has not.

---

## 1. Every update

```bash
npm run build:crazy
```

It refuses nothing quietly. It must print:

```
Ban "crazy": 27 file · 2.37 MB
  ✓ duoi 20 MB - du dieu kien len trang chu ban mobile
  ✓ duong dan tuong doi
  ✓ co SDK CrazyGames (2 file)
  ✓ khong co tests, scripts, Manythings, node_modules, .git
```

Then check the bundle actually boots — not the dev server, the built files:

```bash
npm run dev          # in another terminal
# open http://localhost:5180/tests/crazy.html
```

That suite drives `dist/` rather than the source: it proves the platform layer
loads **before** `save.js`, that the game still plays with no SDK at all, that
the host's mute outranks the in-game one, and that nothing from `tests/` or
`scripts/` hitched a ride. 26 checks, all of which must pass.

⚠ **Run it with the SDK blocked too.** That is the adblocker path, and it is the
one that silently breaks:

```bash
chrome --headless --host-resolver-rules="MAP sdk.crazygames.com 127.0.0.1:1" \
  --dump-dom http://localhost:5180/tests/crazy.html
```

Then upload:

> Developer Portal → your game → **Builds / Files** → drag **the contents of
> `dist/`** into the upload zone → save → submit for review.

⚠ **Do not zip it.** The upload box rejects archives outright. Drag the files;
the browser keeps the subdirectory tree.

⚠ **Drag `dist/`, never the repo.** `tests/` sits right next to `src/`, and a
test harness in front of a reviewer is a failed review. The build script keeps
it out; dragging the repo by hand defeats that.

---

## 2. How the platform layer works

One file, [src/platform-crazy.js](src/platform-crazy.js), spliced into
`index.html` by the build script and present in no other build. Everything it
does survives the SDK never arriving.

| what | where |
|---|---|
| progress storage | `BS.store` — reads the host first, writes to **both** |
| boot gate | `BS.ready`, awaited by `BS.whenReady()` in `save.js` |
| ad windows | `gameplayStart` / `gameplayStop`, derived from the screen state |
| host mute | `BS.board.audio.setHostMute()` |
| flourish | `happytime()` on a level win |

⚠ **The platform script must load before `save.js`.** `save.js` captures
`BS.store` at parse time, so a layer that loads after it installs a store
nothing uses and every write goes to the browser instead of the player's cloud
save. `tests/crazy.html` asserts the order.

⚠ **Nothing may read storage before `BS.ready` resolves.** The host preloads the
player's cloud save *during* its own init, so an early read returns the local
copy and the next write pushes that stale copy over their real one. Both eager
readers — the audio preferences in `board.js` and the whole start-up block in
`ui.js` — go through `BS.whenReady`. Anything new that reads the save at parse
time has to as well.

⚠ **Gameplay brackets are derived, never emitted by hand.** `playing()` asks the
DOM: the game screen is showing and no overlay is open. A MutationObserver
recomputes it. Emitting from each call site would mean the one place you forget
is where an ad lands in the middle of a move — and this game opens overlays from
four different files.

**Cold start.** With the SDK blocked the boot waits about two seconds before the
first screen appears. That is deliberate: a session without cloud save is a
degraded session, a session that boots on stale data and then overwrites the
player's real save is a ruined one. Inside their iframe the host's own spinner
covers that wait. Outside it — a reviewer opening the direct URL — it is two
seconds of backdrop.

---

## 3. First submission only

- [ ] **Payment details** — before submitting, not after approval
- [ ] Developer Portal account
- [ ] Run the portal's **Quality Assurance Tool**, clear every warning
- [ ] Three covers: 1920×1080 · 800×1200 · 800×800
- [ ] Two preview videos, 15–20s each
- [x] Privacy policy URL: `https://ballsortcolor-e295a.web.app/privacy.html`

Form answers that have consequences:

| field | answer | why |
|---|---|---|
| Game engine | **HTML5** | not "Externally hosted (iframe)" — that is for games you host |
| Orientation | **Portrait** | the column is 480px wide; there is no landscape layout |
| Supports mobile | **tick** | declaring portrait lets them handle rotation |
| SDK muting | **tick** | implemented — leaving it unticked makes the handling inert |
| Saves progress | **Yes, using the Data Module** | *and switch Progress Save on* — the module does nothing while the toggle is off |
| Online game | **no** | no multiplayer |

⚠ **The privacy link goes in the form, never as an outbound link in the UI.**
Outbound links are banned, so the in-game route is Settings → Privacy policy,
which shows the copy that ships inside the bundle in a same-origin frame.

If the policy changes it has to be updated in **both** places - the bundle gets
it from `public/privacy.html` at build time, and the hosted copy needs a deploy:

```bash
npx firebase-tools deploy --only hosting   # project ballsortcolor-e295a
```

⚠ **It must match what the game actually collects.** Add so much as one
analytics call and that page is wrong the same day.

⚠ **Preview videos: no black bars, no mouse cursor.** Both are on their
prohibited list. The game is a portrait column and neither store frame is, so
fill the sides with a blurred, darkened copy of the gameplay itself.

---

## 4. Things that must never change after launch

- ⚠ **The `bsp_` storage prefix.** Automatic Progress Save backs up
  `localStorage` verbatim, so renaming a key after launch restores old names
  into a game that reads new ones and every player loses everything. Keys may be
  **added**; none may be renamed. `src/save.js` says the same thing at the top,
  and it is the one rule in this project with no way back.

---

## 5. What Basic Launch actually grades

Not just a quality review: a two-week limited-traffic run, whose engagement
numbers decide Full Launch.

| metric | good | ours |
|---|---|---|
| build size | < 20 MB | **2.37 MB** ✓ |
| load time | < 10 s | 27 files, no bundler, no fonts to fetch |
| reached gameplay | 80 %+ | one tap from Home |
| day-1 retention | 10–15 % | localStorage + Progress Save |
| avg session | 10+ min | — |

⚠ **"Time to gameplay" is measured to the `gameplayStart` call**, not to first
paint. Nothing may be added to the boot path without checking that number — and
the SDK handshake is already on it.
