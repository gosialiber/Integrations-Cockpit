/* Reiter «Muster – Was hilft?» (Level 2): Erfolgsquoten pro Gruppe, faire Messung, Datenschutz n < 5.
 * Keine Personenlisten, keine Scores, keine Wahrscheinlichkeiten pro Person.
 */
(function () {
  "use strict";
  const C = window.Cockpit;
  const { t } = C.i18n;
  const Pm = C.patterns;

  const ui = { goal: 1, measure: "m24", factor: "firstCourse" };
  const MEASURES = { deadline: { type: "deadline" }, m12: { type: "months", months: 12 }, m24: { type: "months", months: 24 }, m36: { type: "months", months: 36 } };
  const NEED = { 1: ["klient", "asylgeschaeft", "sprachstand"], 2: ["klient", "asylgeschaeft", "erwerb", "foerderung"], 3: ["klient", "asylgeschaeft", "finanz"] };
  const { esc } = C.util;
  const pct = (x) => Math.round(x * 100);

  // Beschriftung eines Gruppen-Codes: «@…» übersetzen, sonst Wert aus den Daten (Bindestrich → Halbgeviertstrich)
  const groupLabel = (code, tf = t) => (String(code).startsWith("@") ? tf("pg." + code.slice(1)) : String(code).replace(/(\d)-(\d)/g, "$1–$2"));
  const factorLabel = (id, tf = t) => tf("f." + id);
  const measureLabel = (key, tf = t) => (key === "deadline" ? tf("mu.m.deadline") : tf("mu.m.months", { n: MEASURES[key].months }));

  let cache = { key: null, res: null };
  function result() {
    const L = C.state.loaded;
    const key = [Object.values(L).map((s) => s.fileName + s.rows.length).join("|"), C.state.stichtag, ui.goal, ui.measure].join("#");
    if (cache.key !== key) cache = { key, res: Pm.analyze(L, C.state.stichtag, ui.goal, MEASURES[ui.measure]) };
    return cache.res;
  }

  // ---------- Balken ----------
  /* Eine Zeile pro Gruppe: Balken der Quote, gestrichelte Linie = Gesamtquote.
   * Über der Gesamtquote in Zielfarbe, darunter grau. Ausgeblendete Gruppen ohne Zahlen. */
  function rateRow(label, g, overall) {
    if (g.hidden) return `<div class="rrow"><span class="rlabel">${esc(label)}</span><span class="rhidden">${t("mu.hidden")}</span><span></span></div>`;
    const cls = g.rate >= overall ? `g${ui.goal}` : "below";
    const W = 300;
    return `<div class="rrow"><span class="rlabel">${esc(label)}</span>
      <svg class="rbar" viewBox="0 0 ${W} 16" preserveAspectRatio="none" role="img" aria-label="${esc(label)}: ${pct(g.rate)} %, n = ${g.n}">
        <rect class="track" x="0" y="2" width="${W}" height="12" rx="2"></rect>
        <rect class="${cls}" x="0" y="2" width="${(g.rate * W).toFixed(1)}" height="12" rx="2"></rect>
        <line class="overall" x1="${(overall * W).toFixed(1)}" x2="${(overall * W).toFixed(1)}" y1="0" y2="16"></line>
      </svg>
      <span class="rval">${t("mu.rateN", { rate: pct(g.rate), n: g.n })}</span></div>`;
  }

  // ---------- Abschnitte ----------
  function factorChips(res) {
    const groups = ["tables", "support", "ai"];
    return groups.map((g) => {
      const fs = res.factors.filter((f) => f.group === g);
      if (g === "ai" && !fs.length) return `<div class="chips"><span class="chip-title">${t("mu.fg.ai")}</span><span class="muted small">${t("mu.aiHint")}</span></div>`;
      return `<div class="chips"><span class="chip-title">${t("mu.fg." + g)}</span>${fs.map((f) =>
        `<button type="button" class="chip ${ui.factor === f.id ? "on" : ""}" data-f="${f.id}" aria-pressed="${ui.factor === f.id}">${esc(factorLabel(f.id))}</button>`).join("")}</div>`;
    }).join("");
  }

  function factorChart(res) {
    const f = res.factors.find((x) => x.id === ui.factor) || res.factors[0];
    if (!f) return "";
    ui.factor = f.id;
    const overall = res.summary.rate;
    return `<section class="card-sec">
      <h3>${esc(factorLabel(f.id))}${ui.goal === 3 && !["hhWorkers", "hhSize", "kidsU4"].includes(f.id) ? ` <small class="muted">(${t("mu.hhHead")})</small>` : ""}</h3>
      <div class="rrows">${f.groups.map((g) => rateRow(groupLabel(g.code), g, overall)).join("")}</div>
      <p class="muted small"><span class="dash"></span> ${t("mu.overallLine", { rate: pct(overall) })} · ${t("mu.causal")}</p>
    </section>`;
  }

  function stratSection(res) {
    if (!res.strat.length) return "";
    const overall = res.summary.rate;
    const block = (s) => {
      const isCourse = s.id === "course";
      const aLabel = isCourse ? groupLabel("@le3") : t("pg.yes");
      const bLabel = isCourse ? groupLabel("@gt12m") : t("pg.no");
      const rows = s.rows.map((r) => `<div class="pair">
          <div class="pair-title">${t(isCourse ? "mu.strat.schoolGroup" : "mu.strat.workGroup", { g: groupLabel(r.stratum) })}</div>
          ${rateRow(aLabel, r.a, overall)}${rateRow(bLabel, r.b, overall)}
        </div>`).join("");
      return `<h4>${t(isCourse ? "mu.strat.course" : "mu.strat.bridge")}</h4>${rows || `<p class="muted">${t("mu.top.none")}</p>`}`;
    };
    return `<section class="card-sec">
      <h3>${t("mu.strat.title")}</h3>
      <p class="muted small">${t("mu.strat.intro")}</p>
      ${res.strat.map(block).join("")}
      <p class="muted small"><span class="dash"></span> ${t("mu.overallLine", { rate: pct(overall) })} · ${t("mu.causal")}</p>
    </section>`;
  }

  function topSection(res) {
    const s = res.top.map((x) => `<li>${esc(t("mu.top.sentence", { factor: factorLabel(x.factorId), group: groupLabel(x.code), rate: pct(x.rate), n: x.n, overall: pct(res.summary.rate) }))}</li>`).join("");
    return `<section class="card-sec">
      <h3>${t("mu.top.title")}</h3>
      ${s ? `<ol class="top">${s}</ol>` : `<p class="muted">${t("mu.top.none")}</p>`}
      <p class="muted small">${t("mu.causal")}</p>
    </section>`;
  }

  // ---------- Export ----------
  function exportXlsx(res) {
    const de = (k, v) => C.i18n.tIn("de", k, v);
    const wb = XLSX.utils.book_new();
    const add = (aoa, name, widths) => {
      const ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = widths.map((w) => ({ wch: w }));
      // Blattnamen: max. 31 Zeichen, ohne : \ / ? * [ ]
      let n = name.replace(/[:\\/?*[\]]/g, "-").slice(0, 31), i = 2;
      while (wb.SheetNames.includes(n)) n = `${name.slice(0, 28)} ${i++}`;
      XLSX.utils.book_append_sheet(wb, ws, n);
    };
    const s = res.summary, M = MEASURES[ui.measure];
    add([
      ["Ziel", de(`z${ui.goal}.title`)], ["Messung", measureLabel(ui.measure, de)],
      ["Stichtag", { t: "n", v: Date.UTC(...C.state.stichtag.split("-").map((x, i) => (i === 1 ? x - 1 : +x))) / 864e5 + 25569, z: "dd.mm.yyyy" }],
      ["Erfolg", M.type === "deadline" ? de("mu.base.deadline") : de("mu.base.months", { n: M.months })],
      ["Basis n", s.n], ["Einheit", de(s.unit === "household" ? "mu.households" : "mu.persons")],
      ["Einreise von", s.entryFrom ? C.util.fmtDate(s.entryFrom) : ""], ["Einreise bis", s.entryTo ? C.util.fmtDate(s.entryTo) : ""],
      ["Gesamtquote", { t: "n", v: s.rate, z: "0%" }], [],
      [de("mu.principle")], [de("mu.causal")], [de("mu.privacy")],
    ], "Basis", [16, 90]);
    for (const f of res.factors) {
      add([["Gruppe", "n", "erreicht", "Quote", "Differenz zur Gesamtquote (Prozentpunkte)"],
        ...f.groups.map((g) => (g.hidden ? [groupLabel(g.code, de), de("mu.hidden")]
          : [groupLabel(g.code, de), g.n, g.reached, { t: "n", v: g.rate, z: "0%" }, Math.round(g.diff * 100)]))],
        factorLabel(f.id, de), [40, 8, 10, 8, 40]);
    }
    XLSX.writeFile(wb, `Muster_Ziel${ui.goal}_${C.state.stichtag}.xlsx`);
  }

  // ---------- Zeichnen ----------
  function render(el) {
    const { $ } = C.util;
    const L = C.state.loaded;
    const head = `<h2>${t("mu.title")}</h2><p class="principle">${t("mu.principle")}</p>`;
    if (!L.klient) { el.innerHTML = `${head}<p class="placeholder">${t("needData")}</p>`; return; }
    const res = result();
    const missing = NEED[ui.goal].filter((id) => !L[id]);
    const s = res.summary;
    const M = MEASURES[ui.measure];
    const goalBtn = (n) => `<button type="button" data-goal="${n}" class="${ui.goal === n ? "on" : ""}" aria-pressed="${ui.goal === n}">${t("tab.ziel" + n)}</button>`;

    el.innerHTML = `
      <div class="head-row">
        <div>${head}</div>
        <div class="controls">
          <div class="seg" role="group" aria-label="${t("mu.goal")}">${[1, 2, 3].map(goalBtn).join("")}</div>
          <label>${t("mu.measure")} <select id="mu-measure">${Object.keys(MEASURES).map((k) => `<option value="${k}" ${ui.measure === k ? "selected" : ""}>${esc(measureLabel(k))}</option>`).join("")}</select></label>
          <label>${t("stichtag")} <input id="mu-date" type="date" value="${C.state.stichtag}"></label>
          <button id="mu-export" type="button" class="primary" ${s.enough ? "" : "disabled"}>${t("mu.export")}</button>
        </div>
      </div>
      ${missing.length ? `<p class="tissue">${t("ck.missingTables")}: ${missing.map((id) => esc(C.TABLES.find((x) => x.id === id).name)).join(", ")}</p>` : ""}
      <p class="base"><b>${t("mu.base", { n: s.n, unit: t(s.unit === "household" ? "mu.households" : "mu.persons"), from: s.entryFrom ? s.entryFrom.slice(0, 4) : "–", to: s.entryTo ? s.entryTo.slice(0, 4) : "–" })}</b>
        ${M.type === "deadline" ? t("mu.base.deadline") : t("mu.base.months", { n: M.months })}
        ${s.enough ? `${t("mu.overall")}: <b>${pct(s.rate)} %</b>.` : ""}</p>
      ${!s.enough ? `<p class="placeholder">${t("mu.emptyBase")}</p>` : `
        ${factorChips(res)}
        ${factorChart(res)}
        ${stratSection(res)}
        ${topSection(res)}
        <p class="muted small">${t("mu.privacy")}</p>`}`;

    el.querySelectorAll(".seg button[data-goal]").forEach((b) => b.addEventListener("click", () => { ui.goal = +b.dataset.goal; C.render(); }));
    $("#mu-measure", el).addEventListener("change", (e) => { ui.measure = e.target.value; C.render(); });
    $("#mu-date", el).addEventListener("change", (e) => { if (e.target.value) { C.state.stichtag = e.target.value; C.render(); } });
    $("#mu-export", el).addEventListener("click", () => exportXlsx(res));
    el.querySelectorAll(".chip[data-f]").forEach((b) => b.addEventListener("click", () => { ui.factor = b.dataset.f; C.render(); }));
  }

  C.views.muster = { render };
})();
