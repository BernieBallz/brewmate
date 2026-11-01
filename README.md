# BrewMate

A brew-day assistant for Android phones and tablets. Load a recipe exported from [Brewfather](https://brewfather.app) and BrewMate walks you through the day stage by stage, from strike water to clean up, with timers, addition alarms, lock-screen notifications, and a session report at the end.

**Use it:** https://bernieballz.github.io/brewmate/

## Getting started

1. Open the link in Chrome on your phone. To install it, use the menu's **Settings → Install BrewMate app**, or Chrome's **Add to Home screen**.
2. In Brewfather, export your recipe as JSON, then tap **Load recipe** in BrewMate and choose the file.
3. Allow notifications when asked, so alerts reach you with the screen locked.

BrewMate works offline once it has been opened. It keeps the screen on while a timer runs. If Android closes the app, the timer carries on from its saved start time when you reopen it.

Choose how you want to work under **Settings → Brew flow**:

- **Full step** – tick each reminder and confirm each addition as you go.
- **By stage** – confirm each stage in one go, with a full-screen timer.

## Privacy and security

There is no account, server or analytics. Your recipe and brew session are stored only on your device, in the browser's local storage, and leave it only when you export a report. **Remove recipe** in the menu deletes them.

- Imported recipes are strictly checked; a malformed file is rejected, never repaired.
- A Content Security Policy stops the page loading or sending anything outside its own files.
- Text from recipes is neutralised in CSV and Markdown exports, so it can't run as a spreadsheet formula or load remote content.

GitHub Pages serves this site from `bernieballz.github.io`, an address it shares with any other project pages on that account. Browser storage is per address, so only publish pages there that you trust.

## Development

Requires Node 22.12 or later.

```bash
npm ci
```

```bash
npm run dev
```

The dev server runs on port 5173 and is reachable from a phone on your network. Set `VITE_SSL=true` for HTTPS, which wake lock and notifications need away from localhost.

Before calling a change done, run all three:

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run build
```

Pushing to `dev-2` runs the same checks and, if they pass, deploys to GitHub Pages. See [CLAUDE.md](CLAUDE.md) for the project layout and conventions, and [CHANGELOG.md](CHANGELOG.md) for release history.

Tests use the fictional `src/__tests__/fixtures/testRecipe.json`. Never commit a real recipe.
