# DynaSim replication scorecard

Static ES modules; no production dependencies or build step. Serve the repository
root with `python3 -m http.server 4399` and open
`/dynamics/scorecard/index.html` (or `/dynamics/scorecard/`).

- `data.json` is a byte-identical copy of `scorecard/scorecard-data.json`; `copy.json` holds the verbatim editorial copy. The renderer moves `[src: …]` annotations into adjacent HTML comments. All displayed numerical content comes from `data.json` or calculations on it.
- Exercise 1 uses the memo's two-decimal values, so `check.mjs` allows a 0.015 rounding tolerance on its gaps and compares timestamps to the minute.
- `scorecard.js` renders the copy, timelines, glossary, drill and modal tour.
  `charts.js` renders chart/table views and registered alternatives. Each module
  has its own stylesheet, using the site's fonts and theme tokens.
- Exercise 2 displays a solid design-SE bar and a separate dashed noise floor.
  Its levels view has printed comparator rounding intervals, without assigning
  change uncertainty to levels.

Validation: `node dynamics/scorecard/check.mjs`, plus `node --check` on both UI
modules and the checker. The invariant checker also accepts a fixture path;
malformed gap, interval, exercise-2 interval, exercise-4 cell count, chronology,
URL and source-hash fixtures were each verified to exit with failure.

HTTP checks returned 200 for the page, modules, stylesheets, data and shared font
and token assets. DOM interaction checks cover the timeline selector, every
chart's focus tooltips and table toggle, both poverty views, option groups,
alternatives, the drill, tour navigation/focus trapping/Escape, and glossary
updates. Mobile copy sections start collapsed. Isolated Linux Chromium checks
verify 375px chart geometry and visible labels, equal alternatives bar scales,
two-decimal chart labels, outside-tap dismissal, disclosure state across
breakpoints, and glossary-first Escape. A routed clean URL verifies asset loading
without a trailing slash.
