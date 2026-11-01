# Changelog

## 1.0.0 – 2026-11-01

First production release.

### Features

- Imports Brewfather JSON recipes and builds the brew day: Strike Water, Mash In, Mash Rest, Sparge, Boil, optional Whirlpool, Chill, Knockout, Yeast Pitch and Clean Up.
- Two brew flows: Full step and By stage.
- Wall-clock timers that survive the phone sleeping or the app being closed.
- Addition and reminder alarms with sound, vibration and lock-screen notifications, including timer controls on the lock screen.
- Records strike, mash and exit temperatures, mash pH, and pre-boil and original gravity.
- Session report with CSV, Markdown and JSON export.
- Installable and works offline.

### Fixed in the release review

- Tapping the current stage in the menu reset its running timer, and jumping to another stage lost a running timer without asking.
- A countdown that ran out while the app was closed raised no alert and recorded no time.
- Skipping a running countdown recorded 0 minutes; going back marked the later stage as completed.
- "Keep screen on" could stay on after being switched off, stayed on after the brew finished, and showed on after a reload when it wasn't.
- Hops with the Flameout use were left off the brew day.
- Missing recipe values were replaced with invented targets (267 L pre-boil, SG 1.039, OG 1.0378).
- Whole-litre rounding of saved sessions did nothing, because of a broken pattern.
- The Markdown report labelled every untimed addition "Flameout" and put the addition type in its Stage column.
- A failed clipboard copy reported success.
- Lock-screen buttons did nothing if Android had closed the app.

### Security

- Added a Content Security Policy.
- Stricter recipe validation: rejects files that aren't recipes, and durations or amounts outside sensible limits.
- Recipe text is escaped in the Markdown report.
- The service worker only touches this app's own pages on the shared GitHub Pages address.
- CI: actions pinned to commit SHAs, install scripts disabled, and only `dev-2` can deploy.

### Other

- Replaced the template app icons, which were all the same wrongly sized image, with real ones, and added a maskable icon.
- Removed unused template files and old working documents.
