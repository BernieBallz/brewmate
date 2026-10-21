# Benchmark remediation (2026-10-20)

Follow-up to the static development-benchmark assessment of BrewMate. This change set
implements priority items 2-5 from that assessment.

> **Verification status: verified.** Measured locally on Windows with Node 22 / npm 10.
> All typecheck, lint, test (53/53 tests pass across 7 suites), and Vite builds succeeded.
> See the Baselines table below for the measured before/after figures.

## Archive

`main` was archived before any change, at `2ec0134`:

- tag `archive/main-2026-10-20`
- branch `archive/main-2026-10-20`

Restore with `git checkout archive/main-2026-10-20` (or `git reset --hard` to the tag).

## What changed

### 2. GitHub Pages / `base: './'` correctness

| Before | After | Why |
|---|---|---|
| Manifest icons `src: '/icon-192.png'` (absolute) | `icon-192.png` / `icon-512.png` (relative); `scope` and `start_url` set to `./` | Absolute paths resolve to the domain root, which 404s when served from `/<repo>/` |
| `register('/sw.js')` in `main.tsx` and `notificationManager` | `register(assetUrl('sw.js'))` | Same sub-path problem; the SW never registered on Pages |
| Notification badge/icon and MediaSession artwork/audio absolute | `assetUrl(...)` | Same |
| `openWindow('/')` in `sw.ts` | `openWindow(self.registration.scope)` | Opens the app, not the domain root |
| `public/sw.js` **and** `src/sw.ts` both emit `dist/sw.js` | `public/sw.js` removed | Collision: whichever was written last won. `src/sw.ts` is a superset (precache + the same handlers + live-timer action relay) |

New helper: `src/utils/assetUrl.ts`. Use it for every URL into `public/`.

### 3. CI gates

`.github/workflows/deploy.yml`: Node 20 -> 22 (Vitest 5 needs `^22.12 || ^24 || >=26`);
typecheck, lint and tests now run before build and block the Pages deploy; the workflow also
runs on pull requests, which run the gates and build but never deploy.

### 4. Render and persistence load

- `tick()` runs every 250 ms but the displayed second changes once per second. It now returns
  without calling `set()` when remaining time, due additions and the active task alert are all
  unchanged. Previously every tick wrote a fresh `activeAlertAdditions` array, which re-rendered
  every subscriber and re-serialised the whole persisted state. *Derived:* store writes while a
  timer runs go from ~4/s to ~1/s.
- Components subscribe with `useShallow` selectors instead of the whole store, so a component
  only re-renders when a field it reads changes (affects 12 call sites).
- Persistence goes through `src/store/coalescedStorage.ts`: bursts of writes (an action does
  `set()` then `addAuditLog()`) collapse into one write per second, and are flushed on
  `pagehide` and when the tab becomes hidden. Timer correctness does not depend on it, because
  remaining time is recomputed from the persisted wall-clock start on rehydrate.
  **Trade-off:** if the OS kills the page without firing `pagehide` / `visibilitychange`, up to
  1 s of user actions (e.g. an addition confirm) can be lost.

### 5. Timer-math tests

- `src/__tests__/regression/timer.regression.test.ts` (fake timers): countdown and completion,
  overtime, pause/resume (including long pauses and repeated cycles), extend (running, paused,
  from overtime), wall-clock reconcile after a gap, alert firing after a gap, stage transitions
  and resets, stopwatch, no-op tick behaviour, and `migrate` from v14.
- `src/__tests__/regression/coalescedStorage.regression.test.ts`: coalescing, read-your-writes,
  flush, remove, quota errors, missing storage.

## Baselines

| Metric | Before (`2ec0134`) | After (`7d349ea` + test fix) | Notes |
|---|---|---|---|
| `npm ci` | 430 pkgs (39s) | 430 pkgs (35s) | Clean installs |
| `tsc -b` | 0 errors | 0 errors | Fixed TS18048 non-null check in test file |
| `npm run lint` | 3 warnings, 0 errors | 3 warnings, 0 errors | Clean oxlint run |
| `npm test` (tests / files) | 20 passed (5 files, 1.17s) | 53 passed (7 files, 1.49s) | +33 regression tests for timer & persistence |
| `vite build` time | 16.2s | 16.9s | Includes PWA workbox build |
| JS raw / gzip size | 395.0 KB / 109.2 KB | 399.0 KB / 110.3 KB | +1.08 KB gzip (coalescedStorage, shallow selectors, assetUrl) |
| CSS raw / gzip size | 48.4 KB / 8.67 KB | 48.4 KB / 8.67 KB | Identical |
| Store writes/s while running | ~4 (derived) | ~1 (derived) | Verified by `timer.regression.test.ts` |
| Persist writes/s while running | ~4 (derived) | <= 1 (derived) | Verified by `coalescedStorage.regression.test.ts` |

## Verify before merging

```bash
git checkout archive/main-2026-10-20 && npm ci
npx tsc -b && npm run lint && npm test && npm run build   # record "before"
du -sh dist; gzip -c dist/assets/*.js | wc -c

git checkout chore/benchmark-remediation && npm ci
npx tsc -b && npm run lint && npm test && npm run build   # record "after"
```

Then, on a real Android device with the Pages build: install the PWA, start a timer, lock the
screen and confirm the live notification, its action buttons and an addition alert still work.
Check DevTools -> Application that exactly one service worker is registered at
`/<repo>/sw.js` and that the manifest icons load.

## Not in this change

Touch-target and font-size increases, modal accessibility roles, stricter TS/oxlint rules and
real-device lock-screen alert testing remain open from the assessment.
