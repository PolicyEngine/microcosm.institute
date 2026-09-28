# DynaSim replication scorecard

Static ES modules; no production dependencies or build step. Serve the repository
root with `python3 -m http.server 4399` and open
`/dynamics/scorecard/index.html` (or `/dynamics/scorecard/`).

- `data.json` holds the measurements and verbatim supplied editorial copy. The
  renderer moves `[src: …]` annotations into adjacent HTML comments. All displayed
  numerical content comes from this file or calculations on it.
- Exercise 1 uses original-precision values from its verified registered artifact
  and sealed comparator. This reconciles the memo's independently rounded gap.
  Original memo values remain in `memo_values`; original rounded run times remain
  alongside exact supervisor timestamps. Added evidence files carry SHA-256s.
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
updates. Mobile copy sections start collapsed. Chrome and Chromium launches were
blocked by the environment's macOS sandbox, so pixel rendering and actual 375px
browser geometry remain unverified; layout constraints were reviewed in CSS.
