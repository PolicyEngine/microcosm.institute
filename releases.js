// Live release strip. Reads the populace-us release registry (Hugging Face)
// and the policyengine.py bundle manifest. Each row stays hidden unless its
// source loads — the strip renders real registry data or nothing. Which
// builds the latest and local rows show, and where their files are, comes
// from us-releases.js: releases.json where the repository has one, else
// latest.json and the -acs-local- tags.
(async () => {
  const PY_MANIFEST =
    "https://raw.githubusercontent.com/PolicyEngine/policyengine.py/main/src/policyengine/data/bundle/manifest.json";
  const releases = window.microcosmUsReleases;

  const day = (iso) => (typeof iso === "string" ? iso.slice(0, 10) : "");
  const getJSON = async (url) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  };
  const show = (rowId, id, meta) => {
    const row = document.getElementById(rowId);
    if (!row || !id) return;
    row.querySelector('[data-slot="id"]').textContent = id;
    row.querySelector('[data-slot="meta"]').textContent = meta;
    row.hidden = false;
  };

  try {
    const build = await releases.latestBuild();
    if (!build) throw new Error("no current build");
    let meta = day(build.publishedAt);
    try {
      if (!build.buildManifest) throw new Error("no build manifest");
      const bm = await getJSON(releases.fileUrl(build.buildManifest));
      const def = (bm.dataset && bm.dataset.default) || {};
      const cal = (bm.gates && bm.gates.calibration) || {};
      const bits = [day(bm.created_at) || day(build.publishedAt)];
      if (def.n_exported_households)
        bits.push(def.n_exported_households.toLocaleString("en-US") + " households");
      const loss = def.final_loss ?? cal.final_loss;
      if (typeof loss === "number") bits.push("calibration loss " + loss.toFixed(3));
      if (typeof cal.fraction_within_10pct === "number")
        bits.push(Math.round(cal.fraction_within_10pct * 100) + "% of targets within 10%");
      meta = bits.join(" · ");
    } catch (_) {}
    show("release-row-latest", build.id, meta);
  } catch (_) {}

  try {
    const manifest = await getJSON(PY_MANIFEST);
    const us = manifest.data_releases && manifest.data_releases.us;
    if (us && us.build_id) {
      const cert = us.certification || {};
      const bits = ["policyengine.py " + (manifest.bundle_version || "")];
      if (cert.certified_for_model_version)
        bits.push("policyengine-us " + cert.certified_for_model_version);
      show("release-row-certified", us.build_id, bits.join(" · "));
    }
  } catch (_) {}

  // Local-area (non-default) row. Same cannot-go-stale contract as the rows
  // above: find the local-area build, then read its published manifests. If
  // no local build is published, or a manifest is missing, the row and its
  // note stay hidden.
  try {
    const build = await releases.localAreaBuild();
    if (!build) throw new Error("no local build");
    const fileUrl = (name) => releases.fileUrl(build.folder + name);
    const rm = await getJSON(fileUrl("release_manifest.json"));
    const gs = await getJSON(fileUrl("gate_summary.json"));
    const cal = (gs.gates && gs.gates.calibration) || {};

    const bits = [];
    // A build-folder release manifest records built_at at its top level (its
    // `build` is the build's name); a tagged one, in its `build` object.
    const builtAt =
      rm.built_at || (rm.build && rm.build.built_at) || build.publishedAt;
    const date = day(builtAt || "");
    if (date) bits.push(date);
    // household count is the export record count; the two manifests above don't
    // carry it directly, so read it from the release's calibration diagnostics.
    try {
      const cd = await getJSON(fileUrl("calibration_diagnostics.json"));
      const n =
        (cd.target_surface && cd.target_surface.n_records) ?? cd.n_records;
      if (typeof n === "number")
        bits.push(n.toLocaleString("en-US") + " households");
    } catch (_) {}
    if (typeof cal.n_targets === "number")
      bits.push(cal.n_targets.toLocaleString("en-US") + " targets");
    if (typeof cal.fraction_within_10pct === "number")
      bits.push(
        Math.round(cal.fraction_within_10pct * 100) + "% of targets within 10%"
      );

    show("release-row-local", build.id, bits.join(" · "));
    const note = document.getElementById("release-local-note");
    if (note) note.hidden = false;
  } catch (_) {}
})();
