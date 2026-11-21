/* Cockpit-Logik (Level 4) – reine Funktionen, ohne Oberfläche.
 * Nutzt nur die Regeln aus rules.js (goal1, goal2, goal3); die Regeln selbst werden hier nicht verändert.
 *
 * Begriffe:
 *   Modell     = aktuelle Klient:innen am Stichtag mit Ergebnis pro Ziel (rows) und Haushalte (households)
 *   Anrufliste = Punkte «diese Woche handeln», eine Zeile pro Klient:in und Grund:
 *                red     → Ziel gefährdet (Ampel rot, Frist noch nicht abgelaufen)
 *                report  → Ziel erreicht, aber noch nicht in Integrationszielerreichung gemeldet
 *                quality → Datenqualität (fehlende Angaben, ZEMIS-Arbeit ohne Erwerb)
 */
(function (root) {
  "use strict";
  const R = root.Cockpit.rules;

  const KIND_ORDER = { red: 0, report: 1, quality: 2 };
  const MIN_GROUP = 5; // Datenschutz: Gruppen mit weniger Personen werden in der Übersicht ausgeblendet
  // Gründe «nicht beurteilbar», die auf fehlende Daten zurückgehen (→ Datenqualität)
  const DATA_GAPS = ["r.noEntry", "r.noBirth", "r.noRespEnd", "r3.noFin"];

  // ---------- Modell ----------
  function evaluate(loaded, stichtag) {
    const all = R.buildPersons(loaded);
    const households = R.buildHouseholds(all, loaded).filter((h) => R.householdCurrent(h, stichtag));
    const hhOf = new Map();
    for (const h of households) { h.g3 = R.goal3(h, stichtag); for (const m of h.members) hhOf.set(m, h); }
    const rows = all.filter((p) => R.isCurrent(p, stichtag))
      .map((p) => ({ p, g1: R.goal1(p, stichtag), g2: R.goal2(p, stichtag), h: hhOf.get(p) || null }));
    return { stichtag, rows, households };
  }

  // Filter Fallführung ("" = alle). Haushalte gehören zur Fallführung der Hauptperson.
  function filterCM(model, cm) {
    if (!cm) return model;
    return { ...model, rows: model.rows.filter((r) => r.p.caseManager === cm), households: model.households.filter((h) => h.caseManager === cm) };
  }

  const caseManagers = (model) => [...new Set(model.rows.map((r) => r.p.caseManager).filter(Boolean))].sort();
  const dataGaps = (g) => g.reasons.filter((r) => DATA_GAPS.includes(r.key));
  const notReported = (g) => g.state === "reached" && g.reported === false;

  // Braucht dieses Ziel-Ergebnis eine Handlung?
  const isAction = (g) => !!g && (g.state === "risk" || notReported(g) || (g.quality || []).length > 0 || dataGaps(g).length > 0);

  // ---------- Anrufliste ----------
  function callList(model) {
    const items = [];
    const push = (kind, goals, unit, p, h, g, reasons) => items.push({
      key: `${kind}-${goals.join("")}-${unit === "household" ? h.dossierNo : p.clientNo}`,
      kind, goals, unit, p, h, g, reasons,
      deadline: g ? g.deadline : null,
      reachedDate: g ? g.reachedDate : null,
      caseManager: unit === "household" ? h.caseManager : p.caseManager,
    });
    for (const r of model.rows) {
      const gs = [[1, r.g1], [2, r.g2]];
      for (const [no, g] of gs) {
        if (g.state === "risk") push("red", [no], "person", r.p, null, g, g.reasons);
        if (notReported(g)) push("report", [no], "person", r.p, null, g, g.reasons);
      }
      // Datenqualität: ein Punkt pro Person, Gründe aus Ziel 1 und 2 zusammengefasst (ohne Doppelte)
      const q = [], qGoals = [];
      for (const [no, g] of gs) {
        const found = [...dataGaps(g), ...(g.quality || [])];
        if (found.length) qGoals.push(no);
        for (const f of found) if (!q.some((x) => x.key === f.key && JSON.stringify(x.vars) === JSON.stringify(f.vars))) q.push(f);
      }
      if (q.length) push("quality", qGoals, "person", r.p, null, null, q);
    }
    for (const h of model.households) {
      const g = h.g3;
      if (g.state === "risk") push("red", [3], "household", h.head, h, g, g.reasons);
      if (notReported(g)) push("report", [3], "household", h.head, h, g, g.reasons);
      const gaps = dataGaps(g);
      if (gaps.length) push("quality", [3], "household", h.head, h, null, gaps);
    }
    return sortCallList(items);
  }

  /* Sortierung: rot zuerst (nächste Frist zuerst), dann «noch nicht gemeldet» (ältestes Erreichen zuerst),
   * dann Datenqualität. Bei Gleichstand nach Nummer. */
  function sortCallList(items) {
    const idOf = (x) => String(x.unit === "household" ? x.h.dossierNo : x.p.clientNo);
    const dateOf = (x) => (x.kind === "red" ? x.deadline : x.kind === "report" ? x.reachedDate : "") || "9999-12-31";
    return [...items].sort((a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || dateOf(a).localeCompare(dateOf(b)) || idOf(a).localeCompare(idOf(b)));
  }

  // Kennzahlen = offene (nicht erledigte) Punkte der Anrufliste.
  function kpis(items, done) {
    const open = items.filter((x) => !done.has(x.key));
    return { act: open.length, red: open.filter((x) => x.kind === "red").length,
      report: open.filter((x) => x.kind === "report").length, quality: open.filter((x) => x.kind === "quality").length };
  }

  // ---------- Matrix Klient:in × Ziel ----------
  function matrixRows(model) {
    return model.rows
      .filter((r) => r.g1.applicable || r.g2.applicable || (r.h && r.h.g3.applicable))
      .map((r) => {
        const g3 = r.h ? r.h.g3 : null;
        const memberInScope3 = g3 && g3.applicable;
        return { p: r.p, g1: r.g1, g2: r.g2, g3: memberInScope3 ? g3 : null, h: r.h,
          action: isAction(r.g1) || isAction(r.g2) || (memberInScope3 && isAction(g3)) };
      });
  }

  // ---------- Übersicht (Arbeitslast und Fallmix) ----------
  /* Zählt Ampeln über alle Ziele pro Gruppe. n = Anzahl Personen in der Gruppe.
   * Gruppen mit n < MIN_GROUP: hidden = true, keine Zahlen (Datenschutz). Ziel 3 zählt beim Haushalt (Hauptperson). */
  function overview(model, keyFn, minN = MIN_GROUP) {
    const groups = new Map();
    const get = (k) => { if (!groups.has(k)) groups.set(k, { key: k, persons: new Set(), red: 0, yellow: 0, green: 0, grey: 0 }); return groups.get(k); };
    for (const r of model.rows) {
      const gr = get(keyFn(r.p) ?? "–");
      gr.persons.add(r.p.clientNo);
      gr[r.g1.light]++; gr[r.g2.light]++;
    }
    for (const h of model.households) get(keyFn(h.head) ?? "–")[h.g3.light]++;
    return [...groups.values()]
      .map((g) => {
        const n = g.persons.size;
        return n < minN ? { key: g.key, n: null, hidden: true } : { key: g.key, n, hidden: false, red: g.red, yellow: g.yellow, green: g.green, grey: g.grey };
      })
      .sort((a, b) => String(a.key).localeCompare(String(b.key)));
  }

  root.Cockpit = root.Cockpit || {};
  root.Cockpit.cockpit = { evaluate, filterCM, caseManagers, callList, sortCallList, kpis, matrixRows, overview, isAction, KIND_ORDER, MIN_GROUP };
})(typeof window !== "undefined" ? window : this);
