/* Tests für js/rules.js. Laufen im Browser (tests.html) und im Terminal (JXA).
 * Jeder Test beschreibt einen Fall aus ANNAHMEN.md.
 */
(function (root) {
  "use strict";
  const R = root.Cockpit.rules;
  const K = root.Cockpit.cockpit;
  const PT = root.Cockpit.patterns;
  const TODAY = "2026-11-21";

  // Testperson bauen: nur die Felder, die die Regel braucht.
  function person(o = {}) {
    return {
      status: o.status ?? "VA", birthDate: o.birth ?? "1990-01-01", entryDate: o.entry === undefined ? "2024-01-15" : o.entry,
      respEnd: o.respEnd ?? null,
      rows: { language: o.language || [], reached: o.reached || [], support: o.support || [], events: [], jobs: o.jobs || [], zemisJobs: o.zemisJobs || [], status: [], housing: [] },
    };
  }
  const lang = (level, proofType, date, remarks) => ({ level, proofType, date, remarks: remarks || null });
  const job = (from, to, workload) => ({ from, to, workload });
  const fin = (support, from, to) => ({ support, from, to });
  // Haushalt mit einer erwachsenen Person (Zuständigkeitsende 2029)
  const hh = (finRows, o = {}) => ({ dossierNo: "D1", fin: finRows, status: "B-FL",
    members: [person({ status: "B-FL", respEnd: o.respEnd ?? "2029-01-01", jobs: o.jobs, reached: o.reached })] });
  const P2 = (o) => person({ respEnd: "2029-01-01", ...o }); // Ziel 2: Frist = Zuständigkeitsende

  // ----- Cockpit: kleines Modell ohne Tabellen -----
  // Ziel-Ergebnis mit Zustand; Ampel wie in rules.js
  const G = (state, o = {}) => ({ applicable: state !== "na", state, light: { reached: "green", open: "yellow", risk: "red", missed: "red", late: "red", na: "grey" }[state],
    deadline: o.deadline ?? "2027-06-01", reachedDate: o.reached ?? null, reported: o.reported ?? (state === "reached" ? true : null), reasons: o.reasons || [], quality: o.quality || [] });
  const row = (clientNo, cm, g1, g2, entry) => ({ p: { clientNo, caseManager: cm, entryDate: entry || "2024-01-01", dossierNo: "D" + clientNo }, g1, g2, h: null });
  const household = (dossierNo, cm, g3) => ({ dossierNo, caseManager: cm, head: { clientNo: "H" + dossierNo, caseManager: cm, entryDate: "2024-01-01" }, members: [], g3 });
  // ----- Muster: Einheiten ohne Tabellen -----
  // u(entry, reachedDate, extra) – Person im Zielbereich mit Einreise und (optional) Datum Zielerreichung
  const unit = (entry, reachedDate, o = {}) => ({ kind: "person", h: null, entry,
    p: { gender: o.gender || "Weiblich", motherTongue: o.tongue || "Tigrinya", schoolYearsBefore: o.school ?? 8, entryDate: entry,
      rows: { support: o.support || [], jobs: [], housing: [], language: [], reached: [] } },
    g: { applicable: o.applicable ?? true, state: o.state || (reachedDate ? "reached" : "open"), deadline: o.deadline || R.addYears(entry, 3), reachedDate } });
  const factor = (id) => PT.FACTORS.find((f) => f.id === id);
  const ctx0 = { stichtag: TODAY, ai: () => null, a1: () => null, hasAI: false };

  function demoModel() {
    return {
      rows: [
        row("1", "Anna", G("risk", { deadline: "2027-05-01" }), G("open")),
        row("2", "Anna", G("risk", { deadline: "2027-01-01" }), G("reached", { reached: "2025-01-01", reported: false })),
        row("3", "Ben", G("open"), G("open", { quality: [{ key: "q.zemisOnly", vars: {} }] })),
        row("4", "Ben", G("reached", { reached: "2024-06-01", reported: false }), G("na")),
        row("5", "Ben", G("na", { reasons: [{ key: "r.noEntry" }] }), G("open")),
      ],
      households: [household("D9", "Ben", G("risk", { deadline: "2026-12-15" }))],
    };
  }

  const TESTS = [
    ["Datum: 29.02. + 3 Jahre = 28.02.", () => eq(R.addYears("2020-02-29", 3), "2023-02-28")],
    ["Datum: Monate zwischen 15.01. und 14.03. = 1", () => eq(R.monthsBetween("2026-01-15", "2026-03-14"), 1)],
    ["Alter am Stichtag", () => eq(R.ageAt("2010-11-22", "2026-11-21"), 15)],
    ["Frist = Einreise + 3 Jahre (Z1.1)", () => eq(R.goal1(person(), TODAY).deadline, "2027-01-15")],
    ["Status N ausserhalb Zielbereich (A3)", () => eq(R.goal1(person({ status: "N (Asylsuchende)" }), TODAY).state, "na")],
    ["Status S ausserhalb Zielbereich (A3)", () => eq(R.goal1(person({ status: "S" }), TODAY).state, "na")],
    ["B-FL+5 zählt als B-FL (abgeschlossen)", () => eq(R.goal1(person({ status: "B-FL+5", entry: "2019-01-01" }), TODAY).applicable, true)],
    ["Ohne Einreisedatum: nicht beurteilbar (A2)", () => eq(R.goal1(person({ entry: null }), TODAY).reasons[0].key, "r.noEntry")],
    ["16+: wird vor Frist 16 → im Zielbereich (Z1.2)", () => eq(R.goal1(person({ birth: "2010-06-01", entry: "2024-01-15" }), TODAY).applicable, true)],
    ["16+: wird erst nach Frist 16 → ausserhalb (Z1.2)", () => eq(R.goal1(person({ birth: "2012-06-01", entry: "2024-01-15" }), TODAY).applicable, false)],
    ["16+: genau am Fristtag 16 → im Zielbereich", () => eq(R.goal1(person({ birth: "2011-01-15", entry: "2024-01-15" }), TODAY).applicable, true)],
    ["A1 Zertifikat in Frist → erreicht, grün", () => {
      const r = R.goal1(person({ language: [lang("A1", "Zertifizierung", "2025-03-01", "telc A1")] }), TODAY);
      return eq(r.state, "reached") || eq(r.light, "green");
    }],
    ["A2 zählt auch als A1 (Z1.3)", () => eq(R.goal1(person({ language: [lang("A2", "Zertifizierung", "2025-03-01")] }), TODAY).state, "reached")],
    ["«Weiteres» zählt nicht (Z1.3)", () => eq(R.goal1(person({ language: [lang("A1", "Weiteres", "2025-03-01")] }), TODAY).reachedDate, null)],
    ["A0 zählt nicht", () => eq(R.goal1(person({ language: [lang("A0", "Zertifizierung", "2025-03-01")] }), TODAY).reachedDate, null)],
    ["Obligatorische Schulzeit zählt (Z1.3)", () => eq(R.goal1(person({ language: [lang("B1", "Beendigung obligatorische Schulzeit", "2025-07-01")] }), TODAY).state, "reached")],
    ["A1 am Fristtag → noch in Frist (Z1.4)", () => eq(R.goal1(person({ language: [lang("A1", "Zertifizierung", "2027-01-15")] }), "2027-02-01").state, "reached")],
    ["A1 nach Frist → verpasst (Z1.4)", () => eq(R.goal1(person({ entry: "2022-01-15", language: [lang("A1", "Zertifizierung", "2025-02-01")] }), TODAY).state, "late")],
    ["Erreicht, nicht gemeldet → Hinweis (Z1.5)", () => {
      const r = R.goal1(person({ language: [lang("A1", "Zertifizierung", "2025-03-01")] }), TODAY);
      return eq(r.reported, false) || eq(r.reasons.some((x) => x.key === "r.notReported"), true);
    }],
    ["Erreicht und gemeldet → kein Hinweis", () => eq(R.goal1(person({ language: [lang("A1", "Zertifizierung", "2025-03-01")],
      reached: [{ goalType: "Sprachniveau A1", reachedOn: "2025-03-01" }] }), TODAY).reported, true)],
    ["Nur in Integrationszielerreichung erfasst → erreicht", () => eq(R.goal1(person({ reached: [{ goalType: "Sprachniveau A1", reachedOn: "2025-03-01" }] }), TODAY).state, "reached")],
    ["Offen, Frist < 6 Monate → rot (Z1.6)", () => eq(R.goal1(person({ entry: "2024-01-15" }), "2026-09-01").light, "red")],
    ["Offen, Frist > 6 Monate → gelb (Z1.6)", () => eq(R.goal1(person({ entry: "2025-01-15" }), TODAY).light, "yellow")],
    ["Frist abgelaufen ohne A1 → verpasst, rot", () => { const r = R.goal1(person({ entry: "2022-01-15" }), TODAY); return eq(r.state, "missed") || eq(r.light, "red"); }],
    // ----- Ziel 2 -----
    ["Ziel 2: Frist = Zuständigkeitsende (Z2.1)", () => eq(R.goal2(P2(), TODAY).deadline, "2029-01-01")],
    ["Ziel 2: ohne Zuständigkeitsende nicht beurteilbar", () => eq(R.goal2(person(), TODAY).reasons[0].key, "r.noRespEnd")],
    ["Ziel 2: 6 Monate 100 % → erreicht nach 6 Monaten (Z2.3)", () => eq(R.goal2(P2({ jobs: [job("2025-01-01", "2025-12-31", 100)] }), TODAY).reachedDate, "2025-07-01")],
    ["Ziel 2: 01.01.–30.06. genau 6 Monate → erreicht", () => eq(R.goal2(P2({ jobs: [job("2025-01-01", "2025-06-30", 80)] }), TODAY).state, "reached")],
    ["Ziel 2: 5 Monate → nicht erreicht", () => eq(R.goal2(P2({ jobs: [job("2025-01-01", "2025-05-31", 80)] }), TODAY).reachedDate, null)],
    ["Ziel 2: 50 % reicht nicht", () => eq(R.goal2(P2({ jobs: [job("2025-01-01", "2025-12-31", 50)] }), TODAY).reachedDate, null)],
    ["Ziel 2: 40 % + 30 % gleichzeitig = 70 % → erreicht (Z2.3)", () => eq(R.goal2(P2({ jobs: [job("2025-01-01", "2025-12-31", 40), job("2025-01-01", "2025-12-31", 30)] }), TODAY).state, "reached")],
    ["Ziel 2: Stellenwechsel mit 5 Tagen Lücke zählt durch", () => eq(R.goal2(P2({ jobs: [job("2025-01-01", "2025-03-31", 80), job("2025-04-06", "2025-12-31", 80)] }), TODAY).reachedDate, "2025-07-01")],
    ["Ziel 2: Lücke 30 Tage unterbricht", () => eq(R.goal2(P2({ jobs: [job("2025-01-01", "2025-03-31", 80), job("2025-05-01", "2025-08-31", 80)] }), TODAY).reachedDate, null)],
    ["Ziel 2: laufende Stelle seit 3 Monaten → gelb, voraussichtlich", () => { const r = R.goal2(P2({ jobs: [job("2026-08-21", null, 100)] }), TODAY); return eq(r.light, "yellow") || eq(r.expected, "2027-02-21"); }],
    ["Ziel 2: laufende Stelle, 6 Monate erst nach Frist → rot (Z2.6)", () => eq(R.goal2(P2({ respEnd: "2027-01-01", jobs: [job("2026-10-01", null, 100)] }), TODAY).light, "red")],
    ["Ziel 2: keine Arbeit, < 12 Monate bis Frist → rot (Z2.6)", () => eq(R.goal2(P2({ respEnd: "2027-09-01" }), TODAY).light, "red")],
    ["Ziel 2: keine Arbeit, > 12 Monate bis Frist → gelb", () => eq(R.goal2(P2({ respEnd: "2028-06-01" }), TODAY).light, "yellow")],
    ["Ziel 2: Lehre Sek II zählt ab Start (Z2.5)", () => eq(R.goal2(P2({ support: [{ type: "Sek II", start: "2025-08-01", title: "Logistiker EBA" }] }), TODAY).reachedDate, "2025-08-01")],
    ["Ziel 2: Brückenangebot zählt nicht", () => eq(R.goal2(P2({ support: [{ type: "Brückenangebot", start: "2025-08-01" }] }), TODAY).reachedDate, null)],
    ["Ziel 2: ZEMIS-Arbeit ohne Erwerb → Hinweis (Z2.8)", () => eq(R.goal2(P2({ zemisJobs: [{ start: "2025-03-01", company: "X AG" }] }), TODAY).quality.length, 1)],
    ["Ziel 2: ZEMIS-Arbeit mit Erwerb (± 31 Tage) → kein Hinweis", () => eq(R.goal2(P2({ zemisJobs: [{ start: "2025-03-10", company: "X AG" }], jobs: [job("2025-03-01", null, 50)] }), TODAY).quality.length, 0)],
    // ----- Ziel 3 -----
    ["Ziel 3: 12 Monate «Keine Unterstützung» → erreicht (Z3.4)", () => eq(R.goal3(hh([fin("Sozialhilfe", "2023-01-01", "2024-12-31"), fin("Keine Unterstützung", "2025-01-01", null)]), TODAY).reachedDate, "2026-01-01")],
    ["Ziel 3: 11 Monate → nicht erreicht, gelb (läuft)", () => { const r = R.goal3(hh([fin("Sozialhilfe", "2023-01-01", "2025-12-31"), fin("Keine Unterstützung", "2026-01-01", null)]), TODAY); return eq(r.reachedDate, null) || eq(r.light, "yellow"); }],
    ["Ziel 3: Nothilfe zählt als Unterstützung (Z3.3)", () => eq(R.goal3(hh([fin("Nothilfe", "2024-01-01", null)]), TODAY).reachedDate, null)],
    ["Ziel 3: Lücke in den Daten zählt nicht als ohne SH (Z3.3)", () => eq(R.goal3(hh([fin("Sozialhilfe", "2023-01-01", "2024-01-01")]), TODAY).reachedDate, null)],
    ["Ziel 3: zwei aufeinanderfolgende Perioden ohne SH werden zusammengezählt", () => eq(R.goal3(hh([fin("Keine Unterstützung", "2025-01-01", "2025-06-30"), fin("Keine Unterstützung", "2025-07-01", null)]), TODAY).reachedDate, "2026-01-01")],
    ["Ziel 3: Sozialhilfe, < 18 Monate bis Frist → rot (Z3.5)", () => eq(R.goal3(hh([fin("Sozialhilfe", "2023-01-01", null)], { respEnd: "2028-01-01" }), TODAY).light, "red")],
    ["Ziel 3: Sozialhilfe, > 18 Monate bis Frist → gelb", () => eq(R.goal3(hh([fin("Sozialhilfe", "2023-01-01", null)], { respEnd: "2029-01-01" }), TODAY).light, "yellow")],
    ["Ziel 3: ohne Finanzdaten nicht beurteilbar", () => eq(R.goal3(hh([]), TODAY).applicable, false)],
    // ----- Cockpit -----
    ["Cockpit: Anrufliste rot zuerst, nach nächster Frist", () => eq(K.callList(demoModel()).filter((x) => x.kind === "red").map((x) => x.deadline), ["2026-12-15", "2027-01-01", "2027-05-01"])],
    ["Cockpit: Reihenfolge rot → nicht gemeldet → Datenqualität", () => eq(K.callList(demoModel()).map((x) => x.kind), ["red", "red", "red", "report", "report", "quality", "quality"])],
    ["Cockpit: «nicht gemeldet» ältestes Erreichen zuerst", () => eq(K.callList(demoModel()).filter((x) => x.kind === "report").map((x) => x.p.clientNo), ["4", "2"])],
    ["Cockpit: eine Zeile pro Klient:in und Grund (Person 2: rot Ziel 1 + nicht gemeldet Ziel 2)", () => eq(K.callList(demoModel()).filter((x) => x.p.clientNo === "2").map((x) => x.kind + x.goals[0]), ["red1", "report2"])],
    ["Cockpit: Ziel 3 als Haushalt mit Hauptperson", () => { const x = K.callList(demoModel())[0]; return eq(x.unit, "household") || eq(x.h.dossierNo, "D9") || eq(x.p.clientNo, "HD9"); }],
    ["Cockpit: Kennzahlen = Liste; «erledigt» senkt die Zahl", () => {
      const items = K.callList(demoModel());
      return eq(K.kpis(items, new Set()), { act: 7, red: 3, report: 2, quality: 2 }) || eq(K.kpis(items, new Set([items[0].key])).red, 2);
    }],
    ["Cockpit: Filter Fallführung wirkt auf Personen und Haushalte", () => {
      const m = K.filterCM(demoModel(), "Anna");
      return eq(m.rows.map((r) => r.p.clientNo), ["1", "2"]) || eq(m.households.length, 0) || eq(K.kpis(K.callList(m), new Set()), { act: 3, red: 2, report: 1, quality: 0 });
    }],
    ["Cockpit: Filter «Alle» lässt alles", () => eq(K.filterCM(demoModel(), "").rows.length, 5)],
    ["Cockpit: Übersicht n < 5 ausgeblendet, ohne Zahlen", () => {
      const ov = K.overview(demoModel(), (p) => p.caseManager);
      return eq(ov.map((g) => [g.key, g.hidden, g.n ?? null, g.red ?? null]), [["Anna", true, null, null], ["Ben", true, null, null]]);
    }],
    ["Cockpit: Übersicht n ≥ 5 sichtbar, Ampeln über alle Ziele", () => {
      const ov = K.overview(demoModel(), () => "alle");
      return eq(ov[0], { key: "alle", n: 5, hidden: false, red: 3, yellow: 4, green: 2, grey: 2 });
    }],
    ["Cockpit: Grenze genau 5 → sichtbar, 4 → ausgeblendet", () => {
      const m = demoModel();
      return eq(K.overview(m, () => "x", 5)[0].hidden, false) || eq(K.overview({ ...m, rows: m.rows.slice(0, 4) }, () => "x", 5)[0].hidden, true);
    }],
    // ----- Muster (Level 2) -----
    ["Muster: kürzlich Eingereiste zählen nicht (Messung 24 Monate)", () => {
      const base = PT.fairBase([unit("2025-06-01", null), unit("2024-01-01", null), unit("2024-11-21", null)], TODAY, { type: "months", months: 24 });
      return eq(base.map((u) => u.entry), ["2024-01-01", "2024-11-21"]);
    }],
    ["Muster: Erfolg = erreicht innerhalb X Monaten nach Einreise", () => {
      const base = PT.fairBase([unit("2023-01-01", "2024-06-01"), unit("2023-01-01", "2025-06-01")], TODAY, { type: "months", months: 24 });
      return eq(base.map((u) => u.success), [true, false]);
    }],
    ["Muster: Messung «in Frist» nur mit Frist vor Stichtag", () => {
      const base = PT.fairBase([unit("2022-01-01", null, { state: "missed" }), unit("2024-06-01", null, { state: "open" }),
        unit("2022-05-01", "2024-01-01", { state: "reached" })], TODAY, { type: "deadline" });
      return eq(base.map((u) => [u.entry, u.success]), [["2022-01-01", false], ["2022-05-01", true]]);
    }],
    ["Muster: nicht im Zielbereich zählt nie", () => eq(PT.fairBase([unit("2020-01-01", null, { applicable: false })], TODAY, { type: "months", months: 12 }).length, 0)],
    ["Muster: Gruppen summieren sich zur Basis (n und erreicht)", () => {
      const list = [];
      for (let i = 0; i < 23; i++) list.push(unit("2022-01-01", i % 3 ? "2023-01-01" : null, { gender: i % 2 ? "Männlich" : "Weiblich", school: i }));
      const base = PT.fairBase(list, TODAY, { type: "months", months: 24 });
      const ok = ["gender", "school"].every((id) => {
        const g = PT.groupBy(base, factor(id), ctx0);
        return g.reduce((s, x) => s + x.n, 0) === base.length && g.reduce((s, x) => s + x.reached, 0) === base.filter((u) => u.success).length;
      });
      return eq(ok, true);
    }],
    ["Muster: Gruppe n < 5 ohne Zahlen, n = 5 sichtbar", () => {
      const m = PT.mask([{ code: "a", n: 4, reached: 2 }, { code: "b", n: 5, reached: 1 }], 0.5);
      return eq(m[0], { code: "a", hidden: true }) || eq([m[1].hidden, m[1].n, m[1].rate], [false, 5, 0.2]);
    }],
    ["Muster: Differenz zur Gesamtquote", () => eq(Math.round(PT.mask([{ code: "b", n: 10, reached: 8 }], 0.5)[0].diff * 100), 30)],
    ["Muster: seltene Muttersprachen → «andere»", () => {
      const list = [];
      for (let i = 0; i < 12; i++) list.push(unit("2022-01-01", null, { tongue: "Dari" }));
      for (let i = 0; i < 3; i++) list.push(unit("2022-01-01", null, { tongue: "Somali" }));
      return eq(PT.groupBy(list, factor("tongue"), ctx0).map((g) => [g.code, g.n]), [["Dari", 12], ["@other", 3]]);
    }],
    ["Muster: erster Sprachkurs nach Einreise ≤ 3 / > 12 Mt. / keiner", () => {
      const c = (start) => [{ type: "Förderangebot Sprache", start }];
      const f = factor("firstCourse");
      return eq([f.of(unit("2022-01-01", null, { support: c("2022-03-15") }), ctx0), f.of(unit("2022-01-01", null, { support: c("2023-06-01") }), ctx0),
        f.of(unit("2022-01-01", null), ctx0)], ["@le3", "@gt12m", "@none"]);
    }],
    ["Muster: geschichteter Vergleich blendet kleine Zellen aus", () => {
      const list = [];
      for (let i = 0; i < 6; i++) list.push(unit("2022-01-01", "2022-10-01", { school: 3, support: [{ type: "Förderangebot Sprache", start: "2022-02-01" }] }));
      for (let i = 0; i < 2; i++) list.push(unit("2022-01-01", null, { school: 3, support: [{ type: "Förderangebot Sprache", start: "2023-06-01" }] }));
      const r = PT.stratified(PT.fairBase(list, TODAY, { type: "months", months: 24 }), ctx0, factor("firstCourse"), "@le3", "@gt12m",
        (u) => (u.p.schoolYearsBefore <= 6 ? "0-6" : "7+"), ["0-6", "7+"]);
      return eq(r.map((x) => [x.stratum, x.a.n, x.a.rate, x.b.hidden]), [["0-6", 6, 1, true]]);
    }],
    ["Frühester gültiger Nachweis zählt", () => eq(R.goal1(person({ language: [lang("A2", "Zertifizierung", "2025-09-01"), lang("A1", "Zertifizierung", "2025-03-01")] }), TODAY).reachedDate, "2025-03-01")],
  ];

  // eq gibt bei Erfolg «false» zurück (damit «a || b» beide prüft), sonst eine Fehlermeldung.
  function eq(actual, expected) {
    return JSON.stringify(actual) === JSON.stringify(expected) ? false : `erwartet ${JSON.stringify(expected)}, erhalten ${JSON.stringify(actual)}`;
  }

  function runTests() {
    const results = TESTS.map(([name, fn]) => {
      try { const err = fn(); return { name, ok: !err, msg: err || "" }; }
      catch (e) { return { name, ok: false, msg: String(e) }; }
    });
    return { results, total: results.length, passed: results.filter((r) => r.ok).length };
  }

  root.Cockpit.runTests = runTests;
})(typeof window !== "undefined" ? window : this);
