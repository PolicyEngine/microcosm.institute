/* The microdata access map, rendered from ./registry.json — the registry is
   the single source of truth; no access claim is hand-typed into the page.
   Same best-effort pattern as sources.js: if the fetch fails, the noscript
   fallback text stands. */
(async function () {
  let reg;
  try {
    reg = await (await fetch("./registry.json", { cache: "no-store" })).json();
  } catch {
    return;
  }

  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  for (const tier of reg.tiers || []) {
    const mount = document.getElementById("tier-" + tier.id);
    if (!mount) continue;
    const lastCol = tier.columns === "model" ? "National model inside" : "Redistribution";
    const rows = (tier.rows || [])
      .map((r) => {
        const last =
          tier.columns === "model"
            ? `<td class="reg-mono">${esc(r.model || "—")}</td>`
            : `<td class="reg-mono reg-${esc(r.redistribution)}">${esc(r.redistribution)}</td>`;
        return `<tr>
          <td class="reg-country">${esc(r.country)}</td>
          <td>${esc(r.data)}</td>
          <td>${esc(r.terms)}</td>
          ${last}
          <td class="reg-src"><a href="${esc(r.url)}" rel="noopener">${esc(r.host)}</a></td>
        </tr>`;
      })
      .join("");
    mount.innerHTML = `<div class="reg-tablewrap"><table class="reg-table">
      <thead><tr><th>Country</th><th>Data</th><th>Terms</th><th>${lastCol}</th><th>Source</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  for (const el of document.querySelectorAll("[data-verified]")) el.textContent = reg.verified;
})();
