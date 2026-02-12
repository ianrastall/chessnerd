# Color Chooser: Full Under-the-Hood Walkthrough

## Scope
This document explains how the Color Chooser works internally on Chess Nerd.

Important note:
- There is no dedicated `color-chooser.html` page in this repo.
- The feature is shared across pages via common header markup and `js/theme.js`.

Primary implementation:
- `js/theme.js`

Representative page integration:
- `index.html` (header controls + script include + early theme bootstrap in `<head>`)

Supporting styles:
- `css/style.css` (theme tokens, header controls, focus/reduced-motion styles)

## High-Level Architecture

### 1. DOM Contract (Header Controls)
Each page that supports the Color Chooser renders:
- `#accentColor` as a `<select>` dropdown
- `#themeToggle` as the dark/light mode button

In `index.html`, these controls are in the header (`index.html:71-80`) and `js/theme.js` is loaded (`index.html:94`).

### 2. State Sources
The feature uses:
- CSS custom properties on `:root` / `document.documentElement`
- `data-theme` attribute on `<html>`
- `localStorage` keys (guarded with try/catch wrappers):
  - `theme` (`"dark"` or `"light"`)
  - `accentColor` (hex color like `#0d9488`)
  - `holiday_snow_enabled` (`"true"` or absent)

### 3. Styling Model
`css/style.css` defines:
- Base dark-theme tokens at `:root` (`css/style.css:1-20`)
- Light-theme overrides at `[data-theme="light"]` (`css/style.css:22-38`)
- Header/dropdown/button UI styles (`css/style.css:70-168`, `css/style.css:272-317`)

`theme.js` updates:
- `--accent`
- `--accent-light`
- `--accent-rgb`

This lets both opaque and transparent accent-based UI (including board highlights) track the selected accent.

## Runtime Flow

### Boot Sequence (Theme/Accent IIFE)
`js/theme.js` starts in an IIFE and does this:
1. Defines helpers and state (`safeStorageGet`, `safeStorageSet`, color functions).
2. Waits for DOM readiness:
   - If document is loading, runs init on `DOMContentLoaded`.
   - Otherwise runs init immediately.
3. In init:
   - Captures control handles (`#themeToggle`, `#accentColor`).
   - Calls `loadPreferences()`.
   - Calls `setupEventListeners()`.

Because element capture happens inside init, this works whether the script is loaded in `<head>` or near `</body>`.

### Pre-paint Theme Bootstrap (index page)
`index.html` includes a small inline script in `<head>` that:
- Reads `theme` and `accentColor` from localStorage (try/catch guarded).
- Applies `data-theme`, `--accent`, `--accent-light`, and `--accent-rgb` early.

This minimizes dark/light flash before the main script runs.

### Preference Loading
`loadPreferences()`:
1. Reads `theme` via guarded storage.
2. Normalizes to `light`/`dark` (default `dark`).
3. Sets `<html data-theme="...">`.
4. Updates theme button icon and accessibility state.
5. Reads `accentColor` via guarded storage.
6. Normalizes color with `normalizeHexColor(...)`.
7. Applies accent variables with `applyAccent(...)`.
8. Rebuilds dropdown options and selected value.
9. Ensures control accessibility attributes are present.

### User Interactions
`setupEventListeners()` wires:
- Theme button click -> `toggleTheme()`
- Accent dropdown change -> `changeAccentColor(event.target.value)`

`toggleTheme()`:
- Flips `data-theme`.
- Persists value in localStorage.
- Updates icon and accessibility state (`aria-pressed`, `aria-label`, `title`).

`changeAccentColor(color)`:
- Applies normalized accent variables.
- Persists color.
- Rebuilds/selects dropdown options (so custom colors stay in sync).

## Function-Level Behavior

### `normalizeHexColor(color)`
- Accepts only 6-digit hex format (`#RRGGBB`)
- Lowercases valid values
- Returns `DEFAULT_ACCENT` if invalid

### `adjustColor(color, amount)`
- Parses normalized hex into RGB
- Adds `amount` to each channel with clamping `[0,255]`
- Returns adjusted hex color

Used to derive `--accent-light`.

### `hexToRgbTuple(color)`
- Converts normalized hex to `"r, g, b"` string
- Used for `--accent-rgb`

### `applyAccent(color)`
- Normalizes input
- Writes:
  - `--accent`
  - `--accent-light`
  - `--accent-rgb`
- Returns normalized color

### `populateAccentDropdown(selectedColor)`
- Rebuilds options from `ACCENT_PALETTE`
- Adds `Custom` option if selected color is not in palette
- Sets dropdown selected value

### `updateThemeToggleIcon(theme)`
- Replaces icon using DOM nodes (no `innerHTML`)
- Uses:
  - `dark_mode` when dark theme active
  - `light_mode` when light theme active
- Updates:
  - `aria-pressed`
  - `aria-label`
  - `title`

### `window.themeUtils`
The script exposes frozen helper methods globally:
- `adjustColor`
- `loadPreferences`
- `toggleTheme`
- `changeAccentColor`
- `normalizeHexColor`

Each exported method re-captures controls before acting.

## Secondary Module in `theme.js`: Holiday Snow Toggle

`theme.js` contains a second IIFE for optional holiday snowfall.

What it does:
- Enables optional snow only during holiday season:
  - Thanksgiving onward in November
  - All December
  - January 1st
- Persists toggle state in `holiday_snow_enabled`
- Restores snow on load if preference is enabled
- Adds a `#snowToggle` button in `.controls` when available
- Runs animation on a fullscreen canvas

Key behavior:
- Outside holiday season: exits early (does not clear saved preference).
- Uses guarded storage access.
- Uses DPR-aware canvas sizing.
- Cleans up animation frame, resize listener, and canvas on stop.
- Adds `beforeunload` cleanup.

## Cross-Page Behavior

Because many pages include shared header controls and `js/theme.js`:
- Theme/accent preference is site-wide.
- Preference persists across page loads.

If a page does not include these controls:
- Theme/accent control wiring safely no-ops.
- If holiday snow was previously enabled, snow can still render without `.controls`.

## Debug Checklist

If Color Chooser appears broken:
1. Confirm page has `#themeToggle` and `#accentColor` (if chooser UI is expected).
2. Confirm `js/theme.js` is loaded on that page.
3. Inspect `<html data-theme="...">` in dev tools.
4. Check computed CSS variables:
   - `--accent`
   - `--accent-light`
   - `--accent-rgb`
5. Check localStorage values:
   - `theme`
   - `accentColor`
   - `holiday_snow_enabled`
6. Verify no script errors are thrown around storage access in restrictive browser modes.
