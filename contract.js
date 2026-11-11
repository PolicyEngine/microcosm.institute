// Live coverage contract. Reads the populace-us input-coverage manifest for the
// latest release and renders the required / reviewed-exclusion counts, the gate,
// and the full exclusion list with reasons. Like releases.js, this renders real
// registry data or nothing: the live region stays hidden unless the manifest
// loads, so the page cannot go stale. The latest build, and its folder, come
// from us-releases.js: releases.json where the repository has one, else
// latest.json.
//
// Fetch strategy, in order:
//   1) raw.githubusercontent.com at the commit where the build's input columns
//      were checked, where the manifest is a source file (COV_PATHS: its path
//      now, and before the package was renamed from populace-build). It is
//      present at every build's commit, so the counts update automatically as
//      each new release pins a newer commit — no code change. The commit is the
//      build manifest's code.git_commit, else its build_sha. Only when the
//      build has no build manifest path, or its manifest records no commit, is
//      it the commit hash in the release id (e.g. ...-75d5add-<timestamp>); a
//      manifest that cannot be read hides the section. For a source
//      enrichment, which runs no input-coverage check of its own, it is its
//      parent build's commit, from parent_build_manifest.json in its folder.
//   2) fall back to an in-release copy, if a future build publishes
//      release_input_coverage_manifest.json next to the other manifests.
// (1) is primary because it always exists at the build's commit; the
// release-directory copy is only a safety net.
(async () => {
  const releases = window.microcosmUsReleases;
  const RAW = "https://raw.githubusercontent.com/PolicyEngine/microcosm/";
  const GH_BLOB = "https://github.com/PolicyEngine/microcosm/blob/";
  // The manifest's path in the source tree, newest first: builds made before
  // the package was renamed from populace-build (such as the parent of
  // today's SPM enrichment, at cae8640f9) have it at the second path.
  const COV_PATHS = [
    "packages/microcosm-build/src/microcosm/build/us/release_input_coverage_manifest.json",
    "packages/populace-build/src/populace/build/us/release_input_coverage_manifest.json",
  ];
  const COV_FILE = "release_input_coverage_manifest.json";

  const live = document.getElementById("contract-live");
  if (!live) return;
  const slot = (name) => live.querySelector(`[data-slot="${name}"]`);

  const getJSON = async (url) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  };

  const COMMIT_RE = /^[0-9a-f]{7,40}$/;
  // The commit a build manifest records: code.git_commit, or build_sha.
  const commitFromBuildManifest = (bm) => {
    const candidates = [bm && bm.code && bm.code.git_commit, bm && bm.build_sha];
    return candidates.find((value) => COMMIT_RE.test(String(value || ""))) || null;
  };
  // The build sha is the last 7–40 char hex segment of the release id, sitting
  // just before the trailing ...T......Z timestamp segment. A segment of digits
  // only is a date such as 20260915, not a commit, so it is skipped.
  const shaFromReleaseId = (rid) => {
    const segs = String(rid || "").split("-");
    for (let i = segs.length - 1; i >= 0; i--) {
      if (COMMIT_RE.test(segs[i]) && !/^[0-9]+$/.test(segs[i])) return segs[i];
    }
    return null;
  };

  const escapeHtml = (text) =>
    String(text).replace(
      /[<>&"']/g,
      (ch) =>
        ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[ch])
    );

  const issueUrl = (ref) => {
    // "PolicyEngine/microcosm#38" -> repo issue URL + "#38" label
    const m = String(ref || "").match(/^([\w.-]+\/[\w.-]+)#(\d+)$/);
    if (!m) return null;
    return { href: `https://github.com/${m[1]}/issues/${m[2]}`, label: `#${m[2]}` };
  };

  let manifest = null;
  let releaseId = "";
  let checkedIn = "";
  let sourceHref = "";
  try {
    const build = await releases.latestBuild();
    if (!build) return;
    releaseId = build.id || "";

    // (1) source tree at the commit the build was made from
    let sha = null;
    let buildManifest = null;
    if (build.buildManifest) {
      // A build manifest that cannot be read hides the section (the catch
      // below): without it the page cannot tell a source enrichment, and a
      // commit guessed from the build id could name the wrong manifest.
      buildManifest = await getJSON(releases.fileUrl(build.buildManifest));
    }
    if (buildManifest && buildManifest.release_type === "source_enrichment") {
      // A source enrichment adds columns to its parent build's dataset and runs
      // no input-coverage check of its own: the dataset's inputs were checked
      // when the parent was built, so the parent's commit names the manifest
      // that applies. Its folder carries the parent's build manifest. Without
      // it the section stays hidden; the enrichment's own commit, or a guess
      // from its id, would name the wrong manifest.
      if (!build.folder) return;
      const parent = await getJSON(
        releases.fileUrl(build.folder + "parent_build_manifest.json")
      );
      sha = commitFromBuildManifest(parent);
      if (!sha) return;
      if (typeof parent.build_id === "string") checkedIn = parent.build_id;
    } else {
      sha = commitFromBuildManifest(buildManifest) || shaFromReleaseId(releaseId);
    }
    if (sha) {
      for (const path of COV_PATHS) {
        try {
          manifest = await getJSON(RAW + sha + "/" + path);
          sourceHref = GH_BLOB + sha + "/" + path;
          break;
        } catch (_) {
          manifest = null;
        }
      }
    }
    // (2) safety net: an in-release copy, if a future build publishes one
    if (!manifest) {
      if (!build.folder) return;
      const url = releases.fileUrl(build.folder + COV_FILE);
      manifest = await getJSON(url);
      sourceHref = url;
    }
  } catch (_) {
    return; // best-effort, like releases.js
  }
  if (!manifest || !manifest.columns) return;

  const cols = manifest.columns;
  const names = Object.keys(cols);

  // counts: trust the manifest's own block, else derive from the columns
  const c = manifest.counts || {};
  const total = c.total != null ? c.total : names.length;
  const required =
    c.required != null
      ? c.required
      : names.filter((n) => cols[n].status === "required").length;
  const excluded =
    c.reviewed_exclusion != null
      ? c.reviewed_exclusion
      : names.filter((n) => cols[n].status === "reviewed_exclusion").length;

  const setText = (name, v) => {
    const el = slot(name);
    if (el) el.textContent = v;
  };
  setText("total", total.toLocaleString("en-US"));
  setText("required", required.toLocaleString("en-US"));
  setText("excluded", excluded.toLocaleString("en-US"));

  // gate line — name the gate (pulled live from the manifest description) and the
  // count it checks. The mechanism, stated once more next to the live number.
  let gateName = "release_input_coverage";
  const gm = String(manifest.description || "").match(
    /release gate \(([^)]+)\)/
  );
  if (gm) gateName = gm[1].split(".").pop();
  const gateEl = slot("gate");
  if (gateEl) {
    gateEl.textContent =
      `gate ${gateName} · checks all ${total.toLocaleString("en-US")} ` +
      `declared input columns at build time · a required column missing or ` +
      `all-default fails the release`;
  }

  // exclusion list — every reviewed exclusion, its reason, and its tracked issue
  const excl = names
    .filter((n) => cols[n].status === "reviewed_exclusion")
    .sort();
  const table = slot("table");
  if (table && excl.length) {
    const rows = excl.map((n) => {
      const e = cols[n];
      const iss = issueUrl(e.issue);
      const link = iss
        ? `<a class="contract-excl-issue mono" href="${iss.href}" target="_blank" rel="noopener">${iss.label}</a>`
        : "";
      const reason = escapeHtml(e.reason || e.note || "");
      return (
        `<div class="contract-excl-row">` +
        `<div class="contract-excl-head"><span class="contract-excl-col mono">${escapeHtml(n)}</span>${link}</div>` +
        `<p class="contract-excl-reason">${reason}</p>` +
        `</div>`
      );
    });
    table.innerHTML = rows.join("");
  }
  const summary = slot("summary");
  if (summary)
    summary.textContent = `Show all ${excluded.toLocaleString(
      "en-US"
    )} reviewed exclusions and their reasons`;

  // provenance
  const source = slot("source");
  if (source) {
    // Built from DOM nodes, so no downloaded text is read as HTML.
    const link = document.createElement("a");
    link.href = sourceHref;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = COV_FILE;
    let label = releaseId ? ` · ${releaseId}` : "";
    if (checkedIn) label += ` · inputs checked in ${checkedIn}`;
    source.replaceChildren("Coverage contract read live from ", link, label);
  }

  live.hidden = false;
})();
