# Color Chooser: Full Under-the-Hood Walkthrough

## Scope
This document explains how the Color Chooser works internally on Chess Nerd.

Important note:
- There is no dedicated `color-chooser.html` page in this repo.
- The feature is shared across pages via common header markup and `js/theme.js`.

Primary implementation:
- `js/theme.js`

Representative page integration:
- `index.html` (header controls + script include)

Supporting styles:
- `css/style.css` (theme tokens, header controls, and button styles)

## High-Level Architecture

### 1. DOM Contract (Header Controls)
Each page that supports the Color Chooser renders:
- `#accentColor` as a `<select>` dropdown
- `#themeToggle` as the dark/light mode button

In `index.html`, these controls are in the header (`index.html:39-47`) and `js/theme.js` is loaded (`index.html:61`).

### 2. State Sources
The feature uses:
- CSS custom properties on `:root` / `document.documentElement`
- `data-theme` attribute on `<html>`
- `localStorage` keys:
  - `theme` (`"dark"` or `"light"`)
  - `accentColor` (hex color like `#0d9488`)

### 3. Styling Model
`css/style.css` defines:
- Base dark-theme tokens at `:root` (`css/style.css:1-19`)
- Light-theme overrides at `[data-theme="light"]` (`css/style.css:21-36`)
- Header/dropdown/button UI styles used by chooser controls (`css/style.css:69-154`, `css/style.css:264-299`)

`theme.js` updates:
- `--accent`
- `--accent-light`

Any CSS using `var(--accent)`/`var(--accent-light)` updates immediately.

## Runtime Flow

### Boot Sequence
`js/theme.js` starts in an IIFE and does this:
1. Gets element handles:
   - `themeToggle = document.getElementById('themeToggle')`
   - `accentColor = document.getElementById('accentColor')`
2. Waits for DOM readiness:
   - If document is still loading, runs on `DOMContentLoaded`
   - Otherwise runs immediately
3. Calls:
   - `loadPreferences()`
   - `setupEventListeners()`

This guarantees controls initialize whether the script is in `<head>` or near the end of `<body>`.

### Preference Loading
`loadPreferences()`:
1. Reads `localStorage.theme`
2. Normalizes to either `"light"` or `"dark"` (defaults to `"dark"`)
3. Sets `document.documentElement.setAttribute('data-theme', savedTheme)`
4. Updates theme icon via `updateThemeToggleIcon(savedTheme)`
5. Reads `localStorage.accentColor`
6. Normalizes/validates color with `normalizeHexColor(...)`
7. Applies accent variables with `applyAccent(...)`
8. Populates dropdown options and selected value via `populateAccentDropdown(...)`

### User Interactions
`setupEventListeners()` wires:
- Theme button click -> `toggleTheme()`
- Accent dropdown change -> `changeAccentColor(event.target.value)`

`toggleTheme()`:
- Flips `data-theme` between dark/light
- Persists new value in `localStorage`
- Swaps icon (`dark_mode`/`light_mode`)

`changeAccentColor(color)`:
- Calls `applyAccent(color)` (with normalization)
- Saves normalized value to `localStorage`
- Syncs dropdown value if needed

## Function-Level Behavior

### `normalizeHexColor(color)`
- Accepts only 6-digit hex format (`#RRGGBB`)
- Lowercases valid values
- Returns `DEFAULT_ACCENT` if invalid

This is the primary guardrail for corrupted or unexpected storage values.

### `adjustColor(color, amount)`
- Parses hex color into RGB
- Adds `amount` to each channel with clamping `[0,255]`
- Returns a new hex color

Used to derive `--accent-light` from `--accent`.

### `applyAccent(color)`
- Normalizes input
- Writes:
  - `--accent`
  - `--accent-light`
- Returns normalized color

### `populateAccentDropdown(selectedColor)`
- Rebuilds `<select>` options from `ACCENT_PALETTE`
- If saved color is not in palette, adds a `Custom` option
- Sets dropdown value to selected color

This preserves old/custom stored colors without discarding them.

### `updateThemeToggleIcon(theme)`
- Sets Material icon markup on `#themeToggle`
- Uses:
  - `dark_mode` when dark theme active
  - `light_mode` when light theme active

### `window.themeUtils` export
The script exposes helpers globally:
- `adjustColor`
- `loadPreferences`
- `toggleTheme`
- `changeAccentColor`
- `normalizeHexColor`

This allows manual triggering from dev tools or other scripts.

## Secondary Module in `theme.js`: Holiday Snow Toggle

`theme.js` contains a second IIFE unrelated to accent/theme choice but loaded from the same file.

What it does:
- Enables optional snow effect only during holiday season
- Persists toggle state in `localStorage.holiday_snow_enabled`
- Injects a `#snowToggle` button into `.controls`
- Draws animated snow on a full-screen canvas

Date gate:
- Thanksgiving onward in November
- All December
- January 1st

If outside season:
- It clears the stored snow key and exits early.

## Cross-Page Behavior

Because multiple pages include the same header IDs and `js/theme.js`:
- A user selection on one page applies site-wide.
- The next page load restores the same theme/accent from storage.

If a page does not include these controls:
- The script safely no-ops (null checks around element usage).

## Debug Checklist

If Color Chooser appears broken:
1. Confirm page has `#themeToggle` and `#accentColor`.
2. Confirm `js/theme.js` is loaded on that page.
3. Inspect `<html data-theme="...">` in dev tools.
4. Check computed CSS variables (`--accent`, `--accent-light`).
5. Check localStorage values:
   - `theme`
   - `accentColor`
6. Verify no invalid color values are being written by external scripts.
