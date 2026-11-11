// Where the populace-us dataset repository on Hugging Face keeps the builds
// the home page shows. releases.js and contract.js find builds only through
// this file, so both follow the repository's layout the same way:
//
// - With releases.json at the repository root (the record that
//   microcosm-emitter's release writer keeps), each build is in its own
//   folder, releases/<release>/<build>/. The "latest" build is the current
//   build of the record's default release, and the local-area build is the
//   current build of microcosm-us-2024-local.
// - Without releases.json (the layout before the repository's switch),
//   latest.json names the latest build, and the newest -acs-local- tag names
//   the local-area build; their files are read in releases/<build>/ at main.
//
// Only a 404 for releases.json means the repository has none, and only when
// Hugging Face's X-Error-Code does not say that the repository or revision is
// missing (the calibration dashboard reads the record by the same rule). Any
// other failure rejects, so the page never falls back to the old layout's
// builds because a request failed: the sections that need a build stay hidden.
window.microcosmUsReleases = (() => {
  const FILES =
    "https://huggingface.co/datasets/policyengine/populace-us/resolve/main/";
  const REFS = "https://huggingface.co/api/datasets/policyengine/populace-us/refs";
  const RECORD_PATH = "releases.json";
  const RECORD_SCHEMA_VERSION = 1;
  const LOCAL_AREA_RELEASE = "microcosm-us-2024-local";
  const MISSING_REPOSITORY_OR_REVISION = ["RepoNotFound", "RevisionNotFound"];
  // The release and build names the release writer accepts (the dashboard's
  // reader checks the same pattern). A name that does not match is not
  // shown, and no URL or page text is built from it.
  const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
  const isSafeName = (value) => typeof value === "string" && SAFE_NAME.test(value);
  // A build's folder in either layout: releases/<build>/ or
  // releases/<release>/<build>/, each segment a safe name.
  const SAFE_FOLDER = /^releases\/(?:[A-Za-z0-9][A-Za-z0-9._-]{0,127}\/){1,2}$/;

  const fileUrl = (path) => FILES + path;
  const isObject = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const hasOwn = (object, key) =>
    Object.prototype.hasOwnProperty.call(object, key);

  const getJSON = async (url) => {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    return res.json();
  };

  // The parsed releases.json, or null when the repository has none.
  const fetchRecord = async () => {
    const res = await fetch(fileUrl(RECORD_PATH), { cache: "no-store" });
    const errorCode = res.headers.get("x-error-code");
    if (
      res.status === 404 &&
      !MISSING_REPOSITORY_OR_REVISION.includes(errorCode)
    ) {
      return null;
    }
    if (!res.ok) throw new Error(String(res.status));
    const record = await res.json();
    if (
      !isObject(record) ||
      record.schema_version !== RECORD_SCHEMA_VERSION ||
      !isObject(record.releases)
    ) {
      throw new Error("unreadable " + RECORD_PATH);
    }
    return record;
  };
  // One request per page load, shared by every script that asks.
  let recordRequest = null;
  const releasesRecord = () =>
    recordRequest || (recordRequest = fetchRecord());

  // A release's current build in the record, or null when the release is not
  // listed or has no current build. The release writer never makes a
  // withdrawn build current; one that is withdrawn is not shown either.
  const currentBuild = (record, release) => {
    if (!isSafeName(release) || !hasOwn(record.releases, release)) {
      return null;
    }
    const entry = record.releases[release];
    const build = isObject(entry) ? entry.current : null;
    if (!isSafeName(build) || !isObject(entry.builds)) return null;
    const buildEntry = hasOwn(entry.builds, build) ? entry.builds[build] : null;
    if (!isObject(buildEntry) || buildEntry.withdrawn) return null;
    const folder = "releases/" + release + "/" + build + "/";
    return {
      id: build,
      folder,
      buildManifest: folder + "build_manifest.json",
      publishedAt: buildEntry.published_at,
    };
  };

  // The build the "latest" row and the coverage contract show:
  // { id, folder, buildManifest, publishedAt }, or null when there is none.
  const latestBuild = async () => {
    const record = await releasesRecord();
    if (record) return currentBuild(record, record.default);

    const latest = await getJSON(fileUrl("latest.json"));
    if (!isSafeName(latest.release_id)) return null;
    const path = (latest.paths && latest.paths.build_manifest) || null;
    const folder = typeof path === "string" ? path.replace(/[^/]*$/, "") : null;
    const safe = folder !== null && SAFE_FOLDER.test(folder) &&
      path === folder + "build_manifest.json";
    return {
      id: latest.release_id,
      folder: safe ? folder : null,
      buildManifest: safe ? path : null,
      publishedAt: latest.updated_at,
    };
  };

  // The build the local-area row shows, in the same form, or null.
  const localAreaBuild = async () => {
    const record = await releasesRecord();
    if (record) return currentBuild(record, LOCAL_AREA_RELEASE);

    // Old layout: list tags from the public refs API, keep the -acs-local-
    // builds and pick the newest by the trailing ...-YYYYMMDDThhmmssZ
    // segment; a lexicographic compare of that segment orders the
    // timestamps chronologically.
    const refs = await getJSON(REFS);
    const localTags = (refs.tags || [])
      .map((tag) => tag && tag.name)
      .filter((name) => isSafeName(name) && name.includes("-acs-local-"));
    if (!localTags.length) return null;
    const trailing = (name) => name.split("-").pop();
    const id = localTags.reduce((newest, name) =>
      trailing(name) > trailing(newest) ? name : newest
    );
    const folder = "releases/" + id + "/";
    return {
      id,
      folder,
      buildManifest: folder + "build_manifest.json",
      publishedAt: null,
    };
  };

  return { fileUrl, latestBuild, localAreaBuild };
})();
