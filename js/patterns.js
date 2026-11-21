/* Level 2 «Muster – Was hilft?» – reine Funktionen, ohne Oberfläche.
 *
 * Grundsatz: Muster auf Gruppenebene, nie eine Bewertung einzelner Personen.
 * Zusammenhänge, keine Beweise für Ursachen. Es gibt hier keine Personenlisten und keine Scores.
 *
 * Ablauf:
 *   units()    Personen (Ziel 1, 2) bzw. Haushalte (Ziel 3) mit Ergebnis aus rules.js
 *   fairBase() faire Messung – wer noch keine Zeit hatte, zählt nicht als Misserfolg
 *   groupBy()  Erfolgsquote pro Gruppe eines Faktors (Rohzahlen)
 *   mask()     Datenschutz: Gruppen mit n < 5 ohne Zahlen
 *   stratified(), topDifferences(), analyze()
 * Die Ziel-Regeln werden nur aufgerufen, nicht verändert.
 */
(function (root) {
  "use strict";
  const R = root.Cockpit.rules;

  const MIN_GROUP = 5;        // Datenschutz: kleinere Gruppen werden ausgeblendet (wie im Cockpit)
  const TONGUE_MIN = 10;      // Muttersprachen mit weniger Personen → «andere»
  const UNKNOWN = "@unknown", OTHER = "@other";
  // Kurse / Förderangebote (ohne Schule, Erstinformation und ohne Ausbildungen, die selbst Ziel 2 sind)
  const COURSE_TYPES = ["Förderangebot Sprache", "Förderangebot Arbeitsmarktfähigkeit oder Ausbildungsfähigkeit", "Förderangebot soziale Integration",
    "Brückenangebot", "Kurs Schlüsselkompetenzen", "Sprachkurs im erweiterten Verfahren (N)", "Beschäftigungsangebot (N)", "IV-Eingliederungsmassnahmen", "Arbeitsvermittlung RAV"];

  // ---------- Einheiten und faire Messung ----------
  function units(loaded, stichtag, goal) {
    const persons = R.buildPersons(loaded);
    if (goal === 3) return R.buildHouseholds(persons, loaded).map((h) => ({ kind: "household", h, p: h.head, entry: h.entryDate, g: R.goal3(h, stichtag) }));
    const evaluate = goal === 1 ? R.goal1 : R.goal2;
    return persons.map((p) => ({ kind: "person", h: null, p, entry: p.entryDate, g: evaluate(p, stichtag) }));
  }

  /* measure = { type: "deadline" }            → nur Fälle mit Frist vor Stichtag; Erfolg = in Frist erreicht
   * measure = { type: "months", months: 24 }  → nur Fälle mit Einreise ≥ X Monate vor Stichtag; Erfolg = erreicht ≤ X Monate nach Einreise */
  function fairBase(list, stichtag, measure) {
    const out = [];
    for (const u of list) {
      if (!u.g.applicable) continue;
      if (measure.type === "deadline") {
        if (!u.g.deadline || u.g.deadline >= stichtag) continue;
        out.push({ ...u, success: u.g.state === "reached" });
      } else {
        if (!u.entry || u.entry > R.addMonths(stichtag, -measure.months)) continue;
        const limit = R.addMonths(u.entry, measure.months);
        out.push({ ...u, success: !!(u.g.reachedDate && u.g.reachedDate <= limit) });
      }
    }
    return out;
  }

  // ---------- Faktoren ----------
  const bucket = (v, steps) => { for (const [max, code] of steps) if (v <= max) return code; return steps[steps.length - 1][1]; };
  const yesNo = (v) => (v === true ? "@yes" : v === false ? "@no" : UNKNOWN);
  const firstOf = (rows, field) => rows.map((r) => r[field]).filter(Boolean).sort()[0] || null;

  /* Jeder Faktor: id, Gruppe (tables | support | ai), für welche Ziele, Funktion → Gruppen-Code.
   * Codes mit «@» werden übersetzt (pg.*), alle anderen sind Werte aus den Daten bzw. Zahlenbereiche.
   * Bei Haushalten (Ziel 3) beziehen sich Personen-Faktoren auf die Hauptperson. */
  const FACTORS = [
    { id: "age", group: "tables", goals: [1, 2, 3], order: ["@lt16", "16-25", "26-35", "36-45", "46+"],
      of: (u) => (u.p.birthDate && u.p.entryDate ? bucket(R.ageAt(u.p.birthDate, u.p.entryDate), [[15, "@lt16"], [25, "16-25"], [35, "26-35"], [45, "36-45"], [Infinity, "46+"]]) : UNKNOWN) },
    { id: "gender", group: "tables", goals: [1, 2, 3], of: (u) => u.p.gender || UNKNOWN },
    { id: "school", group: "tables", goals: [1, 2, 3], order: ["0", "1-6", "7-12", "> 12"],
      of: (u) => (u.p.schoolYearsBefore === null || u.p.schoolYearsBefore === undefined ? UNKNOWN : bucket(u.p.schoolYearsBefore, [[0, "0"], [6, "1-6"], [12, "7-12"], [Infinity, "> 12"]])) },
    { id: "education", group: "tables", goals: [1, 2, 3], of: (u) => u.p.highestEducation || UNKNOWN },
    { id: "literacy", group: "tables", goals: [1, 2, 3], order: ["@latin", "@second", "@primary", "@noLatin"],
      of: (u) => {
        if (u.p.latinLiterate === "Ja") return "@latin";
        if (u.p.latinLiterate !== "Nein") return UNKNOWN;
        return /^Primär/.test(u.p.illiteracyType || "") ? "@primary" : /^Zweitschrift/.test(u.p.illiteracyType || "") ? "@second" : "@noLatin";
      } },
    { id: "tongue", group: "tables", goals: [1, 2, 3], collapseBelow: TONGUE_MIN, of: (u) => u.p.motherTongue || UNKNOWN },
    { id: "work", group: "tables", goals: [1, 2, 3], order: ["0", "1-5", "> 5"],
      of: (u) => (u.p.workYearsBefore === null || u.p.workYearsBefore === undefined ? UNKNOWN : bucket(u.p.workYearsBefore, [[0, "0"], [5, "1-5"], [Infinity, "> 5"]])) },
    { id: "status", group: "tables", goals: [1, 2, 3], order: ["VA", "@FL"],
      of: (u) => (String(u.p.status || "").replace(/\+\d+$/, "") === "VA" ? "VA" : "@FL") },
    // Unterstützung (vom ASD beeinflussbar)
    { id: "firstCourse", group: "support", goals: [1, 2, 3], order: ["@le3", "@m4_12", "@gt12m", "@none"],
      of: (u) => {
        const start = firstOf(u.p.rows.support.filter((r) => r.type === "Förderangebot Sprache"), "start");
        if (!start) return "@none";
        if (!u.p.entryDate) return UNKNOWN;
        return bucket(R.monthsBetween(u.p.entryDate, start), [[3, "@le3"], [12, "@m4_12"], [Infinity, "@gt12m"]]);
      } },
    { id: "courses", group: "support", goals: [1, 2, 3], order: ["0", "1", "2+"],
      of: (u) => bucket(u.p.rows.support.filter((r) => COURSE_TYPES.includes(r.type)).length, [[0, "0"], [1, "1"], [Infinity, "2+"]]) },
    { id: "collective", group: "support", goals: [1, 2, 3], order: ["@yes", "@no"],
      of: (u, ctx) => {
        const rows = u.p.rows.housing;
        if (!rows.length) return UNKNOWN;
        const days = rows.filter((r) => r.type === "Kollektivunterkunft" && r.from)
          .reduce((s, r) => s + (Date.parse(r.to && r.to < ctx.stichtag ? r.to : ctx.stichtag) - Date.parse(r.from)) / 864e5, 0);
        return days > 365 ? "@yes" : "@no";
      } },
    { id: "a1BeforeWork", group: "support", goals: [2], order: ["@yes", "@no"],
      // ja = A1 erreicht vor der ersten Arbeit (oder A1 erreicht und noch keine Arbeit)
      of: (u, ctx) => {
        const a1 = ctx.a1(u.p), job = firstOf(u.p.rows.jobs, "from");
        return a1 && (!job || a1 <= job) ? "@yes" : "@no";
      } },
    { id: "bridge", group: "support", goals: [2], order: ["@yes", "@no"],
      of: (u) => (u.p.rows.support.some((r) => r.type === "Brückenangebot") ? "@yes" : "@no") },
    // Haushalt (Ziel 3)
    { id: "hhWorkers", group: "support", goals: [3], order: ["0", "1", "2+"],
      of: (u, ctx) => bucket(u.h.members.filter((m) => m.rows.jobs.some((j) => j.from && j.from <= ctx.stichtag)).length, [[0, "0"], [1, "1"], [Infinity, "2+"]]) },
    { id: "hhSize", group: "tables", goals: [3], order: ["1", "2", "3-4", "5+"],
      of: (u) => bucket(u.h.members.length, [[1, "1"], [2, "2"], [4, "3-4"], [Infinity, "5+"]]) },
    { id: "kidsU4", group: "tables", goals: [3], order: ["@yes", "@no"],
      of: (u) => (!u.h.entryDate ? UNKNOWN : u.h.members.some((m) => m.birthDate && m.birthDate <= u.h.entryDate && R.ageAt(m.birthDate, u.h.entryDate) < 4) ? "@yes" : "@no") },
    // Situationsanalyse (optionale 12. Tabelle aus dem KI-Schritt)
    { id: "ai.workLimited", group: "ai", goals: [1, 2, 3], order: ["@yes", "@no"], of: (u, ctx) => yesNo(ctx.ai(u.p, "workLimited")) },
    { id: "ai.psych", group: "ai", goals: [1, 2, 3], order: ["@yes", "@no"], of: (u, ctx) => yesNo(ctx.ai(u.p, "psych")) },
    { id: "ai.childcare", group: "ai", goals: [1, 2, 3], order: ["@yes", "@no"], of: (u, ctx) => yesNo(ctx.ai(u.p, "childcare")) },
    { id: "ai.motivation", group: "ai", goals: [1, 2, 3], order: ["hoch", "mittel", "tief"], of: (u, ctx) => ctx.ai(u.p, "motivation") || UNKNOWN },
    { id: "ai.pace", group: "ai", goals: [1, 2, 3], order: ["schnell", "mittel", "langsam"], of: (u, ctx) => ctx.ai(u.p, "pace") || UNKNOWN },
  ];

  // Kontext für Faktoren: Stichtag, KI-Merkmale, A1-Datum (zwischengespeichert)
  function makeCtx(loaded, stichtag) {
    const ai = new Map();
    for (const r of loaded.merkmale ? loaded.merkmale.rows : []) if (r.zemis) ai.set(r.zemis, r);
    const a1Cache = new Map();
    return {
      stichtag, hasAI: ai.size > 0,
      ai: (p, field) => { const r = ai.get(p.zemis); return r ? r[field] : null; },
      a1: (p) => { if (!a1Cache.has(p)) a1Cache.set(p, R.goal1(p, stichtag).reachedDate); return a1Cache.get(p); },
    };
  }

  const factorsFor = (goal, hasAI) => FACTORS.filter((f) => f.goals.includes(goal) && (f.group !== "ai" || hasAI));

  // ---------- Gruppieren (Rohzahlen) ----------
  function groupBy(base, factor, ctx) {
    const m = new Map();
    const codes = base.map((u) => factor.of(u, ctx));
    if (factor.collapseBelow) {
      const cnt = new Map();
      codes.forEach((c) => cnt.set(c, (cnt.get(c) || 0) + 1));
      codes.forEach((c, i) => { if (c !== UNKNOWN && cnt.get(c) < factor.collapseBelow) codes[i] = OTHER; });
    }
    base.forEach((u, i) => {
      const c = codes[i];
      if (!m.has(c)) m.set(c, { code: c, n: 0, reached: 0 });
      const g = m.get(c); g.n++; if (u.success) g.reached++;
    });
    const order = factor.order || [];
    const rank = (c) => (c === UNKNOWN ? 1e6 : c === OTHER ? 1e5 : order.includes(c) ? order.indexOf(c) : 1000);
    return [...m.values()].sort((a, b) => rank(a.code) - rank(b.code) || b.n - a.n || String(a.code).localeCompare(String(b.code)));
  }

  // Datenschutz: Gruppen mit n < min ohne Zahlen. Quote und Differenz zur Gesamtquote für die übrigen.
  function mask(groups, overall, min = MIN_GROUP) {
    return groups.map((g) => (g.n < min ? { code: g.code, hidden: true }
      : { code: g.code, hidden: false, n: g.n, reached: g.reached, rate: g.reached / g.n, diff: g.reached / g.n - overall }));
  }

  // ---------- Geschichteter Vergleich ----------
  /* Vergleicht zwei Gruppen eines Faktors (a, b) getrennt innerhalb jeder Schicht eines anderen Faktors.
   * Ergebnis: [{stratum, a:{n,reached}|{hidden}, b:…}] */
  function stratified(base, ctx, cmp, aCode, bCode, strataFn, strataOrder, min = MIN_GROUP) {
    const cells = new Map();
    for (const u of base) {
      const s = strataFn(u); if (s === null) continue;
      const c = cmp.of(u, ctx); if (c !== aCode && c !== bCode) continue;
      if (!cells.has(s)) cells.set(s, { a: { n: 0, reached: 0 }, b: { n: 0, reached: 0 } });
      const cell = cells.get(s)[c === aCode ? "a" : "b"]; cell.n++; if (u.success) cell.reached++;
    }
    const show = (x) => (x.n < min ? { hidden: true } : { hidden: false, n: x.n, reached: x.reached, rate: x.reached / x.n });
    return strataOrder.filter((s) => cells.has(s)).map((s) => ({ stratum: s, a: show(cells.get(s).a), b: show(cells.get(s).b) }));
  }
  const schoolStratum = (u) => { const v = u.p.schoolYearsBefore; return v === null || v === undefined ? null : v <= 6 ? "0-6" : v <= 12 ? "7-12" : "> 12"; };
  const workStratum = (u) => { const v = u.p.workYearsBefore; return v === null || v === undefined ? null : v === 0 ? "0" : v <= 5 ? "1-5" : "> 5"; };

  // ---------- Stärkste Unterschiede ----------
  function topDifferences(perFactor, overall, k = 5, min = MIN_GROUP) {
    const all = [];
    for (const { factor, raw } of perFactor) {
      if (raw.length < 2) continue;
      for (const g of raw) {
        if (g.n < min || g.code === UNKNOWN || g.code === OTHER) continue;
        all.push({ factorId: factor.id, code: g.code, n: g.n, reached: g.reached, rate: g.reached / g.n, diff: g.reached / g.n - overall });
      }
    }
    return all.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff) || b.n - a.n).slice(0, k);
  }

  // ---------- Gesamtanalyse für ein Ziel und eine Messung ----------
  function analyze(loaded, stichtag, goal, measure) {
    const ctx = makeCtx(loaded, stichtag);
    const base = fairBase(units(loaded, stichtag, goal), stichtag, measure);
    const reached = base.filter((u) => u.success).length;
    const overall = base.length ? reached / base.length : null;
    const entries = base.map((u) => u.entry).filter(Boolean).sort();
    const summary = { n: base.length, reached, rate: overall, entryFrom: entries[0] || null, entryTo: entries[entries.length - 1] || null,
      unit: goal === 3 ? "household" : "person", enough: base.length >= MIN_GROUP };
    if (!summary.enough) return { summary, factors: [], strat: [], top: [], hasAI: ctx.hasAI };
    const perFactor = factorsFor(goal, ctx.hasAI).map((f) => ({ factor: f, raw: groupBy(base, f, ctx) }));
    const firstCourse = FACTORS.find((f) => f.id === "firstCourse"), bridge = FACTORS.find((f) => f.id === "bridge");
    const strat = [{ id: "course", rows: stratified(base, ctx, firstCourse, "@le3", "@gt12m", schoolStratum, ["0-6", "7-12", "> 12"]) }];
    if (goal === 2) strat.push({ id: "bridge", rows: stratified(base, ctx, bridge, "@yes", "@no", workStratum, ["0", "1-5", "> 5"]) });
    return {
      summary, hasAI: ctx.hasAI, strat,
      // Nur maskierte Gruppen nach aussen geben (Rohzahlen kleiner Gruppen verlassen diese Funktion nicht)
      factors: perFactor.map(({ factor, raw }) => ({ id: factor.id, group: factor.group, groups: mask(raw, overall) })),
      top: topDifferences(perFactor, overall),
    };
  }

  root.Cockpit = root.Cockpit || {};
  root.Cockpit.patterns = { analyze, units, fairBase, groupBy, mask, stratified, topDifferences, makeCtx, factorsFor, FACTORS, MIN_GROUP, UNKNOWN, OTHER };
})(typeof window !== "undefined" ? window : this);
