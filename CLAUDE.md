# BrewMate

Brew-day assistant PWA ("BrewMate HUD Session Timer"), aimed at Android phones/tablets. Imports a Brewfather recipe and walks the brewer through stages, timers and additions with alarms, notifications, vibration and wake lock.

Stack: React 19 + TypeScript, Vite 8, Tailwind 3, Zustand 5, vite-plugin-pwa (injectManifest, `src/sw.ts`), Vitest, Oxlint.

## Commands

- `npm ci` — install
- `npm run dev` — dev server on port 5173, bound to all interfaces (test on a phone over LAN). Set `VITE_SSL=true` for HTTPS, which some device APIs (wake lock, notifications) need off-localhost.
- `npm test` — Vitest suite (`src/__tests__/regression`)
- `npm run lint` — Oxlint (`.oxlintrc.json`)
- `npm run build` — `tsc -b` then Vite build to `dist/`

Run `npm test`, `npm run lint` and `npm run build` before considering a change done.

## Layout

- `src/store/brewStore.ts` — Zustand store; session state and stage flow live here
- `src/utils/brewfatherParser.ts` — turns a Brewfather recipe JSON into session stages (`src/types/brewfather.ts`, `src/types/session.ts`)
- `src/utils/` — device integrations: audio alarm, notifications, vibration, wake lock, telemetry export
- `src/components/` — `PortraitHUD` / `LandscapeHUD` layouts, `StageFeed`, `TimerCockpit`, modals
- Two brew flows, chosen in the menu (`flowMode`, kept between sessions):
  - **Full step** (default) uses the HUD layouts above: tick each reminder and confirm each addition, with confirm modals when items come due.
  - **By stage** uses `StageScreen`, a full-screen view with no header or tabs. `StageCard` confirms a stage's items in one go at the start, `DueBanner` replaces the confirm modals, and `DoneCard` collects the later readings in `DONE_CARD_READING_IDS`.
  - Both flows share `useStageTimerView`, `StageActions` and `CountdownProgressBar`.
- No built-in recipe: the app opens on a welcome screen until one is loaded. Tests use the fictional `src/__tests__/fixtures/testRecipe.json`; never commit a real recipe
- `.agents/skills/design-engineer/SKILL.md` — UI/mobile polish guidelines; follow them for UI work

## Git and deployment

- `dev-2` is the only branch (default). History was reset on 2026-10-21 to remove personal recipe data; an offline backup of the old history exists on the user's PC only.
- **Pushing to `dev-2` deploys to GitHub Pages** at https://bernieballz.github.io/brewmate/ (`.github/workflows/deploy.yml`; `main` deploys currently fail). The app is pre-release, so pushing finished, checked work to `dev-2` straight away is fine — the user tests on their phone from the live site. Revisit this once the first release ships.
- The site is served from the `/brewmate/` sub-path: reference files in `public/` with `assetUrl()` (`src/utils/assetUrl.ts`) or relative paths, never `/file.png`.
- Commit messages use Conventional Commits with a scope, e.g. `fix(feed): ...`, `feat(ui): ...`.
- `base: './'` in `vite.config.ts` is required for Pages hosting; keep it.
- The user also works on this project in Google Antigravity from a separate checkout (`Documents/AG -BrewMate`; its rules are in `AGENTS.md`). Only work in this clone, and pull before starting.
- CI (`deploy.yml`, Node 22) runs `tsc -b`, lint and tests before building; any failure blocks the deploy. Pull requests run the checks but never deploy.
