#!/usr/bin/env bun
// Build assets/og-image.svg — the Microcosm social card (1200×630), in the
// Microcosm identity (constellation-design/identities/microcosm, third cut
// 2026-08-02), not the PolicyEngine design system the site pages currently wear.
//
// Construction sources:
// - Tokens: constellation-design/tokens/microcosm.css (light theme — an OG
//   image renders once, light-native): canvas #F6FAF7, ink #17251D,
//   secondary #44584C, tertiary #6E7F74, verdigris #3E7A5E (strong #2C5A45),
//   border-soft #D5E4DA.
// - Wordmark: constellation-design/identities/microcosm/wordmark.svg, embedded
//   verbatim (Urbanist Regular slots at em=1000, tracking 40; focus fade
//   .96/.90/.83/.75 by distance from the operator; the first o carries the
//   drawn verdigris point, Ø154 at (2385.5, −251)). The drawn standalone
//   operator is NOT set beside it — per the identity, the drawn form exists
//   only where there is no word to mark.
// - Dot-field: the identity's feature motif — an exact lattice (pitch 18, no
//   jitter) whose dot radii (0.05–0.26 × pitch) follow a smooth field that
//   resolves into the operator: a world-ring and its point, Gaussian ring
//   R=140 σ=28 plus core σ=39, scaled from the brand board's band
//   (R118 σ24 / σ33). Ambient minimum-size dots cover the rest — sanctioned
//   for covers. One hue; tone comes from size, never a second color.
// - Type: STIX Two Text for the display line, IBM Plex Mono for labels,
//   Urbanist for the wordmark only (tokens/microcosm.css).
// - Copy: the site hero's construction, broadened to the identity's scope
//   triple — people, households, and firms (the rename exists because the
//   miniature is not only households); tagline is the site <title>'s. The
//   fine print says "microdata", which carries no unit-type claim.
//
// Fonts are vendored latin subsets (vendor/fonts/*.woff2, all SIL OFL),
// embedded as data URIs so the SVG is self-contained. Provenance: the
// Microcosm teaser build's next/font output (Google Fonts subsets):
//   urbanist-latin.woff2              720c96ccf77cd5d053b6e973d8be7d4942904ccf65fa808a8dea9de385f82284
//   stix-two-text-latin.woff2         889d958dfc639d2b89fc1873ad3cf74e00c86551f133227c79357e829d4058c9
//   stix-two-text-italic-latin.woff2  c0ed908ab0671fce3f822a3b5f60d96565a3822a752bb38597acd28f185ca208
//   ibm-plex-mono-400-latin.woff2     c36f509c0a8f9f85f29cb44bc8701d8a9e0b14c499e77a884f789ead7093a7ac
//   ibm-plex-mono-500-latin.woff2     a76f53ca6612e7b3828eec2311098675b7f9849ae4169a8bcef6302aec02a6c0
//
// Usage:  bun scripts/build-og-image.mjs        (writes assets/og-image.svg)
//
// PNG render: needs a real browser engine — resvg/cairosvg do not load
// data-URI woff2 @font-face. Wrap the SVG in a bare HTML page (margin 0),
// screenshot with Playwright Chromium at viewport 1200×630 and
// deviceScaleFactor 2 after `document.fonts.ready`, then downsample:
//   sips -z 630 1200 og-2x.png --out assets/og-image.png

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const b64 = (p) =>
  readFileSync(join(root, "vendor", "fonts", p)).toString("base64");

// ---------- tokens (constellation-design/tokens/microcosm.css, light) ----------
const CANVAS = "#F6FAF7";
const INK = "#17251D";
const TERTIARY = "#6E7F74";
const VERDIGRIS = "#3E7A5E";
const VERDIGRIS_STRONG = "#2C5A45";
const BORDER_SOFT = "#D5E4DA";

// ---------- dot-field: lattice pitch 18, r = 0.05–0.26 × pitch ----------
const W = 1200;
const H = 630;
const PITCH = 18;
const R_MIN = 0.05 * PITCH; // 0.9
const R_MAX = 0.26 * PITCH; // 4.68 — dots never touch (max Ø 9.36 < 18)
const FIELD = { cx: 1005, cy: 290, R: 140, sigmaRing: 28, sigmaCore: 39 };

function fieldValue(x, y) {
  const d = Math.hypot(x - FIELD.cx, y - FIELD.cy);
  const ring = Math.exp(-((d - FIELD.R) ** 2) / (2 * FIELD.sigmaRing ** 2));
  const core = Math.exp(-(d * d) / (2 * FIELD.sigmaCore ** 2));
  return Math.min(1, ring + core);
}

// Ambient dots render at half-tone so the display text stays comfortably
// readable on the field; motif dots ramp smoothly up to full verdigris as the
// field swells (no opacity seam at the ambient/motif threshold).
const AMBIENT_OPACITY = 0.5;
let motifDots = "";
for (let y = PITCH / 2; y < H; y += PITCH) {
  for (let x = PITCH / 2; x < W; x += PITCH) {
    const f = fieldValue(x, y);
    const r = R_MIN + (R_MAX - R_MIN) * f;
    if (r >= 0.95) {
      const o = Math.min(1, AMBIENT_OPACITY + 1.8 * f);
      motifDots += `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}"${o < 1 ? ` fill-opacity="${o.toFixed(2)}"` : ""}/>`;
    }
  }
}

// ---------- wordmark (identities/microcosm/wordmark.svg, verbatim) ----------
const LETTERS = [
  [444.25, "m", 0.75],
  [1023.5, "i", 0.83],
  [1413.25, "c", 0.9],
  [1886.75, "r", 0.96],
  [2385.5, "o", 1],
  [2960.25, "c", 0.96],
  [3535, "o", 0.9],
  [4069.75, "s", 0.83],
  [4768.75, "m", 0.75],
];
const WM_W = 420;
const WM_H = (WM_W * 726) / 5245; // 58.13
const wordmark =
  `<svg x="84" y="84" width="${WM_W}" height="${WM_H.toFixed(2)}" viewBox="-16 -690 5245 726" role="img" aria-label="microcosm">` +
  `<g text-anchor="middle" class="wm-face" font-size="1000" font-weight="400" fill="${INK}">` +
  LETTERS.map(
    ([x, ch, o]) =>
      `<text x="${x}" y="0"${o < 1 ? ` fill-opacity="${o}"` : ""}>${ch}</text>`,
  ).join("") +
  `</g>` +
  `<circle cx="2385.5" cy="-251" r="77" fill="${VERDIGRIS}"/>` +
  `</svg>`;

// ---------- fonts ----------
const fontFace = (family, style, weight, file) =>
  `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};src:url(data:font/woff2;base64,${b64(file)}) format('woff2');}`;

const fonts = [
  fontFace("Urbanist", "normal", "400", "urbanist-latin.woff2"),
  fontFace("STIX Two Text", "normal", "400 700", "stix-two-text-latin.woff2"),
  fontFace(
    "STIX Two Text",
    "italic",
    "400 700",
    "stix-two-text-italic-latin.woff2",
  ),
  fontFace("IBM Plex Mono", "normal", "400", "ibm-plex-mono-400-latin.woff2"),
  fontFace("IBM Plex Mono", "normal", "500", "ibm-plex-mono-500-latin.woff2"),
].join("\n    ");

// ---------- the card ----------
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <title>microcosm — the economy in miniature</title>
  <desc>A nation is millions of households. We build a synthetic one that stands in for them all. A dot-field on an exact lattice resolves into the Microcosm operator — a world-ring and its point, in verdigris.</desc>
  <!-- Generated by scripts/build-og-image.mjs — edit that, not this. -->
  <defs>
    <style>
    ${fonts}
    .serif { font-family:'STIX Two Text',Georgia,serif; }
    .mono  { font-family:'IBM Plex Mono',monospace; }
    .wm-face { font-family:Urbanist,'Avenir Next','Century Gothic',Futura,sans-serif; }
    </style>
    <pattern id="lattice" width="${PITCH}" height="${PITCH}" patternUnits="userSpaceOnUse">
      <circle cx="${PITCH / 2}" cy="${PITCH / 2}" r="${R_MIN}" fill="${VERDIGRIS}" fill-opacity="${AMBIENT_OPACITY}"/>
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="${CANVAS}"/>
  <!-- ambient field stops above the footer: label-scale text never sits on it -->
  <rect width="1200" height="540" fill="url(#lattice)"/>
  <g fill="${VERDIGRIS}">${motifDots}</g>

  ${wordmark}
  <text x="86" y="192" class="mono" font-size="16" letter-spacing="0.4" fill="${TERTIARY}">the economy in miniature</text>

  <g class="serif" font-size="42" fill="${INK}">
    <text x="84" y="312">A nation is millions of</text>
    <text x="84" y="367" font-style="italic">people, households, and firms.</text>
    <text x="84" y="422">We build a synthetic one</text>
    <text x="84" y="477">that stands in for them all.</text>
  </g>

  <line x1="84" y1="548.5" x2="1116" y2="548.5" stroke="${BORDER_SOFT}" stroke-width="1.5"/>
  <text x="84" y="586" class="mono" font-size="16" font-weight="500" fill="${VERDIGRIS_STRONG}">microcosm.institute</text>
  <text x="1116" y="586" class="mono" font-size="13" fill="${TERTIARY}" text-anchor="end">calibrated synthetic microdata, built in the open · a PolicyEngine project</text>
</svg>
`;

const out = join(root, "assets", "og-image.svg");
writeFileSync(out, svg);
console.log(
  `wrote ${out} (${(svg.length / 1024).toFixed(0)} KB, ${(motifDots.match(/<circle/g) || []).length} motif dots)`,
);
