---
name: design-engineer
description: Guides UI design, layout polish, responsive mobile quirks, edge-case testing, and animation physics. Trigger when building or reviewing UI components, styles, or transitions.
---

# Design Engineering

This skill synthesizes Emil Kowalski's core design engineering philosophy, mobile-native polish practices, and adversarial UI stress-testing standards. Use it when crafting, refining, reviewing, or debugging interfaces to make them feel intentional, fluid, robust, and native.

---

## Part 1: Design Engineering & Animation Physics

### 1. Core Philosophy

- **Taste is trained, not innate**: Good taste is not arbitrary preference; it is trained instinct. Study why leading interfaces feel fluid and responsive. Reverse engineer interactions and animations.
- **Unseen details compound**: When an interface works exactly as intuition expects, users rarely analyze why—they simply love using it. The aggregate of invisible correctness creates delight.
- **Beauty is leverage**: In an era where software functionality is commoditized, tactile polish, thoughtful motion, and refined defaults are genuine competitive differentiators.

### 2. Code Review Format (Required)

When reviewing UI code, animations, or styling, you **MUST** format findings into a markdown table with `Before`, `After`, and `Why` columns:

| Before | After | Why |
| --- | --- | --- |
| `transition: all 300ms` | `transition: transform 200ms ease-out` | Specify exact properties; avoid `all` |
| `transform: scale(0)` | `transform: scale(0.95); opacity: 0` | Nothing in the real world pops into existence from zero |
| `ease-in` on dropdown | `ease-out` with custom curve | `ease-in` delays initial movement; `ease-out` gives instant feedback |
| No `:active` state on button | `transform: scale(0.97)` on `:active` | Buttons must feel responsive immediately upon pressing |
| `transform-origin: center` on popover | `transform-origin: var(--transform-origin)` | Popovers scale from their trigger (modals remain centered) |

### 3. The Animation Decision Framework

Before animating an element, answer these four questions in order:

#### Step 1: Should this animate at all?
| Frequency | Decision |
| --- | --- |
| **100+ times/day** (keyboard shortcuts, command palette toggle, tab switching) | **No animation. Ever.** Immediate cut. |
| **Tens of times/day** (hover effects, list navigation) | Eliminate or drastically reduce duration |
| **Occasional** (modals, drawers, dialogs, toasts) | Standard deliberate animation |
| **Rare / first-time** (onboarding celebrations, feedback confirmation) | Can introduce expressive delight |

> **Rule:** Never animate keyboard-initiated actions. Repeated keystroke actions feel sluggish and disconnected if accompanied by animation.

#### Step 2: What is the purpose?
Valid purposes include:
- **Spatial consistency**: Toast enters and exits along consistent axes, enabling intuitive swipe gestures.
- **State indication**: Button transitions into a spinner or checkmark to confirm action state.
- **Feedback**: A pressable control scales subtly down on press to confirm touch contact.
- **Preventing jarring cuts**: Smooth appearance/disappearance avoids visual pop-in.

#### Step 3: What easing curve?
- **Entering or exiting**: `ease-out` (starts fast, feels immediately responsive).
- **Moving / morphing on screen**: `ease-in-out` (natural acceleration and deceleration).
- **Hover / color change**: `ease`.
- **Constant motion** (spinners, marquees): `linear`.
- **Default**: `ease-out`.

> **Never use `ease-in` for UI transitions.** It starts slowly, making interactions feel delayed and laggy.

**Custom Production Easing Curves:**
```css
/* Strong snappy ease-out for UI interactions */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);

/* Smooth ease-in-out for on-screen element transitions */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);

/* Native iOS-like drawer curve */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

#### Step 4: How fast should it be?
| Element | Recommended Duration |
| --- | --- |
| Button press feedback | 100–160ms |
| Tooltips & small popovers | 125–200ms |
| Dropdowns & select menus | 150–250ms |
| Modals & drawers | 200–350ms (never > 500ms) |

> **Rule:** Keep UI animations under 300ms. Perceived speed matters as much as actual speed. Fast spinners and instant feedback create the sensation of instantaneous responsiveness.

### 4. Spring Animations & Physics

Springs simulate physical mass and damping, producing organic motion without artificial fixed durations.

- **Apple-style configuration (recommended for UI):**
  ```js
  { type: "spring", duration: 0.5, bounce: 0.2 }
  ```
- **Physics-based configuration (for fine gesture control):**
  ```js
  { type: "spring", mass: 1, stiffness: 100, damping: 10 }
  ```
- **Interruptibility**: Springs maintain momentum when interrupted mid-motion (e.g., closing a drawer before it finishes opening), whereas CSS keyframes restart from zero.
- **Mouse tracking**: When tying UI to cursor coordinates, wrap raw positions in a spring hook (`useSpring` in Framer/Motion) to simulate natural momentum rather than rigid attachment.

### 5. Component Construction Rules

- **Active feedback**: Always add `:active` feedback to buttons and pressable surfaces:
  ```css
  .button {
    transition: transform 140ms ease-out;
  }
  .button:active {
    transform: scale(0.97);
  }
  ```
- **Avoid `scale(0)`**: Animate entries from `scale(0.95)` and `opacity: 0`. Real-world objects do not inflate from infinite point density.
- **Trigger-aware transform origins**: Popovers and dropdowns should scale out from their triggering button (`transform-origin: var(--transform-origin)`). Modals are centered in the viewport and should remain centered (`transform-origin: center`).
- **Instant subsequent tooltips**: Tooltips should have an initial hover delay, but once active, hovering over adjacent tooltips must render instantly (0ms transition) without re-delaying.
- **Transitions over keyframes**: Prefer CSS transitions for interactive UI. Keyframes cannot seamlessly adapt or reverse if interrupted mid-flight.
- **Blur masking**: When crossfading between two states that do not align cleanly, apply a subtle temporary `filter: blur(2px)` during the transition to blend the swap organically (keep blur < 20px).
- **Declarative entry with `@starting-style`**:
  ```css
  .dialog {
    opacity: 1;
    transform: translateY(0);
    transition: opacity 250ms var(--ease-out), transform 250ms var(--ease-out);

    @starting-style {
      opacity: 0;
      transform: translateY(12px) scale(0.97);
    }
  }
  ```
- **Hardware-accelerated transforms**: Only animate `transform` and `opacity`. Animating `width`, `height`, `margin`, or `padding` triggers layout recalculation and paint.
- **Percentage transforms**: Use `translateY(100%)` or `translateY(-100%)` for drawer and toast off-screen positioning rather than arbitrary pixel heights.

---

## Part 2: Mobile Native Polish & Platform Layer

When running on mobile browsers or PWAs, default browser behaviors often betray the web layer. Apply these platform fixes to deliver an app-like native feel.

### 1. The Mobile Symptom & Fix Catalog

| Problem | Root Cause | Solution |
| --- | --- | --- |
| **Sticky hover after tap** | Touch fakes hover state and persists after tap | Wrap `:hover` rules inside `@media (hover: hover) and (pointer: fine)` |
| **Gray/blue flash on tap** | Webkit tap highlight painted on clickable elements | Add `html { -webkit-tap-highlight-color: transparent; }` |
| **Layout overflow / broken 100vh** | URL bar shrinks/expands visible viewport | Use `100dvh` for app shell/drawers, `100svh` for heroes/first screens |
| **Page zooms into input on focus** | Input font size is smaller than 16px | Set `font-size: 16px` minimum on all `input`, `textarea`, `select` |
| **Tap feels sluggish / delayed** | 300ms click delay or feedback on click release | `touch-action: manipulation;` and feedback on `:active` / `pointerdown` |
| **Pull-to-refresh hijacks scroll** | Body rubber-banding chains with app containers | `overscroll-behavior: none` on `html, body`; `overscroll-behavior: contain` on inner scrollables |
| **Content cut off by notch / island** | Page letterboxed inside default safe area | `<meta name="viewport" content="..., viewport-fit=cover">` + `env(safe-area-inset-*)` |
| **Long-press selects button text** | Browser defaults treat button text as selectable | `user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;` on controls |
| **Horizontal carousel jitters vertically** | Browser confuses horizontal swipe with vertical scroll | `touch-action: pan-y` on the carousel surface |
| **Status bar chrome color mismatch** | Missing or single static `theme-color` meta | Dual `<meta name="theme-color">` for light and dark schemes |

### 2. Mobile Baseline Boilerplate

Include this foundation in your project setup:

**HTML Meta Tags:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0a0a0a" />
<meta name="color-scheme" content="light dark" />
```

**Global CSS Baseline:**
```css
html {
  -webkit-tap-highlight-color: transparent;
  -webkit-text-size-adjust: 100%;
  overscroll-behavior: none;
}

/* Prevent accidental zoom on mobile focus */
input, textarea, select {
  font-size: 16px;
}

/* Eliminate 300ms tap delay and unwanted text selection on controls */
button, a, [role="button"] {
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

/* Guard hover states so they never stick on touch devices */
@media (hover: hover) and (pointer: fine) {
  .button:hover {
    /* hover styles */
  }
}

/* Safe areas */
.safe-top {
  padding-top: env(safe-area-inset-top, 0px);
}
.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

### 3. What Never to Ship on Mobile

- **Never use `user-scalable=no` or `maximum-scale=1`**: Breaking pinch-to-zoom is an accessibility failure. Fix the input font size (16px) instead.
- **Never put `user-select: none` on `body`**: Users need to copy order numbers, recipes, notes, and addresses. Only lock selection on control buttons and icons.
- **Never rely on desktop emulation**: Chrome DevTools device mode cannot emulate rubber-band physics, software keyboard displacement, tap delays, or sticky hover artifacts. Test on a physical phone over local Wi-Fi or USB debugging.

---

## Part 3: UI Stress-Testing & Worst-Case Verification

Components are routinely designed against forgiving demo data (e.g. "Jane Doe", "5 items"). Before finalizing UI components, stress-test them adversarially with realistic worst-case data.

### 1. Operating Rules

1. **Plausible or schema-backed, never random**: Don't use `asdfasdf` or 5,000 characters. Use authentic edge cases (hyphenated names, long subdomains, Vietnamese diacritics, 0 and 1 plurals).
2. **Change data, not components**: Feed edge data through fixtures or props. Never modify markup to manually force a test state.
3. **Inspect layout failure signatures**:
   - Fixed icons/avatars getting squished into ovals $\rightarrow$ add `flex-shrink: 0`.
   - Text overflowing outside cards or columns $\rightarrow$ add `min-width: 0` on flex/grid children (`minmax(0, 1fr)`).
   - Long emails or URLs failing to wrap $\rightarrow$ add `overflow-wrap: anywhere`.
   - Badge breaking onto two lines $\rightarrow$ add `white-space: nowrap; flex-shrink: 0`.
   - Numbers jittering width during counters/timers $\rightarrow$ add `font-variant-numeric: tabular-nums`.
   - Jittery multiline rows where avatar stays vertically centered $\rightarrow$ switch container to `align-items: flex-start`.
4. **Truncate vs Wrap vs Clamp**:
   - **Wrap**: Essential identifiers the user must read completely (names, titles).
   - **Truncate (End)**: Secondary descriptions or roles where the prefix is informative. Always provide a full tooltip/detail view.
   - **Truncate (Middle)**: File names, URLs, hashes, or emails where the beginning and end contain the differentiating info.
   - **Clamp (`line-clamp: n`)**: Card previews where uniform grid height is mandatory.
   - **Never Truncate**: Quantities, financial balances, dates, or countdown timers.

### 2. Worst-Case Data Catalog Quick-Reference

| Category | High-Risk Test Values | What It Breaks |
| --- | --- | --- |
| **Names** | `Aleksandra Wiśniewska-Kowalczyk`<br>`Christopher Alexander Montgomery III`<br>`Jo`<br>`Đặng Thị Ngọc Hân`<br>`🦊 Fox` | Multi-line wrap, avatar squishing, naive initials extraction (`.split(' ')[0][0]`), stacked diacritics clipping. |
| **Identifiers & URLs** | `bartholomew.fitzgerald@northwind-industries-holdings.example.com`<br>`https://example.com/very/long/path?param=value` | Unbreakable strings pushing action buttons or menus off the viewport. |
| **Counts & Numbers** | `0`<br>`1`<br>`1284`<br>`1000000`<br>`0.1 + 0.2` | Pluralization bugs ("1 members", "0 minutes"), missing thousands separators, raw floats. |
| **Timestamps & Timers** | `00:00`<br>`99:59`<br>`Just now`<br>`1284 hours` | Width shifting on digit change (requires `tabular-nums`), unit overflow. |
| **Collections** | 0 items (empty state)<br>1 item (grid layout balance)<br>1,000+ items (pagination / virtualization) | Empty state absence, single card stretching, render lag. |

### 3. Stress-Test Report Format

When conducting a UI audit or stress test, present results cleanly:

1. **What Broke Table**:
   | # | Severity (Broken / Ugly / Fragile) | Element / Field | Worst-Case Value | Observed Issue | Recommended Fix |
   | - | - | - | - | - | - |
2. **Decisions for User**: Tradeoffs requiring product discretion (e.g. wrap vs line-clamp).
3. **What Held Up**: Components and layouts that handled stress tests flawlessly.

---

## Part 4: Review Checklist Summary

Whenever evaluating or building a component or layout:

- [ ] Does it specify exact transition properties instead of `transition: all`?
- [ ] Are enter animations anchored at `scale(0.95)` with opacity instead of `scale(0)`?
- [ ] Is `ease-out` (or custom curve) used for entry, avoiding sluggish `ease-in`?
- [ ] Are popovers and dropdowns origin-aware, while modals stay centered?
- [ ] Do pressable elements have immediate feedback on `:active` (`scale(0.97)`)?
- [ ] Are all `:hover` rules scoped behind `@media (hover: hover) and (pointer: fine)`?
- [ ] Is `-webkit-tap-highlight-color: transparent` enabled globally?
- [ ] Are mobile viewport heights defined using `100dvh` (or `100svh`), avoiding `100vh` overflow?
- [ ] Do inputs enforce a minimum `16px` font size on mobile to prevent iOS zoom?
- [ ] Do buttons have `touch-action: manipulation` and control text have `user-select: none`?
- [ ] Are fixed icons/avatars protected with `flex-shrink: 0`?
- [ ] Are text containers in flex layouts protected with `min-width: 0` and `overflow-wrap: anywhere`?
- [ ] Are dynamic timer counters and numeric readouts styled with `font-variant-numeric: tabular-nums`?
