/* Gemeinsame Soll/Ist-Ansicht für alle Ziele: Kennzahlen, Summen pro Fallführung und Einreisejahr,
 * Liste (Personen oder Haushalte) mit Ampel und Begründung, Export nach Excel.
 *
 * makeGoalView(cfg) → { render(el), compute(loaded, stichtag, includeClosed) }
 *   cfg.no          Zielnummer (1, 2, 3)
 *   cfg.unit        "person" oder "household"
 *   cfg.evaluate    Regel-Funktion aus rules.js (goal1, goal2, goal3)
 *   cfg.need        benötigte Tabellen-IDs
 *   cfg.deadlineKey, cfg.reachedKey  Spaltentitel (i18n)
 */
(function () {
  "use strict";
  const C = window.Cockpit;
  const { t } = C.i18n;
  const R = C.rules;

  const ORDER = { risk: 0, open: 1, missed: 2, late: 3, reached: 4, na: 5 }; // Dringlichkeit
  const LIGHT_CLS = { reached: "green", open: "yellow", risk: "red", missed: "red", late: "red", na: "grey" };
  const LIMIT = 300;
  const reasonText = (g) => g.reasons.map((r) => t(r.key, r.vars)).join(" ");
  const qualityText = (g) => (g.quality || []).map((r) => t(r.key, r.vars)).join(" ");
  const pct = (x) => (x === null ? "–" : `${Math.round(x * 100)} %`);

  function makeGoalView(cfg) {
    // Stichtag: gemeinsam in C.state.stichtag. open: aufgeklappte Summen-Tabellen (standardmässig zu).
    const ui = { includeClosed: false, cm: "", state: "", q: "", open: { cm: false, year: false } };
    const isHH = cfg.unit === "household";
    const P = `g${cfg.no}-`; // Präfix für Element-IDs

    // ---------- Berechnung ----------
    function compute(loaded, stichtag, includeClosed) {
      const persons = R.buildPersons(loaded);
      const entities = isHH
        ? R.buildHouseholds(persons, loaded).filter((h) => includeClosed || R.householdCurrent(h, stichtag))
        : persons.filter((p) => includeClosed || R.isCurrent(p, stichtag));
      const items = entities.map((e) => ({ e, g: cfg.evaluate(e, stichtag) }));
      const inScope = items.filter((x) => x.g.applicable);
      const count = (list) => {
        const c = { inScope: list.length, reached: 0, open: 0, risk: 0, missed: 0, late: 0, notReported: 0, deadlinePassed: 0, reachedPassed: 0 };
        for (const { g } of list) {
          c[g.state]++;
          if (g.state === "reached" && !g.reported) c.notReported++;
          if (g.deadline < stichtag) { c.deadlinePassed++; if (g.state === "reached") c.reachedPassed++; }
        }
        c.rate = c.deadlinePassed ? c.reachedPassed / c.deadlinePassed : null;
        return c;
      };
      const groupBy = (keyFn) => {
        const m = new Map();
        for (const x of inScope) { const k = keyFn(x.e) || t("unknown"); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
        return [...m.entries()].map(([key, list]) => ({ key, ...count(list) })).sort((a, b) => String(a.key).localeCompare(String(b.key)));
      };
      return {
        items, inScope, totals: count(inScope),
        quality: items.filter((x) => x.g.quality && x.g.quality.length).length,
        byCM: groupBy((e) => e.caseManager),
        byYear: groupBy((e) => (e.entryDate ? e.entryDate.slice(0, 4) : null)),
      };
    }

    // ---------- Darstellung ----------
    function kpis(c, nQuality) {
      const k = (n, label, cls) => `<div class="kpi ${cls || ""}"><b>${n}</b><span>${label}</span></div>`;
      return `<div class="kpis">
        ${k(c.inScope, isHH ? t("k.inScopeHH") : t("k.inScope"))}
        ${k(c.reached, t("k.reached"), "green")}
        ${k(c.open, t("k.open"), "yellow")}
        ${k(c.risk, t("k.risk"), "red")}
        ${k(c.missed + c.late, t("k.missed"), "red")}
        ${k(c.notReported, t("k.notReported"), "accent")}
        ${nQuality ? k(nQuality, t("q.label"), "accent") : ""}
      </div>`;
    }

    /* Summen-Tabelle in einem aufklappbaren <details> (standardmässig geschlossen).
     * id: "cm" oder "year" – merkt sich, ob aufgeklappt, damit es beim Neuzeichnen offen bleibt. */
    function groupTable(id, title, rows) {
      const { esc } = C.util;
      const bar = (r) => C.charts.stackedBar([
        { value: r.reached, cls: "green", label: t("s.reached") }, { value: r.open, cls: "yellow", label: t("s.open") },
        { value: r.risk, cls: "red", label: t("s.risk") }, { value: r.missed + r.late, cls: "dark", label: t("s.missed") }]);
      return `<details class="group" data-group="${id}" ${ui.open[id] ? "open" : ""}><summary><h3>${title} <small>(${rows.length})</small></h3></summary><div class="scroll"><table class="num">
        <thead><tr><th>${t("col.group")}</th><th>${t("col.inScope")}</th><th>${t("s.reached")}</th><th>${t("s.open")}</th><th>${t("s.risk")}</th><th>${t("s.missed")}</th><th>${t("k.notReported")}</th><th>${t("col.rate")}</th><th></th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${esc(r.key)}</td><td>${r.inScope}</td><td>${r.reached}</td><td>${r.open}</td><td>${r.risk}</td><td>${r.missed + r.late}</td><td>${r.notReported}</td><td>${pct(r.rate)}</td><td>${bar(r)}</td></tr>`).join("")}</tbody>
      </table></div></details>`;
    }

    function filtered(res) {
      const q = ui.q.trim();
      const match = (e) => (isHH ? [e.dossierNo, ...e.members.flatMap((m) => [m.zemis, m.clientNo])] : [e.zemis, e.clientNo]).some((v) => String(v).includes(q));
      return res.items
        .filter((x) => {
          if (ui.state === "notReported") return x.g.state === "reached" && !x.g.reported;
          if (ui.state === "quality") return x.g.quality && x.g.quality.length;
          if (ui.state === "any") return true;
          return ui.state ? x.g.state === ui.state : x.g.applicable;
        })
        .filter((x) => !ui.cm || x.e.caseManager === ui.cm)
        .filter((x) => !q || match(x.e))
        .sort((a, b) => ORDER[a.g.state] - ORDER[b.g.state] || String(a.g.deadline).localeCompare(String(b.g.deadline)));
    }

    function listTable(res) {
      const { esc, fmtDate } = C.util;
      const list = filtered(res);
      const cms = [...new Set(res.items.map((x) => x.e.caseManager).filter(Boolean))].sort();
      const states = ["risk", "open", "missed", "late", "reached", "notReported", ...(res.quality ? ["quality"] : []), "na", "any"];
      const stLabel = (s) => (s === "notReported" ? t("k.notReported") : s === "quality" ? t("q.label") : s === "any" ? t("filterAny") : t("s." + s));
      const opt = (v, label, sel) => `<option value="${esc(v)}" ${sel ? "selected" : ""}>${esc(label)}</option>`;
      const idCell = (e) => (isHH ? `${esc(e.dossierNo)}<br><span class="muted">${t("members", { n: e.members.length })}</span>` : `${esc(e.zemis)}<br><span class="muted">${esc(e.clientNo)}</span>`);
      return `<section><h3>${isHH ? t("householdList") : t("personList")}</h3>
        <div class="filters">
          <label>${t("c.cm")} <select id="${P}cm">${opt("", t("filterAll"), !ui.cm)}${cms.map((c) => opt(c, c, ui.cm === c)).join("")}</select></label>
          <label>${t("filterLight")} <select id="${P}state">${opt("", t("filterAll") + " (" + t("k.inScope") + ")", !ui.state)}${states.map((s) => opt(s, stLabel(s), ui.state === s)).join("")}</select></label>
          <input id="${P}q" type="search" placeholder="${t(isHH ? "searchHH" : "search")}" value="${esc(ui.q)}">
        </div>
        <div class="scroll tall"><table>
          <thead><tr><th>${t("c.light")}</th><th>${isHH ? t("c.dossier") : t("c.zemis")}</th><th>${t("c.cm")}</th><th>${t("c.status")}</th>
            ${isHH ? "" : `<th>${t("c.age")}</th>`}<th>${t("c.entry")}</th><th>${t(cfg.deadlineKey)}</th><th>${t(cfg.reachedKey)}</th><th>${t("c.reasons")}</th></tr></thead>
          <tbody>${list.slice(0, LIMIT).map(({ e, g }) => `<tr>
            <td>${C.charts.light(LIGHT_CLS[g.state], t("s." + g.state))}</td>
            <td>${idCell(e)}</td><td>${esc(e.caseManager)}</td><td>${esc(e.status)}</td>
            ${isHH ? "" : `<td>${e.birthDate ? R.ageAt(e.birthDate, C.state.stichtag) : "–"}</td>`}
            <td>${fmtDate(e.entryDate)}</td><td>${fmtDate(g.deadline)}</td><td>${fmtDate(g.reachedDate)}</td>
            <td class="wrap">${esc(reasonText(g))}${g.state === "reached" && !g.reported ? ` <span class="tag accent">${t("k.notReported")}</span>` : ""}
              ${g.quality && g.quality.length ? `<div class="qual">⚠️ ${esc(qualityText(g))}</div>` : ""}</td>
          </tr>`).join("")}</tbody>
        </table></div>
        <p class="muted">${t("shownOf", { n: Math.min(list.length, LIMIT), total: list.length })}</p>
      </section>`;
    }

    // ---------- Export nach Excel ----------
    function exportXlsx(res) {
      const dateCell = (iso) => (iso ? { t: "n", v: Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5 + 25569, z: "dd.mm.yyyy" } : null);
      const head = isHH
        ? [t("c.dossier"), t("c.household"), t("c.zemis"), t("c.cm"), t("c.status"), t("c.entry")]
        : [t("c.zemis"), t("c.clientNo"), t("c.dossier"), t("c.cm"), t("c.status"), t("c.birth"), t("c.entry")];
      const rows = [[...head, t("c.inScope"), t(cfg.deadlineKey), t(cfg.reachedKey), t("c.proof"), t("c.reported"), t("c.state"), t("c.light"), t("c.reasons"), t("q.label")]];
      for (const { e, g } of [...res.items].sort((a, b) => ORDER[a.g.state] - ORDER[b.g.state])) {
        const base = isHH
          ? [e.dossierNo, e.members.length, e.members.map((m) => m.zemis).join(", "), e.caseManager, e.status, dateCell(e.entryDate)]
          : [e.zemis, e.clientNo, e.dossierNo, e.caseManager, e.status, dateCell(e.birthDate), dateCell(e.entryDate)];
        rows.push([...base, g.applicable ? t("yes") : t("no"), dateCell(g.deadline), dateCell(g.reachedDate), g.reachedProof,
          g.applicable && g.reachedDate ? (g.reported ? t("yes") : t("no")) : null, t("s." + g.state),
          { green: "grün", yellow: "gelb", red: "rot", grey: "grau" }[g.light], reasonText(g), qualityText(g) || null]);
      }
      const group = (list) => [[t("col.group"), t("col.inScope"), t("s.reached"), t("s.open"), t("s.risk"), t("s.missed"), t("k.notReported"), t("col.rate")],
        ...list.map((r) => [r.key, r.inScope, r.reached, r.open, r.risk, r.missed + r.late, r.notReported, r.rate === null ? null : { t: "n", v: r.rate, z: "0%" }])];
      const rules = [[t("stichtag"), dateCell(C.state.stichtag)], [t("inclClosed"), ui.includeClosed ? t("yes") : t("no")], [t(`z${cfg.no}.intro`)], [t("rateHint")], ["ANNAHMEN.md"]];
      const wb = XLSX.utils.book_new();
      const add = (aoa, name, widths) => { const ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = widths.map((w) => ({ wch: w })); XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); };
      add(rows, isHH ? t("householdList") : t("x.persons"), [...head.map(() => 12), 8, 12, 12, 28, 9, 16, 7, 70, 40]);
      add(group(res.byCM), t("byCM"), [24, 12, 10, 10, 12, 10, 18, 8]);
      add(group(res.byYear), t("byYear"), [12, 12, 10, 10, 12, 10, 18, 8]);
      add(rules, t("x.rules"), [40, 30]);
      XLSX.writeFile(wb, `Ziel${cfg.no}_Soll-Ist_${C.state.stichtag}.xlsx`);
    }

    // ---------- Zeichnen ----------
    let cache = { key: null, res: null };
    function render(el) {
      const { $ } = C.util;
      const L = C.state.loaded;
      const title = `<h2>${t(`z${cfg.no}.title`)}</h2>`;
      if (cfg.need.some((id) => !L[id])) {
        el.innerHTML = `${title}<p class="placeholder">${t("needData")}<br>${t(`z${cfg.no}.needTables`)}</p>`;
        return;
      }
      const key = [Object.values(L).map((s) => s.fileName + s.rows.length).join("|"), C.state.stichtag, ui.includeClosed, C.i18n.getLang()].join("#");
      if (cache.key !== key) cache = { key, res: compute(L, C.state.stichtag, ui.includeClosed) };
      const res = cache.res;

      el.innerHTML = `
        <div class="head-row">
          <div>${title}<p class="muted">${t(`z${cfg.no}.intro`)}</p></div>
          <div class="controls">
            <label>${t("stichtag")} <input id="${P}date" type="date" value="${C.state.stichtag}"></label>
            <label><input id="${P}closed" type="checkbox" ${ui.includeClosed ? "checked" : ""}> ${t("inclClosed")}</label>
            <button id="${P}export" type="button" class="primary">${t("exportXlsx")}</button>
          </div>
        </div>
        ${kpis(res.totals, res.quality)}
        ${listTable(res)}
        ${groupTable("cm", t("byCM"), res.byCM)}
        ${groupTable("year", t("byYear"), res.byYear)}
        <p class="muted small">${t("rateHint")}</p>`;

      $(`#${P}date`, el).addEventListener("change", (e) => { if (e.target.value) { C.state.stichtag = e.target.value; C.render(); } });
      $(`#${P}closed`, el).addEventListener("change", (e) => { ui.includeClosed = e.target.checked; C.render(); });
      $(`#${P}export`, el).addEventListener("click", () => exportXlsx(res));
      el.querySelectorAll("details.group").forEach((d) => d.addEventListener("toggle", () => { ui.open[d.dataset.group] = d.open; }));
      $(`#${P}cm`, el).addEventListener("change", (e) => { ui.cm = e.target.value; C.render(); });
      $(`#${P}state`, el).addEventListener("change", (e) => { ui.state = e.target.value; C.render(); });
      $(`#${P}q`, el).addEventListener("input", (e) => {
        ui.q = e.target.value; C.render();
        const n = $(`#${P}q`); n.focus(); n.setSelectionRange(n.value.length, n.value.length); // Fokus beim Tippen behalten
      });
    }

    /* Von aussen (Cockpit-Matrix): Liste auf eine Person / einen Haushalt einschränken. */
    function focus(q) { ui.q = String(q || ""); ui.cm = ""; ui.state = "any"; }

    return { render, compute, focus };
  }

  C.makeGoalView = makeGoalView;
})();
