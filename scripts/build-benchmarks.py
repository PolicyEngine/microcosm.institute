#!/usr/bin/env python3
"""Render /dynamics/benchmarks from the microcosm-dynamics harness artifacts.

Reads benchmarks/registry.json and benchmarks/history.jsonl from a local
microcosm-dynamics checkout and emits dynamics/benchmarks/index.html. Rerun
after every merged harness evaluation, then commit the regenerated page.
"""

import html
import json
import pathlib
import sys

SITE = pathlib.Path(__file__).resolve().parents[1]
MODEL = pathlib.Path(
    sys.argv[1] if len(sys.argv) > 1
    else pathlib.Path.home() / "PolicyEngine/social-security-model"
)
OUT = SITE / "dynamics" / "benchmarks" / "index.html"

registry = json.loads((MODEL / "benchmarks/registry.json").read_text())
records = [
    json.loads(line)
    for line in (MODEL / "benchmarks/history.jsonl").read_text().splitlines()
    if line.strip() and not line.lstrip().startswith("{\"deviation\"")
    or line.strip()
]

TIER_META = {
    "admin_truth": (
        "Administrative truth",
        "Published administrative statistics from SSA and the Trustees. "
        "Gaps here are errors, and they should shrink as modules land.",
    ),
    "model_triangulation": (
        "Model triangulation",
        "Published estimates from DYNASIM, MINT, and CBO. These are "
        "models too — gaps are information, never targets, and rows are "
        "never fixed toward them.",
    ),
    "statutory_parameter": (
        "Statutory parameters",
        "Values read directly from enacted or introduced law, pinned to "
        "official bill text.",
    ),
}

GAP_LABELS = {
    "label_mismatch": "label mismatch",
    "frame_no_alignment": "frame",
    "concept_mismatch": "concept",
    "module_missing": "module missing",
    "small_cell": "small cell",
    "preliminary_source": "preliminary source",
    "unverified_source": "unverified source",
    "unexplained": "unexplained",
}


def latest_by_row():
    latest = {}
    for rec in records:
        rid = rec.get("row_id")
        if rid:
            latest[rid] = rec
    return latest


def summarize_deviation(rec):
    dev = rec.get("deviation")
    if not isinstance(dev, dict):
        return "—"
    rel = dev.get("relative_percent")
    if isinstance(rel, list) and rel:
        vals = [p["percent"] for p in rel if isinstance(p, dict)]
        if vals:
            lo, hi = min(vals), max(vals)
            if abs(hi - lo) < 0.05:
                return f"{hi:+.1f}%"
            return f"{lo:+.1f}% to {hi:+.1f}%"
    if isinstance(rel, (int, float)):
        return f"{rel:+.2f}%"
    for key in ("signed_points", "signed", "index_point_difference"):
        v = dev.get(key)
        if isinstance(v, (int, float)):
            return f"{v:+.2f} pts"
        if isinstance(v, list) and v:
            vals = [p.get("value", p.get("points")) for p in v if isinstance(p, dict)]
            vals = [x for x in vals if isinstance(x, (int, float))]
            if vals:
                return f"{min(vals):+.2f} to {max(vals):+.2f} pts"
    if dev.get("ordering_matches") is True:
        return "ordering matches"
    return "see artifact"


def row_html(entry, rec):
    dev = summarize_deviation(rec) if rec else "—"
    gap = GAP_LABELS.get(entry["gap_class"], entry["gap_class"])
    unverified = entry["verification_class"] != "verified"
    cls = ' class="row-unverified"' if unverified else ""
    note = entry.get("gap_note", "")
    ref = entry.get("external_reference", "")
    src = ref if isinstance(ref, str) else str(ref)
    return (
        f"<tr{cls}><td class=\"mono rid\">{html.escape(entry['row_id'])}</td>"
        f"<td>{html.escape(entry['quantity'])}</td>"
        f"<td>{html.escape(src)}</td>"
        f"<td class=\"num\">{html.escape(dev)}</td>"
        f"<td><span class=\"gap gap-{html.escape(entry['gap_class'])}\">"
        f"{html.escape(gap)}</span></td>"
        f"<td class=\"note\">{html.escape(note)}</td></tr>"
    )


latest = latest_by_row()
by_tier = {}
for entry in registry["entries"]:
    by_tier.setdefault(entry["tier"], []).append(entry)

census = registry.get("gap_class_counts", {})
frame = registry.get("honesty_frame", {})

sections = []
for tier in ("admin_truth", "model_triangulation", "statutory_parameter"):
    entries = by_tier.get(tier, [])
    if not entries:
        continue
    title, blurb = TIER_META[tier]
    rows = "\n".join(row_html(e, latest.get(e["row_id"])) for e in entries)
    sections.append(f"""
  <section class="bench-tier">
    <h2>{html.escape(title)} <span class="count mono">{len(entries)}</span></h2>
    <p class="tier-blurb">{html.escape(blurb)}</p>
    <div class="table-wrap"><table>
      <thead><tr><th>row</th><th>quantity</th><th>vs</th>
      <th>gap</th><th>class</th><th>why</th></tr></thead>
      <tbody>
{rows}
      </tbody>
    </table></div>
  </section>""")

census_rows = "\n".join(
    f"<tr><td><span class=\"gap gap-{html.escape(k)}\">"
    f"{html.escape(GAP_LABELS.get(k, k))}</span></td>"
    f"<td class=\"num\">{v}</td>"
    f"<td>{html.escape(closure_conditions.get(k, ''))}</td></tr>"
    for k, v in census.items()
    if v or k == "unexplained"
) if (closure_conditions := {
    e["gap_class"]: e.get("gap_closure_condition", "")
    for e in registry["entries"]
}) is not None else ""

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Benchmarks — dynamics — microcosm</title>
<meta name="description" content="The benchmark wall: every microcosm-dynamics estimate compared against SSA, Trustees, CBO, DYNASIM, and MINT published values, with every gap classified and explained. Gaps closing over certified runs is the progress record." />
<link rel="icon" type="image/svg+xml" href="/assets/policyengine-mark.svg" />
<meta name="theme-color" content="#FFFFFF" />
<link rel="stylesheet" href="/vendor/fonts/fonts.css" />
<link rel="stylesheet" href="/vendor/ui-kit-tokens.css" />
<link rel="stylesheet" href="/style.css" />
<style>
.bench-main {{ max-width: 74rem; margin: 0 auto; padding: 2rem 1.25rem 5rem; }}
.bench-tier {{ margin-top: 3rem; }}
.bench-tier h2 {{ font-size: 1.25rem; }}
.bench-tier .count {{ opacity: .55; font-size: .9em; margin-left: .4rem; }}
.tier-blurb {{ max-width: 46rem; opacity: .8; }}
.table-wrap {{ overflow-x: auto; border: 1px solid var(--border, #e5e7eb); border-radius: 10px; }}
table {{ border-collapse: collapse; width: 100%; font-size: .82rem; }}
th, td {{ padding: .5rem .7rem; text-align: left; vertical-align: top; border-top: 1px solid var(--border, #e5e7eb); }}
thead th {{ border-top: 0; font-weight: 600; font-size: .72rem; text-transform: uppercase; letter-spacing: .04em; opacity: .6; }}
td.num {{ white-space: nowrap; font-variant-numeric: tabular-nums; }}
td.rid {{ font-size: .7rem; opacity: .6; max-width: 11rem; overflow-wrap: anywhere; }}
td.note {{ max-width: 22rem; opacity: .8; }}
tr.row-unverified td {{ opacity: .55; }}
.gap {{ display: inline-block; padding: .1rem .5rem; border-radius: 999px; font-size: .68rem; white-space: nowrap; border: 1px solid var(--border, #d0d5dd); }}
.gap-label_mismatch {{ background: #FEF3C7; border-color: #FDE68A; }}
.gap-concept_mismatch {{ background: #EFF6FF; border-color: #BFDBFE; }}
.gap-unverified_source {{ background: #F3F4F6; }}
.gap-module_missing {{ background: #FCE7F3; border-color: #FBCFE8; }}
.gap-frame_no_alignment {{ background: #ECFDF5; border-color: #A7F3D0; }}
.gap-unexplained {{ background: #FEE2E2; border-color: #FCA5A5; }}
.bench-preamble {{ border-left: 3px solid var(--accent, #1E293B); padding: .2rem 0 .2rem 1rem; max-width: 46rem; }}
</style>
</head>
<body>
<div class="grain" aria-hidden="true"></div>

<header class="nav">
  <a class="brand" href="/"><span class="brand-dot" aria-hidden="true"></span>microcosm</a>
  <nav class="nav-links">
    <a href="/dynamics">dynamics</a>
    <a href="/dynamics/paper">paper</a>
    <a href="https://github.com/PolicyEngine/microcosm-dynamics/tree/master/benchmarks">source</a>
  </nav>
</header>

<main class="bench-main">
  <p class="strategy-crumb"><a href="/dynamics">dynamics</a> / benchmarks</p>
  <h1>The benchmark wall.</h1>
  <p class="strategy-lede">
    Every microcosm-dynamics estimate that an external model or agency also
    publishes, side by side, with the gap measured and classified. Large gaps
    are fine; unexplained gaps fail the build. As modules land and
    calibration activates, the gaps shrink on the record — this page is the
    progress tracker, regenerated from committed, referee-audited artifacts
    on every certified run.
  </p>
  <div class="bench-preamble">
    <p><strong>Read the labels first.</strong> Current estimates are
    frame-relative and carry the labor-income proxy label; they make no
    population-alignment claim, and only ratios, shares, trajectories, and
    orderings are ever compared — never absolute dollar levels. Rows in
    gray rest on sources we could not verify against publisher-controlled
    bytes and are excluded from the verified set.</p>
  </div>
{"".join(sections)}
  <section class="bench-tier">
    <h2>The gap ledger</h2>
    <p class="tier-blurb">Every gap class and what closes it. A row without
    a class, or a class of "unexplained," fails the repository's tests by
    law.</p>
    <div class="table-wrap"><table>
      <thead><tr><th>class</th><th>rows</th><th>closes when</th></tr></thead>
      <tbody>
{census_rows}
      </tbody>
    </table></div>
  </section>
  <p class="tier-blurb" style="margin-top:2.5rem">
    Canonical data: <a href="https://github.com/PolicyEngine/microcosm-dynamics/tree/master/benchmarks">benchmarks/</a>
    in the microcosm-dynamics repository — registry, append-only evaluation
    history, and the generated wall, each pinned by reproduction tests.
  </p>
</main>
</body>
</html>
"""
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(page)
print(f"wrote {OUT} ({len(page):,} bytes; "
      f"{sum(len(v) for v in by_tier.values())} rows)")
