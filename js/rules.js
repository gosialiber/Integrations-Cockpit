/* Regeln der Integrationsziele – reine Funktionen, ohne Bezug zur Oberfläche.
 * Jede Annahme ist in ANNAHMEN.md beschrieben (Nummer in Klammern).
 * Datumswerte sind ISO-Texte «jjjj-mm-tt»; so lassen sie sich direkt vergleichen.
 */
(function (root) {
  "use strict";

  // ---------- Konstanten (hier anpassen) ----------
  const RULES = {
    // Status, für die die Ziele gelten (A3). N und S sind ausgeschlossen.
    scopeStatus: ["VA", "F-FL", "B-FL", "B-RSFL", "B-SL"],
    minAge: 16,
    goal1: {
      deadlineYears: 3,                       // Frist ab Einreise (Z1.1)
      levels: ["A1", "A2", "B1", "B2", "C1", "C2"], // A1 oder höher (Z1.3)
      proofTypes: ["Zertifizierung", "Muttersprache", "Beendigung obligatorische Schulzeit", "Beendigung Ausbildung"],
      reachedGoalType: "Sprachniveau A1",     // Bezeichnung in Integrationszielerreichung
    },
    redMonths: 6,                             // Ampel rot, wenn weniger als 6 Monate bis Frist (Z1.6)
    goal2: {
      minWorkload: 60,                        // Mindestpensum in % (Z2.3)
      months: 6,                              // Dauer ohne Unterbruch (Z2.3)
      gapDays: 7,                             // erlaubte Lücke bei Stellenwechsel (Z2.3)
      eduTypes: ["Sek II", "Tertiär"],        // Ausbildung zählt ab Start (Z2.5)
      redMonths: 12,                          // rot, wenn < 12 Monate bis Frist (Z2.6)
      reachedGoalType: "Aufnahme Ausbildung / Erwerbstätigkeit",
      zemisToleranceDays: 31,                 // Abgleich ZEMIS Tätigkeit ↔ Erwerb (Z2.8)
    },
    goal3: {
      months: 12,                             // 12 Monate ohne Sozialhilfe (Z3.4)
      noSupport: "Keine Unterstützung",       // Z3.3
      gapDays: 1,
      redMonths: 18,                          // rot, wenn < 18 Monate bis Frist (Z3.5)
      reachedGoalType: "Finanzielle Unabhängigkeit",
    },
    entryEvent: "Aufenthalt (Einreise)",
    birthEvent: "Aufenthalt (Geburt)",
    languageCourseType: "Förderangebot Sprache",
  };

  // ---------- Datumshilfen ----------
  const parts = (iso) => iso.split("-").map(Number);
  const fmt = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  function addMonths(iso, n) {
    const [y, m, d] = parts(iso);
    const total = y * 12 + (m - 1) + n;
    const ny = Math.floor(total / 12), nm = (total % 12) + 1;
    const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate(); // 29.02. + 1 Jahr → 28.02.
    return fmt(ny, nm, Math.min(d, last));
  }
  const addYears = (iso, n) => addMonths(iso, 12 * n);
  // Ganze Monate von a bis b (negativ, wenn b vor a liegt).
  function monthsBetween(a, b) {
    const [ay, am, ad] = parts(a), [by, bm, bd] = parts(b);
    let m = (by - ay) * 12 + (bm - am);
    if (m > 0 && bd < ad) m--;
    if (m < 0 && bd > ad) m++;
    return m;
  }
  const ageAt = (birth, at) => { const [by, bm, bd] = parts(birth), [y, m, d] = parts(at); return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0); };
  const toDay = (iso) => { const [y, m, d] = parts(iso); return Date.UTC(y, m - 1, d) / 864e5; };
  const fromDay = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
  const baseStatus = (st) => String(st || "").replace(/\+\d+$/, ""); // «B-FL+5» → «B-FL»
  const inScopeStatus = (st) => RULES.scopeStatus.includes(baseStatus(st));
  const todayIso = () => { const d = new Date(); return fmt(d.getFullYear(), d.getMonth() + 1, d.getDate()); };

  // ---------- Personen aus den Tabellen zusammenführen ----------
  /* loaded: Tabellen-ID → { rows } (aus parse.js).
   * Ergebnis: eine Person pro Zeile in Klient, mit den zugehörigen Zeilen der anderen Tabellen.
   * Verknüpfung über Zemis-Nr., ersatzweise über Klientennummer. */
  function buildPersons(loaded) {
    const rows = (id) => (loaded[id] ? loaded[id].rows : []);
    const index = (id) => {
      const byZemis = new Map(), byClient = new Map();
      for (const r of rows(id)) {
        if (r.zemis) { if (!byZemis.has(r.zemis)) byZemis.set(r.zemis, []); byZemis.get(r.zemis).push(r); }
        if (r.clientNo) { if (!byClient.has(r.clientNo)) byClient.set(r.clientNo, []); byClient.get(r.clientNo).push(r); }
      }
      return (k) => (k.zemis && byZemis.get(k.zemis)) || (k.clientNo && byClient.get(k.clientNo)) || [];
    };
    const ix = {
      events: index("asylgeschaeft"), language: index("sprachstand"), support: index("foerderung"),
      jobs: index("erwerb"), zemisJobs: index("zemisTaetigkeit"), reached: index("zielerreichung"),
      status: index("verfahrensstand"), housing: index("unterbringung"),
    };
    return rows("klient").map((k) => {
      const p = { ...k, rows: {} };
      for (const name in ix) p.rows[name] = ix[name](k);
      // Einreisedatum (A2): frühestes Ereignis «Aufenthalt (Einreise)», sonst «Aufenthalt (Geburt)»
      const dates = (type) => p.rows.events.filter((e) => e.eventType === type && e.eventDate).map((e) => e.eventDate).sort();
      const entry = dates(RULES.entryEvent)[0], birth = dates(RULES.birthEvent)[0];
      p.entryDate = entry || birth || null;
      p.entrySource = entry ? "entry" : birth ? "birth" : null;
      return p;
    });
  }

  // Aktuelle Klient:in (A1): Zuständigkeit nicht abgelaufen.
  const isCurrent = (p, today) => !p.respEnd || p.respEnd >= today;

  // ---------- Ziel 1 · Sprache A1 ----------
  /* Ergebnis:
   *   applicable  true/false
   *   state       'reached' | 'open' | 'risk' | 'missed' | 'late' | 'na'
   *   light       'green' | 'yellow' | 'red' | 'grey'
   *   deadline, reachedDate, reachedProof, reported, monthsLeft
   *   reasons     Liste von {key, vars} für die Begründung (Text kommt aus i18n)
   */
  function goal1(p, today) {
    const R = RULES.goal1;
    const res = { applicable: false, state: "na", light: "grey", deadline: null, reachedDate: null, reachedProof: null,
      reported: null, monthsLeft: null, lastCourse: null, currentLevel: null, reasons: [] };

    // Aktueller Sprachstand und letzter Sprachkurs (für die Begründung)
    const lang = [...p.rows.language].filter((r) => r.date).sort((a, b) => (a.date < b.date ? -1 : 1));
    const last = lang[lang.length - 1];
    if (last) res.currentLevel = { level: last.level, proofType: last.proofType, date: last.date };
    const courses = p.rows.support.filter((r) => r.type === RULES.languageCourseType && r.start).sort((a, b) => (a.start < b.start ? -1 : 1));
    if (courses.length) res.lastCourse = courses[courses.length - 1];

    // Zielbereich
    // «B-FL+5», «VA+7» = nach Ende der Zuständigkeit; für den Zielbereich zählt der Grundstatus.
    if (!inScopeStatus(p.status)) { res.reasons.push({ key: "r.statusOut", vars: { status: p.status || "–" } }); return res; }
    if (!p.entryDate) { res.reasons.push({ key: "r.noEntry" }); return res; }
    res.deadline = addYears(p.entryDate, R.deadlineYears);
    if (!p.birthDate) { res.reasons.push({ key: "r.noBirth" }); return res; }
    // «16+» (Z1.2): wird spätestens am Tag der Frist 16
    if (ageAt(p.birthDate, res.deadline) < RULES.minAge) { res.reasons.push({ key: "r.tooYoung", vars: { date: addYears(p.birthDate, RULES.minAge) } }); return res; }
    res.applicable = true;

    // A1 erreicht? (Z1.3) – frühester gültiger Nachweis
    const valid = lang.filter((r) => R.levels.includes(r.level) && R.proofTypes.includes(r.proofType));
    const reportedRow = p.rows.reached.filter((r) => r.goalType === R.reachedGoalType && r.reachedOn).sort((a, b) => (a.reachedOn < b.reachedOn ? -1 : 1))[0];
    if (valid.length) { res.reachedDate = valid[0].date; res.reachedProof = valid[0].proofType + (valid[0].remarks ? `, ${valid[0].remarks}` : ""); }
    if (reportedRow && (!res.reachedDate || reportedRow.reachedOn < res.reachedDate)) { res.reachedDate = reportedRow.reachedOn; res.reachedProof = res.reachedProof || "Integrationszielerreichung"; }
    res.reported = !!reportedRow;
    res.monthsLeft = monthsBetween(today, res.deadline);

    if (res.reachedDate && res.reachedDate <= res.deadline) {
      res.state = "reached"; res.light = "green";
      res.reasons.push({ key: "r.reached", vars: { date: res.reachedDate, proof: res.reachedProof } });
      if (!res.reported) res.reasons.push({ key: "r.notReported" }); // Z1.5
      return res;
    }
    if (res.reachedDate) {
      res.state = "late"; res.light = "red";
      res.reasons.push({ key: "r.late", vars: { date: res.reachedDate, deadline: res.deadline } });
      return res;
    }
    if (res.deadline < today) {
      res.state = "missed"; res.light = "red";
      res.reasons.push({ key: "r.missed", vars: { deadline: res.deadline } });
    } else {
      res.state = res.monthsLeft < RULES.redMonths ? "risk" : "open";
      res.light = res.state === "risk" ? "red" : "yellow";
      res.reasons.push({ key: "r.deadlineIn", vars: { deadline: res.deadline, months: res.monthsLeft } });
    }
    // Zusatzinfos: aktueller Stand und Kurs
    if (res.currentLevel) res.reasons.push({ key: "r.currentLevel", vars: { level: res.currentLevel.level, date: res.currentLevel.date } });
    if (!res.lastCourse) res.reasons.push({ key: "r.noCourse" });
    else if (res.lastCourse.end && res.lastCourse.end < today) res.reasons.push({ key: "r.courseEnded", vars: { date: res.lastCourse.end } });
    else res.reasons.push({ key: "r.courseRunning", vars: { title: res.lastCourse.title || "" } });
    return res;
  }

  // ---------- Hilfen für Zeiträume ----------
  /* Zusammenhängende Zeiträume, in denen die Summe der gleichzeitig laufenden Werte ≥ min ist.
   * items: [{from, to, value}], to = null bedeutet «läuft noch» (zählt bis Stichtag).
   * Lücken bis gapDays werden überbrückt. Ergebnis: [{from, to, ongoing}] (to inklusiv). */
  function periodsAbove(items, min, gapDays, stichtag) {
    const end = toDay(stichtag) + 1, ev = [];
    for (const it of items) {
      if (!it.from || it.from > stichtag || !(it.value > 0)) continue;
      const s = toDay(it.from), e = Math.min(it.to ? toDay(it.to) + 1 : end, end);
      if (e > s) ev.push([s, it.value], [e, -it.value]);
    }
    ev.sort((a, b) => a[0] - b[0]);
    const segs = [];
    let sum = 0, start = null;
    for (let i = 0; i < ev.length; i++) {
      sum += ev[i][1];
      if (i + 1 < ev.length && ev[i + 1][0] === ev[i][0]) continue; // gleicher Tag: erst alle Änderungen
      if (sum >= min && start === null) start = ev[i][0];
      else if (sum < min && start !== null) { segs.push([start, ev[i][0]]); start = null; }
    }
    if (start !== null) segs.push([start, end]);
    const merged = [];
    for (const sg of segs) {
      const last = merged[merged.length - 1];
      if (last && sg[0] - last[1] <= gapDays) last[1] = Math.max(last[1], sg[1]);
      else merged.push([...sg]);
    }
    return merged.map(([s, e]) => ({ from: fromDay(s), to: fromDay(e - 1), ongoing: e >= end }));
  }
  /* Erstes Datum, an dem ein Zeitraum volle «months» Monate gedauert hat (oder null).
   * Beispiel 6 Monate: 01.01.–30.06. ist voll → erreicht am 01.07.
   * Bei laufendem Zeitraum (bis Stichtag) muss dieses Datum spätestens am Stichtag liegen. */
  function firstFullPeriod(periods, months) {
    for (const p of periods) {
      const r = addMonths(p.from, months);
      const limit = p.ongoing ? toDay(p.to) : toDay(p.to) + 1;
      if (toDay(r) <= limit) return { date: r, period: p };
    }
    return null;
  }
  const sumActive = (items, at) => items.filter((x) => x.from && x.from <= at && (!x.to || x.to >= at)).reduce((s, x) => s + (x.value || 0), 0);

  // Gemeinsamer Abschluss: Ampel aus Frist, erreicht und laufender Periode.
  function finish(res, today, { reachedDate, reachedReason, reported, running, needMonths, redMonths, keys }) {
    res.monthsLeft = monthsBetween(today, res.deadline);
    res.reported = reported;
    if (reachedDate && reachedDate <= res.deadline) {
      res.state = "reached"; res.light = "green"; res.reachedDate = reachedDate;
      res.reasons.unshift(reachedReason);
      if (!reported) res.reasons.push({ key: "r.notReported" });
      return res;
    }
    if (reachedDate) { res.state = "late"; res.light = "red"; res.reachedDate = reachedDate; res.reasons.unshift({ key: keys.late, vars: { date: reachedDate, deadline: res.deadline } }); return res; }
    if (res.deadline < today) { res.state = "missed"; res.light = "red"; res.reasons.unshift({ key: keys.missed, vars: { deadline: res.deadline } }); return res; }
    res.reasons.unshift({ key: "r.respEndIn", vars: { deadline: res.deadline, months: res.monthsLeft } });
    if (running) {
      res.expected = addMonths(running.from, needMonths);
      const ok = res.expected <= res.deadline;
      res.state = ok ? "open" : "risk"; res.light = ok ? "yellow" : "red";
      res.reasons.push({ key: ok ? keys.expected : keys.tooLate, vars: { date: running.from, expected: res.expected } });
    } else {
      res.state = res.monthsLeft < redMonths ? "risk" : "open";
      res.light = res.state === "risk" ? "red" : "yellow";
    }
    return res;
  }

  // ---------- Ziel 2 · Arbeit ≥ 60 % (6 Monate) oder Ausbildung ----------
  function goal2(p, today) {
    const R = RULES.goal2;
    const res = { applicable: false, state: "na", light: "grey", deadline: null, reachedDate: null, reachedProof: null,
      reported: null, monthsLeft: null, expected: null, workloadNow: 0, reasons: [], quality: [] };
    // Datenqualität (Z2.8): ZEMIS-Meldung ohne passende Anstellung im Erwerb
    for (const z of p.rows.zemisJobs) {
      if (!z.start) continue;
      const match = p.rows.jobs.some((j) => j.from && Math.abs(toDay(j.from) - toDay(z.start)) <= R.zemisToleranceDays);
      if (!match) res.quality.push({ key: "q.zemisOnly", vars: { company: z.company || "?", date: z.start } });
    }
    if (!inScopeStatus(p.status)) { res.reasons.push({ key: "r.statusOut", vars: { status: p.status || "–" } }); return res; }
    if (!p.respEnd) { res.reasons.push({ key: "r.noRespEnd" }); return res; }
    res.deadline = p.respEnd;
    if (!p.birthDate) { res.reasons.push({ key: "r.noBirth" }); return res; }
    if (ageAt(p.birthDate, res.deadline) < RULES.minAge) { res.reasons.push({ key: "r.tooYoung", vars: { date: addYears(p.birthDate, RULES.minAge) } }); return res; }
    res.applicable = true;

    // Ausbildung (Z2.5)
    const edu = p.rows.support.filter((r) => R.eduTypes.includes(r.type) && r.start && r.start <= today).sort((a, b) => (a.start < b.start ? -1 : 1))[0];
    // Arbeit (Z2.3)
    const jobs = p.rows.jobs.map((j) => ({ from: j.from, to: j.to, value: j.workload }));
    const periods = periodsAbove(jobs, R.minWorkload, R.gapDays, today);
    const full = firstFullPeriod(periods, R.months);
    res.workloadNow = sumActive(jobs, today);
    const cands = [];
    if (edu) cands.push({ date: edu.start, reason: { key: "r2.reachedEdu", vars: { type: edu.type, date: edu.start, title: edu.title || "" } }, proof: `${edu.type}: ${edu.title || ""}` });
    if (full) cands.push({ date: full.date, reason: { key: "r2.reachedWork", vars: { date: full.date, from: full.period.from } }, proof: `Erwerb ≥ ${R.minWorkload} % ab ${full.period.from}` });
    cands.sort((a, b) => (a.date < b.date ? -1 : 1));
    const best = cands.find((c) => c.date <= res.deadline) || cands[0];
    if (best) res.reachedProof = best.proof;

    // Aktuelle Situation (für Begründung)
    const running = periods.find((x) => x.ongoing) || null;
    if (!running) {
      if (res.workloadNow > 0) res.reasons.push({ key: "r2.partTime", vars: { pct: res.workloadNow } });
      else {
        const last = p.rows.jobs.filter((j) => j.to && j.to < today).sort((a, b) => (a.to < b.to ? 1 : -1))[0];
        res.reasons.push(last ? { key: "r2.lastJobEnded", vars: { date: last.to } } : { key: "r2.noWork" });
      }
    }
    const reported = p.rows.reached.some((r) => r.goalType === R.reachedGoalType);
    finish(res, today, { reachedDate: best ? best.date : null, reachedReason: best ? best.reason : null, reported, running, needMonths: R.months,
      redMonths: R.redMonths, keys: { late: "r2.late", missed: "r2.missed", expected: "r2.working", tooLate: "r2.workingTooLate" } });
    return res;
  }

  // ---------- Haushalte ----------
  /* Ein Haushalt pro Dossier-Nr. aus Klient, mit Mitgliedern (Personen) und Zeilen aus Finanzielle Unterstützung. */
  function buildHouseholds(persons, loaded) {
    const fin = new Map();
    for (const r of loaded.finanz ? loaded.finanz.rows : []) {
      if (!r.dossierNo) continue;
      if (!fin.has(r.dossierNo)) fin.set(r.dossierNo, []);
      fin.get(r.dossierNo).push(r);
    }
    const hh = new Map();
    for (const p of persons) {
      if (!p.dossierNo) continue;
      if (!hh.has(p.dossierNo)) hh.set(p.dossierNo, { dossierNo: p.dossierNo, members: [], fin: fin.get(p.dossierNo) || [] });
      hh.get(p.dossierNo).members.push(p);
    }
    for (const h of hh.values()) {
      // Dossierträger/-in: laut Dossierperson nicht im Klient-Export → älteste erwachsene Person, sonst erste
      h.head = [...h.members].sort((a, b) => String(a.birthDate || "9999").localeCompare(String(b.birthDate || "9999")))[0];
      h.caseManager = h.head.caseManager;
      h.entryDate = h.members.map((m) => m.entryDate).filter(Boolean).sort()[0] || null;
      h.status = h.head.status;
    }
    return [...hh.values()];
  }
  const householdCurrent = (h, today) => h.members.some((m) => isCurrent(m, today));

  // ---------- Ziel 3 · 12 Monate ohne Sozialhilfe ----------
  function goal3(h, today) {
    const R = RULES.goal3;
    const res = { applicable: false, state: "na", light: "grey", deadline: null, reachedDate: null, reachedProof: null,
      reported: null, monthsLeft: null, expected: null, workloadNow: 0, reasons: [], quality: [] };
    const scope = h.members.filter((m) => inScopeStatus(m.status));
    if (!scope.length) { res.reasons.push({ key: "r.statusOut", vars: { status: h.status || "–" } }); return res; }
    const ends = scope.map((m) => m.respEnd).filter(Boolean).sort();
    if (!ends.length) { res.reasons.push({ key: "r.noRespEnd" }); return res; }
    res.deadline = ends[ends.length - 1]; // Z3.2
    if (!h.fin.length) { res.reasons.push({ key: "r3.noFin" }); return res; }
    res.applicable = true;

    const free = h.fin.filter((r) => r.support === R.noSupport).map((r) => ({ from: r.from, to: r.to, value: 1 }));
    const periods = periodsAbove(free, 1, R.gapDays, today);
    const full = firstFullPeriod(periods, R.months);
    const running = periods.find((x) => x.ongoing) || null;
    if (full) res.reachedProof = `${R.noSupport} ab ${full.period.from}`;
    // Erwerb im Haushalt heute (Summe der Pensen aller Mitglieder)
    res.workloadNow = h.members.reduce((s, m) => s + sumActive(m.rows.jobs.map((j) => ({ from: j.from, to: j.to, value: j.workload })), today), 0);
    if (!running) {
      const cur = h.fin.filter((r) => r.from && r.from <= today && (!r.to || r.to >= today)).sort((a, b) => (a.from < b.from ? 1 : -1))[0];
      if (cur) res.reasons.push({ key: "r3.onSupport", vars: { support: cur.support, date: cur.from } });
      res.reasons.push({ key: "r3.income", vars: { pct: res.workloadNow } });
    }
    const reported = h.members.some((m) => m.rows.reached.some((r) => r.goalType === R.reachedGoalType));
    finish(res, today, { reachedDate: full ? full.date : null, reachedReason: full ? { key: "r3.reached", vars: { from: full.period.from, date: full.date } } : null,
      reported, running, needMonths: R.months, redMonths: R.redMonths,
      keys: { late: "r3.late", missed: "r3.missed", expected: "r3.offSince", tooLate: "r3.offTooLate" } });
    return res;
  }

  root.Cockpit = root.Cockpit || {};
  root.Cockpit.rules = { RULES, buildPersons, buildHouseholds, householdCurrent, isCurrent, goal1, goal2, goal3, periodsAbove, addMonths, addYears, monthsBetween, ageAt, todayIso };
})(typeof window !== "undefined" ? window : this);
