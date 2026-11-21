/* Reiter «Cockpit» (Startseite): alle drei Ziele auf einen Blick.
 *   1. Kennzahlen (klickbar → filtern die Anrufliste)
 *   2. Anrufliste «Wen rufe ich diese Woche an, und warum?»
 *   3. Matrix Klient:in × Ziel
 *   4. Übersicht pro Fallführung und Einreisejahr (Datenschutz: n < 5 ausgeblendet)
 *   5. Export nach Excel
 * Es gibt keine Benutzerrollen: «Fallführung» ist ein Filter, kein Login.
 * Namen sind in den Exporten nicht enthalten; angezeigt werden nur Nummern.
 */
(function () {
  "use strict";
  const C = window.Cockpit;
  const { t } = C.i18n;
  const K = C.cockpit;

  const ui = { cm: "", kind: "", expanded: false, mq: "", mAction: false, mSort: { col: "action", dir: 1 } };
  const LIMIT = 20;
  const LIGHT_ORDER = { red: 0, yellow: 1, green: 2, grey: 3 };
  const STATE_CLS = { reached: "green", open: "yellow", risk: "red", missed: "red", late: "red", na: "grey" };

  // ---------- Testdaten im Browser erzeugen (tools/generator.js, gleicher Weg wie echte Dateien) ----------
  function loadTestData() {
    const G = C.generator;
    const [y, m, d] = C.state.stichtag.split("-").map(Number);
    const out = G.generate({ today: [y, m, d] });
    C.state.loaded = {}; C.state.unrecognised = []; C.state.done.clear();
    for (const id in out.tables) {
      const buf = XLSX.write(G.toWorkbook(id, out.tables[id]), { type: "array", bookType: "xlsx" });
      for (const s of C.parse.readWorkbook(XLSX.read(buf, { type: "array" }), G.fileName(id))) if (s.recognised) C.state.loaded[s.table.id] = s;
    }
    C.state.source = "test";
    C.render();
  }

  // ---------- Berechnung (zwischengespeichert pro Daten + Stichtag) ----------
  let cache = { key: null, model: null };
  function model() {
    const L = C.state.loaded;
    const key = [Object.values(L).map((s) => s.fileName + s.rows.length).join("|"), C.state.stichtag].join("#");
    if (cache.key !== key) cache = { key, model: K.evaluate(L, C.state.stichtag) };
    return cache.model;
  }

  // ---------- Bausteine ----------
  const { esc } = C.util;
  const fmt = (iso) => C.util.fmtDate(iso);
  const goalTag = (no) => `<span class="gtag g${no}">${t("ck.goal", { n: no })}</span>`;
  const idLabel = (x) => (x.unit === "household"
    ? `<b>${esc(x.h.dossierNo)}</b><br><span class="muted">${t("ck.mainMember")}: ${esc(x.p.clientNo)} · ${t("members", { n: x.h.members.length })}</span>`
    : `<b>${esc(x.p.clientNo)}</b>`);
  const reasonsText = (list, tf = t) => list.map((r) => tf(r.key, r.vars)).join(" ");
  function kindLight(x) {
    if (x.kind === "red") return C.charts.light("red", t("s.risk"));
    if (x.kind === "report") return C.charts.light("green", t("ck.kind.report"));
    return `<span class="light warn"><i aria-hidden="true">!</i>${esc(t("q.label"))}</span>`;
  }

  function kpiTiles(k) {
    const tile = (kind, n, label, cls) => `<button type="button" class="kpi ${cls} ${ui.kind === kind ? "sel" : ""}" data-kind="${kind}" aria-pressed="${ui.kind === kind}" title="${t("ck.k.filterHint")}"><b>${n}</b><span>${label}</span></button>`;
    return `<div class="kpis">
      ${tile("", k.act, t("ck.k.act"), "")}
      ${tile("red", k.red, t("ck.k.red"), "red")}
      ${tile("report", k.report, t("ck.k.report"), "accent")}
      ${tile("quality", k.quality, t("ck.k.quality"), "warn")}
    </div>`;
  }

  function callListSection(items) {
    const list = items.filter((x) => !ui.kind || x.kind === ui.kind);
    const shown = ui.expanded ? list : list.slice(0, LIMIT);
    const showCM = !ui.cm;
    const rows = shown.map((x) => {
      const done = C.state.done.has(x.key);
      return `<li class="call ${done ? "done" : ""}">
        <div class="c-light">${kindLight(x)}</div>
        <div class="c-id">${idLabel(x)}</div>
        <div class="c-goal">${x.goals.map(goalTag).join(" ")}</div>
        <div class="c-text">${esc(reasonsText(x.reasons))}</div>
        <div class="c-meta">${x.deadline ? `<span class="muted">${t("ck.deadline")}</span> ${fmt(x.deadline)}` : ""}${showCM ? `<br><span class="muted">${esc(x.caseManager || "")}</span>` : ""}</div>
        <div class="c-act"><button type="button" class="done-btn" data-key="${esc(x.key)}" aria-pressed="${done}">${done ? t("ck.undo") : "✓ " + t("ck.done")}</button></div>
      </li>`;
    }).join("");
    const more = list.length > LIMIT
      ? `<button type="button" id="ck-more" class="link">${ui.expanded ? t("ck.call.less") : t("ck.call.more", { n: list.length - LIMIT })}</button>` : "";
    return `<section>
      <h3>${t("ck.call.title")}</h3>
      ${list.length ? `<ol class="calls">${rows}</ol>${more}` : `<p class="muted">${t("ck.call.empty")}</p>`}
    </section>`;
  }

  // ---------- Matrix ----------
  function matrixSection(rows) {
    const q = ui.mq.trim();
    const lightKey = (g) => (g ? LIGHT_ORDER[g.light] : 9);
    const sorters = {
      client: (r) => r.p.clientNo, status: (r) => r.p.status || "", cm: (r) => r.p.caseManager || "",
      g1: (r) => lightKey(r.g1), g2: (r) => lightKey(r.g2), g3: (r) => lightKey(r.g3),
      action: (r) => (r.action ? 0 : 1) * 10 + Math.min(lightKey(r.g1), lightKey(r.g2), lightKey(r.g3)),
    };
    const f = sorters[ui.mSort.col];
    const list = rows
      .filter((r) => !ui.mAction || r.action)
      .filter((r) => !q || String(r.p.clientNo).includes(q) || String(r.p.zemis).includes(q) || String(r.p.dossierNo).includes(q))
      .sort((a, b) => { const x = f(a), y = f(b); return (x < y ? -1 : x > y ? 1 : 0) * ui.mSort.dir || String(a.p.clientNo).localeCompare(String(b.p.clientNo)); });
    const th = (col, label) => `<th><button type="button" class="sort" data-col="${col}" aria-sort="${ui.mSort.col === col ? (ui.mSort.dir > 0 ? "ascending" : "descending") : "none"}">${label}${ui.mSort.col === col ? (ui.mSort.dir > 0 ? " ▲" : " ▼") : ""}</button></th>`;
    const cell = (g, no, r) => {
      if (!g) return `<td><span class="muted">–</span></td>`;
      const q = no === 3 && r.h ? r.h.dossierNo : r.p.clientNo;
      return `<td><button type="button" class="lightbtn" data-goal="${no}" data-q="${esc(q)}" title="${esc(reasonsText(g.reasons))}">${C.charts.light(STATE_CLS[g.state], t("s." + g.state))}</button></td>`;
    };
    return `<section>
      <h3>${t("ck.mx.title")}</h3>
      <div class="filters">
        <input id="ck-mq" type="search" placeholder="${t("ck.mx.search")}" value="${esc(ui.mq)}">
        <label><input id="ck-maction" type="checkbox" ${ui.mAction ? "checked" : ""}> ${t("ck.mx.onlyAction")}</label>
        <span class="muted small">${t("ck.mx.count", { n: list.length })} · ${t("ck.mx.hint")}</span>
      </div>
      <div class="scroll tall"><table>
        <thead><tr>${th("client", t("c.clientNo"))}${th("status", t("c.status"))}${th("cm", t("c.cm"))}${th("g1", t("tab.ziel1"))}${th("g2", t("tab.ziel2"))}${th("g3", t("tab.ziel3"))}${th("action", t("ck.mx.action"))}</tr></thead>
        <tbody>${list.map((r) => `<tr>
          <td><b>${esc(r.p.clientNo)}</b></td><td>${esc(r.p.status)}</td><td>${esc(r.p.caseManager)}</td>
          ${cell(r.g1.applicable ? r.g1 : null, 1, r)}${cell(r.g2.applicable ? r.g2 : null, 2, r)}${cell(r.g3, 3, r)}
          <td>${r.action ? `<span class="tag accent">${t("ck.mx.yes")}</span>` : ""}</td>
        </tr>`).join("")}</tbody>
      </table></div>
    </section>`;
  }

  // ---------- Übersicht ----------
  function overviewTable(title, groups) {
    const bar = (g) => C.charts.stackedBar([
      { value: g.red, cls: "red", label: t("l.red") }, { value: g.yellow, cls: "yellow", label: t("l.yellow") },
      { value: g.green, cls: "green", label: t("l.green") }, { value: g.grey, cls: "grey", label: t("l.grey") }]);
    return `<section><h3>${title}</h3><div class="scroll"><table class="num">
      <thead><tr><th>${t("col.group")}</th><th>${t("ck.ov.n")}</th><th>🔴 ${t("l.red")}</th><th>🟡 ${t("l.yellow")}</th><th>🟢 ${t("l.green")}</th><th>⚪ ${t("l.grey")}</th><th>${t("ck.ov.lights")}</th></tr></thead>
      <tbody>${groups.map((g) => g.hidden
        ? `<tr><td>${esc(g.key)}</td><td colspan="6" class="muted">${t("ck.ov.hidden")}</td></tr>`
        : `<tr><td>${esc(g.key)}</td><td>${g.n}</td><td>${g.red}</td><td>${g.yellow}</td><td>${g.green}</td><td>${g.grey}</td><td>${bar(g)}</td></tr>`).join("")}</tbody>
    </table></div></section>`;
  }

  // ---------- Export (Spaltentitel immer Deutsch) ----------
  function exportXlsx(items, mrows, ovCM, ovYear) {
    const de = (key, vars) => C.i18n.tIn("de", key, vars);
    const dateCell = (iso) => (iso ? { t: "n", v: Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5 + 25569, z: "dd.mm.yyyy" } : null);
    const kindDe = { red: de("s.risk"), report: de("ck.kind.report"), quality: de("q.label") };
    const stDe = (g) => (g ? de("s." + g.state) : "–");
    const call = [["Art", "Ziel", "Klientennummer", "Dossier-Nr.", "Fallführung", "Frist", "Begründung", "Notiz / erledigt"],
      ...items.map((x) => [kindDe[x.kind], x.goals.map((n) => `Ziel ${n}`).join(", "), x.p.clientNo, x.unit === "household" ? x.h.dossierNo : x.p.dossierNo,
        x.caseManager, dateCell(x.deadline), reasonsText(x.reasons, de), C.state.done.has(x.key) ? "erledigt" : null])];
    const matrix = [["Klientennummer", "Dossier-Nr.", "Verfahrensstand", "Fallführung", "Ziel 1 · Sprache", "Ziel 2 · Arbeit", "Ziel 3 · Sozialhilfe", "Handlungsbedarf"],
      ...mrows.map((r) => [r.p.clientNo, r.p.dossierNo, r.p.status, r.p.caseManager, r.g1.applicable ? stDe(r.g1) : "–", r.g2.applicable ? stDe(r.g2) : "–", stDe(r.g3), r.action ? "ja" : null])];
    const ov = (title, gs) => [[title, "Klient:innen", "rot", "gelb", "grün", "grau"],
      ...gs.map((g) => (g.hidden ? [g.key, de("ck.ov.hidden")] : [g.key, g.n, g.red, g.yellow, g.green, g.grey]))];
    const overviewSheet = [["Stichtag", dateCell(C.state.stichtag)], ["Fallführung (Filter)", ui.cm || "Alle"], [de("ck.ov.note")], [],
      ...ov("Fallführung", ovCM), [], ...ov("Einreisejahr", ovYear)];
    const wb = XLSX.utils.book_new();
    const add = (aoa, name, widths) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = widths.map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name); };
    add(call, "Anrufliste", [16, 12, 14, 12, 18, 11, 80, 24]);
    add(matrix, "Matrix", [14, 12, 16, 18, 18, 18, 20, 16]);
    add(overviewSheet, "Übersicht", [22, 12, 8, 8, 8, 8]);
    XLSX.writeFile(wb, `Cockpit_${C.state.stichtag}.xlsx`);
  }

  // ---------- Zeichnen ----------
  function renderEmpty(el) {
    const canGenerate = !!(C.generator && C.generator.generate);
    el.innerHTML = `<div class="empty">
      <h2>${t("ck.noData")}</h2>
      <p class="muted">${t("ck.noDataHint")}</p>
      <p class="actions">
        <a class="btn primary" href="#daten">${t("ck.loadExports")}</a>
        ${canGenerate ? `<button type="button" id="ck-test" class="btn">${t("ck.loadTest")}</button>` : `<span class="muted">${t("ck.noGenerator")}</span>`}
      </p>
    </div>`;
    const b = el.querySelector("#ck-test");
    if (b) b.addEventListener("click", () => { b.disabled = true; b.textContent = t("busy"); setTimeout(loadTestData, 20); });
  }

  function render(el) {
    const { $ } = C.util;
    if (!C.state.loaded.klient) return renderEmpty(el);
    const full = model();
    const cms = K.caseManagers(full);
    if (ui.cm && !cms.includes(ui.cm)) ui.cm = "";
    const m = K.filterCM(full, ui.cm);
    const items = K.callList(m);
    const k = K.kpis(items, C.state.done);
    const mrows = K.matrixRows(m);
    const ovCM = K.overview(m, (p) => p.caseManager || t("unknown"));
    const ovYear = K.overview(m, (p) => (p.entryDate ? p.entryDate.slice(0, 4) : t("unknown")));
    const missing = ["asylgeschaeft", "sprachstand", "erwerb", "foerderung", "finanz", "zielerreichung"].filter((id) => !C.state.loaded[id]);

    el.innerHTML = `
      <div class="head-row">
        <div><h2>${t("ck.title")}</h2><p class="muted">${t("ck.intro")}${C.state.source === "test" ? ` <span class="tag accent">${t("ck.testLoaded")}</span>` : ""}</p></div>
        <div class="controls">
          <label>${t("c.cm")} <select id="ck-cm"><option value="">${t("ck.cmAll")}</option>${cms.map((c) => `<option ${ui.cm === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
          <label>${t("stichtag")} <input id="ck-date" type="date" value="${C.state.stichtag}"></label>
          <button id="ck-export" type="button" class="primary">${t("ck.export")}</button>
        </div>
      </div>
      ${missing.length ? `<p class="tissue">${t("ck.missingTables")}: ${missing.map((id) => esc(C.TABLES.find((x) => x.id === id).name)).join(", ")}</p>` : ""}
      ${kpiTiles(k)}
      ${callListSection(items)}
      ${matrixSection(mrows)}
      <section><h2>${t("ck.ov.title")}</h2>
        ${overviewTable(t("byCM"), ovCM)}
        ${overviewTable(t("byYear"), ovYear)}
        <p class="muted small">${t("ck.ov.note")} ${t("ck.ov.privacy")}</p>
      </section>`;

    // Ereignisse
    $("#ck-cm", el).addEventListener("change", (e) => { ui.cm = e.target.value; ui.expanded = false; C.render(); });
    $("#ck-date", el).addEventListener("change", (e) => { if (e.target.value) { C.state.stichtag = e.target.value; C.render(); } });
    $("#ck-export", el).addEventListener("click", () => exportXlsx(items, mrows, ovCM, ovYear));
    el.querySelectorAll(".kpis .kpi").forEach((b) => b.addEventListener("click", () => { ui.kind = b.dataset.kind; ui.expanded = false; C.render(); }));
    el.querySelectorAll(".done-btn").forEach((b) => b.addEventListener("click", () => {
      const key = b.dataset.key;
      if (C.state.done.has(key)) C.state.done.delete(key); else C.state.done.add(key);
      C.render();
    }));
    const more = $("#ck-more", el);
    if (more) more.addEventListener("click", () => { ui.expanded = !ui.expanded; C.render(); });
    $("#ck-maction", el).addEventListener("change", (e) => { ui.mAction = e.target.checked; C.render(); });
    $("#ck-mq", el).addEventListener("input", (e) => {
      ui.mq = e.target.value; C.render();
      const n = $("#ck-mq"); n.focus(); n.setSelectionRange(n.value.length, n.value.length);
    });
    el.querySelectorAll("button.sort").forEach((b) => b.addEventListener("click", () => {
      const col = b.dataset.col;
      ui.mSort = { col, dir: ui.mSort.col === col ? -ui.mSort.dir : 1 };
      C.render();
    }));
    // Klick auf Ampel → Ziel-Reiter, gefiltert auf diese Person / diesen Haushalt
    el.querySelectorAll("button.lightbtn").forEach((b) => b.addEventListener("click", () => {
      const view = C.views["ziel" + b.dataset.goal];
      view.focus(b.dataset.q);
      location.hash = "#ziel" + b.dataset.goal;
    }));
  }

  C.views.cockpit = { render, loadTestData };
})();
