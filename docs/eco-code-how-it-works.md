# ECO Code Browser Page: Under-the-Hood and Workflow

## Scope
This document explains:

1. How the ECO Code Browser works at runtime.
2. How `js/eco-code.json` is structured and consumed.
3. A repeatable workflow for safely updating or reviewing the page.
4. How to generate an LLM-ready context bundle for cross-model review.

It is based on the repository state as of **February 15, 2026**.

## Files and Responsibilities

### Page/UI
- `eco-code.html`
  - Renders the 3-level ECO selector UI (Volume -> Group -> Opening).
  - Loads and parses `js/eco-code.json`.
  - Renders descriptive opening text and named opening lines.
  - Handles loading/error/empty states in the UI.

### Data file
- `js/eco-code.json`
  - In-browser ECO dictionary keyed by code (`A`, `A00`, `A00-A09`, etc.).
  - Each node contains metadata and optional children/opening lines.

### Site integration
- `index.html` (tool card registration)
- `sitemap.xml` (public route entry)

### Documentation / handoff tooling
- `docs/build_eco_code_context_dump.py`
  - Generates `docs/eco-code-context.txt` for LLM context sharing.
- `docs/eco-code-context.txt`
  - Aggregated dump with full files, selected sections, JSON snapshot, and git history.

## Current Data Snapshot (`js/eco-code.json`)

From the current local JSON:
- Node count: **530**
- Root volumes: **5** (`A`, `B`, `C`, `D`, `E`)
- Depth pattern by key length:
  - `1`: 5 volume nodes
  - `3`: 500 opening code nodes (ex: `A00`)
  - `7`: 25 group-range nodes (ex: `A00-A09`)
- Leaf nodes (no children): **500**
- Maximum children on a node: **80**
- Observed schema keys: `children`, `code`, `content`, `name`, `openings`

Hierarchy shape:
1. Volume letter (`A`..`E`)
2. Group range (`A00-A09`, `B10-B19`, ...)
3. Specific ECO code (`A00`, `A01`, ...)

## Runtime Architecture (`eco-code.html`)

## Initialization
On `DOMContentLoaded`:
1. DOM references are captured (`eco1`, `eco2`, `eco3`, `ecoContent`).
2. Back button listener is attached.
3. `init()` fetches `js/eco-code.json`.
4. On success:
   - in-memory `ecoData` is set
   - top-level volumes `A..E` are populated in `eco1`
   - content panel prompts the user to select a volume
5. On failure:
   - content panel shows an error
   - all dropdowns are switched to disabled/error states

## State model
- `ecoData`: full JSON object in memory.
- `first` (`#eco1`): volume select.
- `second` (`#eco2`): group select.
- `third` (`#eco3`): opening select.
- `content` (`#ecoContent`): detail render surface.

## Selection flow
- Changing `eco1`:
  - clears/locks lower selects
  - renders selected volume content
  - populates and enables `eco2` if children exist
- Changing `eco2`:
  - clears/locks `eco3`
  - renders selected group content
  - populates and enables `eco3` if children exist
- Changing `eco3`:
  - renders specific opening content

## Rendering model
`render(code)`:
1. Validates code presence in `ecoData`.
2. Safely normalizes `content` to a string.
3. Renders paragraph text with newline -> `<br>`.
4. If `openings` exists and has entries:
   - renders "Named Openings" heading
   - renders each opening line in `.eco-move-text` blocks.

## Robustness behavior currently implemented
- Optional chaining for child traversal checks:
  - `ecoData[c]?.children?.length`
- String normalization before `.replace(...)` calls:
  - `content` and each `openings` element are coerced safely
- DOM listener setup inside `DOMContentLoaded` for startup safety.
- Fetch failure UI now disables selects and displays explicit error state.

## Known Constraints and Risk Areas

1. Trust boundary / HTML rendering:
   - Content is currently inserted with `innerHTML`.
   - If ECO data source became untrusted, this would be an XSS vector.
2. Single-shot full JSON fetch:
   - Entire ECO dataset is loaded in one request.
   - Fine for current file size, but no streaming/lazy paging.
3. No search index:
   - Navigation is hierarchical only; no full-text search field.
4. No schema versioning:
   - JSON shape is assumed stable at runtime.

## Repeatable Update Workflow

1. Update `js/eco-code.json` (source refresh or corrections).
2. Open `eco-code.html` and smoke test:
   - select each top-level volume (`A`..`E`)
   - test at least one group and one leaf opening under each
   - confirm "Named Openings" section renders when present
   - test behavior when selecting back up the hierarchy
3. Validate error state quickly:
   - temporarily break JSON path and ensure dropdowns disable with error text
4. Rebuild context dump:
```powershell
python docs/build_eco_code_context_dump.py
```
5. Review/commit:
   - `eco-code.html`
   - `js/eco-code.json` (if changed)
   - `docs/eco-code-how-it-works.md`
   - `docs/eco-code-context.txt`

## LLM Context Dump

Use:
- `docs/build_eco_code_context_dump.py`

Default:
```powershell
python docs/build_eco_code_context_dump.py
```

Default output:
- `docs/eco-code-context.txt`
