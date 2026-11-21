/* Generator für synthetische Testdaten (fiktive Personen, keine echten Klient:innen).
 *
 * Erzeugt die 11 Exporte im Format von templates/ sowie pro Haushalt eine
 * Situationsanalyse als Text. Die Daten enthalten bewusst eingebaute Muster,
 * damit die Analyse (Level 2) etwas finden kann:
 *   - Sprachkurs besucht            → A1 deutlich schneller
 *   - Primäranalphabet/-in          → A1 deutlich langsamer
 *   - psychisch belastet (Text)     → A1 und Arbeit langsamer
 *   - Betreuung Kleinkinder (Text)  → weniger Kurse, Arbeit später, tieferes Pensum
 *   - hohe Motivation (Text)        → schneller
 *   - lange Kollektivunterkunft     → etwas langsamer
 *   - A1 erreicht, Arbeitserfahrung → Arbeit früher
 * Ausserdem Datenqualitäts-Fälle: fehlende Einreise, nicht gemeldete Arbeit (nur ZEMIS),
 * erreichte Ziele, die noch nicht in Integrationszielerreichung erfasst sind.
 *
 * Läuft im Browser (tools/generator.html) und in macOS JXA (tools/generate.jxa.js).
 * Benötigt XLSX (SheetJS) und Cockpit.TABLES (js/schema.js).
 */
(function (root) {
  "use strict";

  // ---------- Zufall (reproduzierbar über seed) ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- Datum als Tageszahl (UTC-Tage seit 1970) ----------
  const DAY = 864e5;
  const day = (y, m, d) => Math.floor(Date.UTC(y, m - 1, d) / DAY);
  const ymd = (n) => { const d = new Date(n * DAY); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };
  function addMonths(n, months) {
    const [y, m, d] = ymd(n);
    const total = y * 12 + (m - 1) + Math.round(months);
    const ny = Math.floor(total / 12), nm = (total % 12) + 1;
    const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
    return day(ny, nm, Math.min(d, last));
  }
  const addYears = (n, y) => addMonths(n, 12 * y);
  const chDate = (n) => { const [y, m, d] = ymd(n); return `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${y}`; };
  const yearOf = (n) => ymd(n)[0];
  const ageAt = (birth, at) => { const [by, bm, bd] = ymd(birth), [y, m, d] = ymd(at); return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0); };

  // ---------- Stammdaten für die Fiktion ----------
  const ORIGINS = [
    { land: "Afghanistan", tongues: ["Dari", "Paschtu"], w: 22, school: [0, 12], latin: 0.2, status: [["VA", 4], ["F-FL", 2], ["B-FL", 3], ["B-RSFL", 0.5]],
      first: { m: ["Ahmad", "Mohammad", "Ali", "Hamid", "Farid", "Rahim", "Javid", "Nasir"], f: ["Fatima", "Zahra", "Maryam", "Shabnam", "Parwana", "Nadia", "Laila", "Fereshta"] },
      last: ["Haidari", "Rahimi", "Ahmadi", "Karimi", "Noori", "Sultani", "Hosseini", "Wardak"] },
    { land: "Eritrea", tongues: ["Tigrinya"], w: 18, school: [2, 12], latin: 0.3, status: [["B-FL", 6], ["F-FL", 2], ["VA", 1]],
      first: { m: ["Yonas", "Tesfay", "Merhawi", "Daniel", "Filmon", "Habtom", "Samuel", "Robel"], f: ["Selam", "Helen", "Saba", "Ruth", "Senait", "Luwam", "Mebrat", "Yordanos"] },
      last: ["Tesfamariam", "Gebremedhin", "Haile", "Kidane", "Berhe", "Tekle", "Ghebreab", "Woldu"] },
    { land: "Syrien", tongues: ["Arabisch", "Kurdisch"], w: 14, school: [4, 16], latin: 0.45, status: [["B-FL", 4], ["VA", 4], ["F-FL", 1], ["B-RSFL", 1]],
      first: { m: ["Omar", "Khaled", "Ahmad", "Mahmoud", "Yusuf", "Hassan", "Bilal", "Rami"], f: ["Amina", "Rana", "Nour", "Hiba", "Lina", "Rasha", "Dalia", "Samira"] },
      last: ["Al-Hassan", "Haddad", "Khalil", "Darwish", "Mansour", "Othman", "Saleh", "Ibrahim"] },
    { land: "Türkei", tongues: ["Kurdisch", "Türkisch"], w: 10, school: [5, 16], latin: 0.95, status: [["B-FL", 7], ["VA", 1]],
      first: { m: ["Mehmet", "Ahmet", "Mustafa", "Emre", "Serdar", "Baran", "Deniz", "Kemal"], f: ["Ayse", "Elif", "Zeynep", "Hatice", "Leyla", "Rojda", "Berfin", "Emine"] },
      last: ["Yilmaz", "Demir", "Kaya", "Aydin", "Özdemir", "Arslan", "Dogan", "Polat"] },
    { land: "Somalia", tongues: ["Somali"], w: 6, school: [0, 10], latin: 0.55, status: [["VA", 5], ["B-FL", 1]],
      first: { m: ["Abdi", "Mohamed", "Hassan", "Abdullahi", "Yusuf", "Ali", "Omar", "Farah"], f: ["Hodan", "Fadumo", "Ayaan", "Sahra", "Hibo", "Nimco", "Ifrah", "Khadra"] },
      last: ["Warsame", "Abdi", "Hirsi", "Nur", "Farah", "Jama", "Osman", "Aden"] },
    { land: "Sri Lanka", tongues: ["Tamil"], w: 5, school: [6, 14], latin: 0.6, status: [["B-FL", 3], ["VA", 1]],
      first: { m: ["Kumaran", "Suresh", "Rajan", "Tharshan", "Vithushan", "Prakash", "Nimal", "Kajan"], f: ["Kavitha", "Priya", "Thushani", "Nirmala", "Sharmila", "Vanitha", "Malathi", "Janani"] },
      last: ["Sivakumar", "Rajendran", "Thanabalasingham", "Kandiah", "Selvarajah", "Arumugam", "Navaratnam", "Pillai"] },
    { land: "Irak", tongues: ["Arabisch", "Kurdisch"], w: 5, school: [3, 14], latin: 0.4, status: [["VA", 3], ["B-FL", 2]],
      first: { m: ["Ali", "Hussein", "Karwan", "Ahmed", "Haider", "Saman", "Zaid", "Mustafa"], f: ["Zainab", "Shilan", "Noor", "Huda", "Sara", "Avin", "Rawa", "Shirin"] },
      last: ["Al-Jabouri", "Kareem", "Mahmood", "Rasul", "Abdullah", "Hamad", "Salih", "Aziz"] },
    { land: "Iran", tongues: ["Persisch"], w: 5, school: [8, 16], latin: 0.7, status: [["B-FL", 4], ["VA", 1]],
      first: { m: ["Reza", "Amir", "Mehdi", "Babak", "Saeed", "Hossein", "Arash", "Kian"], f: ["Narges", "Mina", "Leila", "Shirin", "Parisa", "Sara", "Neda", "Mahsa"] },
      last: ["Rostami", "Moradi", "Jafari", "Rezaei", "Ebrahimi", "Ghasemi", "Sadeghi", "Kazemi"] },
    { land: "Äthiopien", tongues: ["Amharisch", "Oromo"], w: 4, school: [2, 12], latin: 0.3, status: [["VA", 3], ["B-FL", 1]],
      first: { m: ["Dawit", "Abebe", "Tadesse", "Kebede", "Mulugeta", "Getachew", "Bekele", "Solomon"], f: ["Tigist", "Meron", "Hirut", "Almaz", "Bethlehem", "Selamawit", "Mahlet", "Tsion"] },
      last: ["Tadesse", "Bekele", "Girma", "Alemu", "Mengistu", "Desta", "Wolde", "Ayele"] },
    { land: "Ukraine", tongues: ["Ukrainisch", "Russisch"], w: 7, school: [10, 16], latin: 0.9, status: [["S", 1]],
      first: { m: ["Oleksandr", "Andrii", "Dmytro", "Serhii", "Mykola", "Ivan", "Yurii", "Taras"], f: ["Olena", "Iryna", "Natalia", "Tetiana", "Oksana", "Yuliia", "Svitlana", "Kateryna"] },
      last: ["Kovalenko", "Shevchenko", "Bondarenko", "Tkachenko", "Kravchenko", "Melnyk", "Boyko", "Oliinyk"] },
  ];

  // Fiktive Sozialarbeitende (Format wie im Template: «Hans Muster»).
  const CASE_MANAGERS = ["Laura Keller", "Marco Rossi", "Sabine Brunner", "Daniel Huber", "Aylin Meier", "Thomas Graf"];
  const PLZ_BERN = [["3004", "Bern"], ["3005", "Bern"], ["3006", "Bern"], ["3007", "Bern"], ["3008", "Bern"], ["3010", "Bern"],
    ["3011", "Bern"], ["3012", "Bern"], ["3013", "Bern"], ["3014", "Bern"], ["3015", "Bern"], ["3018", "Bern"], ["3027", "Bern"]];
  const EMPLOYERS = [["Reinigung Aaretal GmbH", "Bern"], ["Logistik Muster AG", "Ostermundigen"], ["Pflegeheim Sonnhalde", "Köniz"],
    ["Restaurant Linde", "Bern"], ["Bau Beispiel AG", "Bern"], ["Gärtnerei Grünfeld", "Muri bei Bern"], ["Hotel Bärenplatz", "Bern"],
    ["Bäckerei Musterbrot", "Bern"], ["Spitex Region Bern", "Bern"], ["Velokurier Bern", "Bern"], ["Lager & Versand Wankdorf AG", "Bern"],
    ["Kantine Bundesgasse", "Bern"], ["Malerei Farbtupf GmbH", "Worb"], ["Temporärbüro Personal Plus", "Bern"]];
  const JOB_FIELDS = ["Bau", "Landwirtschaft", "Schneiderei", "Verkauf", "Gastronomie", "Transport / Fahrer", "Pflege",
    "Coiffeur", "Mechanik", "Lehrperson", "Buchhaltung", "IT", "Reinigung", "Handwerk (Schreiner)"];
  const LANG_COURSES = { alpha: ["Alphabetisierung 1 halbintensiv", "Alphabetisierung 2 halbintensiv"],
    a1: ["Deutsch A1 Aufbaukurs", "A1 express", "A1.2 halbintensiv", "Deutsch Grundstufe 1 halbintensiv (fide-Label)", "Deutsch A1 Aufbaukurs szenariobasiert halbintensiv"],
    a2: ["Deutsch A2.1 kompakt 20", "Deutsch Grundstufe A2.1/A2.2 szenariobasiert halbintensiv"] };
  const LANG_INST = ["HEKS Regionalstelle Bern", "Heilsarmee LernPunkt", "HEKS Perspektive", "Sprachschule Muster Bern"];
  const SEK2 = ["Baupraktiker EBA", "Fachfrau/Fachmann Gesundheit EFZ", "Logistiker EBA", "Küchenangestellte/r EBA", "Detailhandelsassistent/in EBA", "Bauzeichner/in EFZ"];
  const OUTCOME_CODE = { "Asylgewährung Art. 3, 7": 1101, "Asylgewährung Art. 51.1": 1105, "Ablehnung mit Fl.-Eigenschaft Art 3, 7": 2203,
    "Ablehnung Art. 3, 7": 2201, "Vorübergehender Schutz gewährt": 7701 };
  const AFTER_END = { "B-FL": "B-FL+5", "B-SL": "B-SL+5", "B-RSFL": "B-RSFL+7", "VA": "VA+7", "F-FL": "F-FL+7" };

  function generate(opts = {}) {
    const seed = opts.seed ?? 20261121;
    const TODAY = opts.today ? day(...opts.today) : day(2026, 11, 21);
    const H = opts.households ?? 160;
    const rnd = mulberry32(seed);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const chance = (p) => rnd() < p;
    const randint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const wpick = (pairs) => { const tot = pairs.reduce((s, p) => s + p[1], 0); let r = rnd() * tot; for (const p of pairs) { if ((r -= p[1]) < 0) return p[0]; } return pairs[0][0]; };
    const normal = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

    const T = {}; // Tabellen-ID → Zeilen (Objekte mit Feld-IDs)
    for (const t of root.Cockpit.TABLES) if (!t.optional) T[t.id] = []; // optionale Tabelle entsteht erst im KI-Schritt
    const texts = [];
    const usedZemis = new Set();
    let nextClient = 40001;
    const newZemis = () => { let z; do { z = String(randint(20000000, 29999999)); } while (usedZemis.has(z)); usedZemis.add(z); return z; };

    for (let h = 0; h < H; h++) {
      const o = wpick(ORIGINS.map((x) => [x, x.w]));
      // Einreise: 2019 bis 10.2026, jüngere Jahre häufiger.
      // ~15 % mit Einreise 6–36 Monate vor heute minus 3 Jahre, d.h. A1-Frist läuft in den nächsten 6 Monaten ab
      // (damit die Ansicht «wen rufe ich diese Woche an?» genug dringende Fälle zeigt).
      const soon = [addMonths(TODAY, -36) + 5, addMonths(TODAY, -30) - 5];
      const entry = chance(0.15) ? randint(soon[0], soon[1])
        : Math.floor(day(2019, 1, 1) + Math.pow(rnd(), 0.75) * (TODAY - 40 - day(2019, 1, 1)));
      let status = wpick(o.status);
      const isS = status === "S";
      const resettled = status === "B-RSFL";
      const application = resettled ? entry : entry + randint(0, 10);
      const pending = !isS && !resettled && TODAY - entry < 300 && chance(0.6); // Entscheid noch offen → N
      const decision = resettled ? entry : isS ? entry + randint(5, 40) : addMonths(application, randint(3, 20));
      if (pending) status = "N (Asylsuchende)";
      const respStart = pending ? entry + randint(10, 60) : decision + randint(0, 30);
      const cm = pick(CASE_MANAGERS);
      const dossierNo = `D12.${10000 + h * 7 + randint(0, 6)}`;
      const tongue = pick(o.tongues);
      const lastName = pick(o.last);

      // Haushaltsform
      const form = wpick([["single", 40], ["couple", 15], ["family", 45]]);
      const headGender = form === "single" ? (chance(0.7) ? "Männlich" : "Weiblich") : (chance(0.85) ? "Männlich" : "Weiblich");
      const headAge = form === "single" ? randint(18, 45) : randint(22, 52);
      const members = [];
      const mk = (rel, gender, birth, ownEntry) => ({ rel, gender, birth, entry: ownEntry, zemis: newZemis(), clientNo: String(nextClient++),
        first: pick(o.first[gender === "Männlich" ? "m" : "f"]) });
      members.push(mk("Dossierträger/-in", headGender, addYears(entry, -headAge) - randint(0, 360), entry));
      const reunification = form !== "single" && !isS && chance(0.15); // Familiennachzug: Rest der Familie kommt später
      const famEntry = reunification ? Math.min(addMonths(entry, randint(12, 30)), TODAY - 30) : entry;
      if (form !== "single") {
        const g = headGender === "Männlich" ? "Weiblich" : "Männlich";
        members.push(mk("Ehefrau / -mann", g, addYears(entry, -(headAge + randint(-6, 3))) - randint(0, 360), famEntry));
      }
      if (form === "family") {
        const nKids = wpick([[1, 3], [2, 4], [3, 3], [4, 2], [5, 1]]);
        for (let k = 0; k < nKids; k++) {
          // In der Schweiz geboren nur, wenn die Familie schon > 8 Monate hier ist; Geburt immer vor dem Stichtag.
          const canBeBornHere = TODAY - entry - 30 > 240;
          const born = canBeBornHere && chance(0.15) ? entry + randint(240, TODAY - entry - 30) : addYears(entry, -randint(0, Math.min(19, headAge - 18))) - randint(0, 360);
          const inCH = born > famEntry;
          members.push(mk("Tochter / Sohn", chance(0.5) ? "Männlich" : "Weiblich", born, inCH ? born : famEntry));
          members[members.length - 1].bornInCH = inCH;
        }
      }
      if (isS) members.forEach((m) => { m.entry = entry; });

      // Zuständigkeitsende nach Regel (FL: 5 J. ab Asylgesuch, VA/F-FL: 7 J. ab Einreise)
      const youngKids = members.filter((m) => m.rel === "Tochter / Sohn" && ageAt(m.birth, Math.max(entry, m.birth)) < 4).length;

      for (const m of members) {
        m.status = status;
        m.application = m.bornInCH ? m.birth : (m.entry === entry ? application : m.entry + randint(0, 10));
        m.respStart = Math.max(respStart, m.entry);
        if (["B-FL", "B-RSFL", "B-SL"].includes(status)) m.respEnd = addYears(m.application, 5);
        else if (["VA", "F-FL"].includes(status)) m.respEnd = addYears(m.entry, 7);
        else m.respEnd = null;
        m.ended = m.respEnd && m.respEnd < TODAY;
        m.currentStatus = m.ended ? AFTER_END[status] : status;
        m.ageEntry = ageAt(m.birth, m.entry);
        const adult = m.ageEntry >= 16;
        // Versteckte Merkmale (erscheinen nur im Text der Situationsanalyse)
        const sy = adult ? clamp(Math.round(o.school[0] + rnd() * (o.school[1] - o.school[0]) + normal()), 0, 18) : Math.max(0, m.ageEntry - 6);
        m.schoolYears = sy;
        m.latin = adult ? (chance(o.latin + (sy >= 10 ? 0.25 : 0)) ? "Ja" : "Nein") : (m.ageEntry >= 8 ? "Ja" : null);
        m.illiteracy = m.latin === "Nein" ? (sy < 3 ? "Primäranalphabet/-in" : "Zweitschriftlernende/-r") : null;
        m.workYears = adult ? clamp(Math.round((m.ageEntry - 16 - Math.min(sy, 12) / 3) * rnd()), 0, 35) : 0;
        m.education = !adult ? null : sy >= 15 && chance(0.3) ? "32 Hochschule" : sy >= 12 && chance(0.3) ? "24 Sekundarstufe II: Allgemeinbildung"
          : sy >= 9 && chance(0.2) ? "22 Sekundarstufe II: Berufsbildung" : sy >= 9 ? "130 Obligatorische Schule" : "0 Keine in der Schweiz anerkannte Ausbildung";
        m.psych = adult && chance(0.25);
        m.phys = adult && chance(0.15);
        m.childcare = adult && youngKids > 0 && (m.gender === "Weiblich" || members.length === 1 + members.filter((x) => x.rel === "Tochter / Sohn").length) ;
        m.motivation = adult ? wpick([["hoch", 40], ["mittel", 45], ["tief", 15]]) : null;
        m.pace = !adult ? null : sy < 4 ? "langsam" : sy >= 10 && chance(0.6) ? "schnell" : "mittel";
        m.ict = !adult ? null : sy >= 12 ? pick(["gut", "Grundkenntnisse"]) : sy >= 6 ? pick(["Grundkenntnisse", "keine"]) : "keine";
        m.license = adult && m.gender === "Männlich" ? chance(0.4) : adult && chance(0.1);
        m.jobField = adult && m.workYears > 0 ? pick(JOB_FIELDS) : null;
        m.cooperation = adult ? wpick([["gut", 60], ["mittel", 30], ["schwierig", 10]]) : null;
        m.collectiveMonths = clamp(Math.round(Math.exp(Math.log(6) + 0.8 * normal())), 1, 40);
        m.marital = form === "single" ? (m.ageEntry >= 16 ? wpick([["Ledig", 8], ["Geschieden", 1], ["Verwitwet", 1]]) : "Ledig") : m.rel === "Tochter / Sohn" ? "Ledig" : "Verheiratet";
      }

      // ---------- Sprache, Kurse, Arbeit pro Person ----------
      for (const m of members) {
        const adult = m.ageEntry >= 16;
        const outOfScope = isS || pending;
        // Erstinformation für alle Erwachsenen
        if (adult) T.foerderung.push({ zemis: m.zemis, clientNo: m.clientNo, start: m.respStart + randint(5, 40), end: m.respStart + randint(41, 70),
          institution: "Asylsozialdienst Stadt Bern", type: "Erstinformation", title: "Erstinformation Integration", hoursPerWeek: null, remarks: null });

        if (!adult) {
          // Kinder: Volksschule bzw. frühe Förderung; Jugendliche schliessen evtl. die obligatorische Schule ab (zählt für Ziel 1)
          const age6 = addYears(m.birth, 6), age16 = addYears(m.birth, 16);
          if (age6 <= TODAY) T.foerderung.push({ zemis: m.zemis, clientNo: m.clientNo, start: Math.max(age6, m.entry + 20), end: age16 <= TODAY ? age16 - randint(0, 40) : null,
            institution: "Volksschule Stadt Bern", type: "Volksschule", title: "Volksschule", hoursPerWeek: null, remarks: null });
          else if (addYears(m.birth, 3) <= TODAY && chance(0.5)) T.foerderung.push({ zemis: m.zemis, clientNo: m.clientNo, start: Math.max(addYears(m.birth, 3), m.entry + 30), end: age6,
            institution: "Kita Muster", type: "Förderangebot frühkindliche Förderung", title: "Kita 2 Tage / Woche", hoursPerWeek: 16, remarks: null });
          if (age16 <= TODAY && age16 - m.entry > 2 * 365) {
            const lvl = wpick([["A2", 3], ["B1", 5], ["B2", 2]]);
            T.sprachstand.push({ zemis: m.zemis, clientNo: m.clientNo, language: "Deutsch", level: lvl, proofType: "Beendigung obligatorische Schulzeit", remarks: null, date: age16 - randint(0, 40) });
            m.a1 = age16 - randint(0, 40);
          }
          continue;
        }

        // Sprachkurs-Teilnahme
        let pCourse = 0.75 * (m.childcare ? 0.55 : 1) * (m.psych ? 0.7 : 1) + (m.motivation === "hoch" ? 0.1 : m.motivation === "tief" ? -0.3 : 0);
        m.course = !isS && chance(clamp(pCourse, 0.05, 0.95));
        // ~35 % beginnen schon im Asylverfahren (3 Wochen bis 3 Monate nach Einreise), sonst nach Zuständigkeitsbeginn
        const courseStart = Math.min(chance(0.35) ? m.entry + randint(20, 90) : m.respStart + randint(30, 200), TODAY - 20);
        // Monate bis A1 (eingebaute Muster)
        let f = 1;
        f *= m.illiteracy === "Primäranalphabet/-in" ? 2.6 : m.illiteracy ? 1.5 : 1;
        f *= m.course ? 0.65 : 2.0;
        f *= m.psych ? 1.7 : 1;
        f *= m.childcare ? 1.5 : 1;
        f *= m.pace === "langsam" ? 1.4 : m.pace === "schnell" ? 0.7 : 1;
        f *= m.ageEntry >= 45 ? 1.4 : 1;
        f *= m.motivation === "tief" ? 1.5 : m.motivation === "hoch" ? 0.85 : 1;
        f *= m.collectiveMonths > 12 ? 1.2 : 1;
        const monthsA1 = chance(0.07) ? Infinity : 11 * f * Math.exp(0.35 * normal());
        let a1 = Number.isFinite(monthsA1) ? addMonths(m.entry, monthsA1) : null;
        if (a1 && m.course) a1 = Math.max(a1, addMonths(courseStart, 3));
        if (a1 && a1 > TODAY) a1 = null;
        m.a1 = a1;

        // Einstufung bei Eintritt
        T.sprachstand.push({ zemis: m.zemis, clientNo: m.clientNo, language: "Deutsch", level: "A0", proofType: "Weiteres", remarks: "Einstufung Erstgespräch", date: m.respStart + randint(5, 40) });
        if (m.course) {
          const alpha = m.illiteracy === "Primäranalphabet/-in";
          let s = courseStart;
          const courses = alpha ? [pick(LANG_COURSES.alpha), pick(LANG_COURSES.a1)] : [pick(LANG_COURSES.a1)];
          if (a1 && chance(0.5)) courses.push(pick(LANG_COURSES.a2));
          for (const title of courses) {
            if (s > TODAY) break;
            const e = addMonths(s, randint(4, 9));
            T.foerderung.push({ zemis: m.zemis, clientNo: m.clientNo, start: s, end: e <= TODAY ? e : null, institution: pick(LANG_INST),
              type: "Förderangebot Sprache", title, hoursPerWeek: pick([6, 8, 10, 12, 16, 20]), remarks: null });
            s = e + randint(10, 60);
          }
        }
        if (a1) {
          const cert = pick(["telc", "fide"]);
          T.sprachstand.push({ zemis: m.zemis, clientNo: m.clientNo, language: "Deutsch", level: "A1", proofType: "Zertifizierung", remarks: `${cert} A1`, date: a1 });
          const a2 = addMonths(a1, randint(8, 20));
          if (a2 <= TODAY && chance(0.45)) T.sprachstand.push({ zemis: m.zemis, clientNo: m.clientNo, language: "Deutsch", level: "A2", proofType: "Zertifizierung", remarks: `${cert} A2`, date: a2 });
        }

        // Arbeit / Ausbildung (Ziel 2)
        m.jobs = [];
        if (!isS && !pending && m.ageEntry <= 60) {
          if (m.ageEntry <= 24 && m.schoolYears >= 6 && chance(0.5)) {
            // Jugendliche: Brückenangebot, dann Lehre (Sek II)
            const b = addMonths(m.respStart, randint(3, 10));
            if (b < TODAY) {
              T.foerderung.push({ zemis: m.zemis, clientNo: m.clientNo, start: b, end: addMonths(b, 11) <= TODAY ? addMonths(b, 11) : null,
                institution: "Berufsfachschule Bern", type: "Brückenangebot", title: "Berufsvorbereitendes Schuljahr (BVS)", hoursPerWeek: 30, remarks: null });
              const sek = addMonths(b, 12);
              if (sek < TODAY && chance(m.a1 ? 0.75 : 0.35)) {
                T.foerderung.push({ zemis: m.zemis, clientNo: m.clientNo, start: sek, end: addYears(sek, 2) <= TODAY ? addYears(sek, 2) : null,
                  institution: "Lehrbetrieb Muster AG", type: "Sek II", title: pick(SEK2), hoursPerWeek: 40, remarks: null });
                m.educationStart = sek;
              }
            }
          } else if (m.education === "32 Hochschule" && chance(0.15)) {
            const s = addMonths(m.respStart, randint(18, 36));
            if (s < TODAY) {
              T.foerderung.push({ zemis: m.zemis, clientNo: m.clientNo, start: s, end: null, institution: "Universität Bern", type: "Tertiär", title: "Masterstudium (Anerkennung Vorbildung)", hoursPerWeek: 40, remarks: null });
              m.educationStart = s;
            }
          }
          let g = 1;
          g *= m.a1 && m.a1 < addMonths(m.entry, 24) ? 0.7 : 1.25;
          g *= m.workYears >= 5 ? 0.8 : 1;
          g *= m.psych ? 1.8 : 1;
          g *= m.phys ? 1.5 : 1;
          g *= m.childcare ? 2.2 : 1;
          g *= m.ageEntry >= 50 ? 1.7 : 1;
          g *= m.motivation === "hoch" ? 0.7 : m.motivation === "tief" ? 1.6 : 1;
          // Kleiner Job vorher (Pensum < 60 % oder kurz)
          if (chance(0.4)) {
            const s = addMonths(m.respStart, randint(6, 30));
            if (s < TODAY) {
              const e = addMonths(s, randint(2, 5));
              m.jobs.push({ from: s, to: e <= TODAY ? e : null, workload: pick([20, 30, 40, 50]), short: true });
            }
          }
          if (!m.educationStart && !chance(0.2)) {
            const s = addMonths(m.respStart, 26 * g * Math.exp(0.4 * normal()));
            if (s < TODAY) {
              const dur = Math.exp(Math.log(14) + 0.7 * normal());
              const e = addMonths(s, dur);
              m.jobs.push({ from: s, to: e <= TODAY && chance(0.6) ? e : null, workload: m.childcare ? pick([50, 60]) : pick([60, 70, 80, 100, 100]) });
            }
          }
        }
        // Zeilen Erwerb und ZEMIS Tätigkeit
        for (const j of m.jobs) {
          const [emp, town] = pick(EMPLOYERS);
          j.employer = emp;
          const gross = Math.round((j.workload / 100) * (3900 + randint(-300, 900)));
          T.erwerb.push({ zemis: m.zemis, clientNo: m.clientNo, from: j.from, to: j.to, employer: emp, employerTown: town, workload: j.workload,
            employmentStatus: "unselbstständig", grossMonthly: gross, hourlyWage: chance(0.3) ? Math.round((gross / (j.workload * 1.8)) * 100) / 100 : null,
            irregularIncome: j.short ? true : false, wageAssigned: chance(0.15), remarks: null });
          if (chance(0.92)) T.zemisTaetigkeit.push({ zemis: m.zemis, clientNo: m.clientNo, start: j.from, end: j.to || addMonths(j.from, 12), company: emp });
        }
        // Datenqualität: Arbeit nur beim Bund gemeldet, fehlt im Erwerb
        if (!isS && !pending && chance(0.05)) {
          const s = Math.min(addMonths(m.respStart, randint(3, 24)), TODAY - 30);
          T.zemisTaetigkeit.push({ zemis: m.zemis, clientNo: m.clientNo, start: s, end: addMonths(s, randint(2, 8)), company: "Temporärbüro Personal Plus" });
        }
        // Ziel 2 erreicht? (6 Monate am Stück ≥ 60 % oder Ausbildung Sek II / Tertiär)
        const stable = m.jobs.find((j) => j.workload >= 60 && addMonths(j.from, 6) <= Math.min(j.to ?? TODAY, TODAY));
        m.goal2 = [m.educationStart, stable ? addMonths(stable.from, 6) : null].filter(Boolean).sort((a, b) => a - b)[0] || null;
        if (outOfScope) { m.goal2 = null; }
      }

      // ---------- Finanzielle Unterstützung pro Haushalt (Ziel 3) ----------
      const adults = members.filter((m) => m.ageEntry >= 16);
      const kids = members.length - adults.length;
      const need = 80 + 25 * (adults.length - 1) + 15 * kids; // nötiges Gesamtpensum in %
      const hhStart = Math.min(...members.map((m) => m.respStart));
      const fin = [];
      let cur = { support: "Sozialhilfe", from: hhStart }, okMonths = 0, badMonths = 0, hadJob = false;
      for (let d = addMonths(hhStart, 1); d <= TODAY; d = addMonths(d, 1)) {
        const income = adults.reduce((s, m) => s + (m.jobs || []).filter((j) => j.from <= d && (!j.to || j.to >= d)).reduce((a, j) => a + j.workload, 0), 0);
        if (income > 0) hadJob = true;
        if (cur.support === "Sozialhilfe") {
          okMonths = income >= need ? okMonths + 1 : 0;
          if (okMonths >= 2 && !isS && !pending) {
            fin.push({ ...cur, to: d, endReason: hadJob && fin.length ? "Erhöhtes Erwerbseinkommen" : "Aufnahme einer Erwerbstätigkeit" });
            cur = { support: "Keine Unterstützung", from: d + 1 }; okMonths = 0;
          }
        } else {
          badMonths = income < need * 0.7 ? badMonths + 1 : 0;
          if (badMonths >= 2) { fin.push({ ...cur, to: d, endReason: null }); cur = { support: "Sozialhilfe", from: d + 1 }; badMonths = 0; }
        }
      }
      fin.push({ ...cur, to: null, endReason: null });
      for (const r of fin) T.finanz.push({ dossierNo, support: r.support, from: r.from, to: r.to, endReason: r.endReason });
      const noSH = fin.find((r) => r.support === "Keine Unterstützung" && addMonths(r.from, 12) <= Math.min(r.to ?? TODAY, TODAY));
      const goal3 = noSH && !isS && !pending ? addMonths(noSH.from, 12) : null;

      // ---------- Personen-Tabellen ----------
      const cohort = yearOf(hhStart);
      for (const m of members) {
        const inScope = ["B-FL", "B-RSFL", "B-SL", "VA", "F-FL"].includes(status);
        T.klient.push({ dossierNo, support: cur.support, zemis: m.zemis, clientNo: m.clientNo, respStart: m.respStart, respEnd: m.respEnd,
          municipalHandover: m.ended ? m.respEnd : null, status: m.currentStatus, gender: m.gender, nationality: o.land,
          motherTongue: tongue, maritalStatus: m.marital, workYearsBefore: m.ageEntry >= 16 ? m.workYears : null,
          highestEducation: m.education, latinLiterate: m.latin, illiteracyType: m.illiteracy, schoolYearsBefore: m.ageEntry >= 6 ? m.schoolYears : null,
          caseManager: cm, birthDate: chance(0.01) ? null : m.birth });

        // Asylgeschäftsdaten (Einreise fehlt in ~2 % der Fälle → Datenqualität)
        if (m.bornInCH) T.asylgeschaeft.push({ zemis: m.zemis, clientNo: m.clientNo, eventType: "Aufenthalt (Geburt)", eventDate: m.birth, outcome: null, outcomeCode: null, outcomeDate: null });
        else if (!chance(0.02)) T.asylgeschaeft.push({ zemis: m.zemis, clientNo: m.clientNo, eventType: "Aufenthalt (Einreise)", eventDate: m.entry, outcome: null, outcomeCode: null, outcomeDate: null });
        if (isS) {
          T.asylgeschaeft.push({ zemis: m.zemis, clientNo: m.clientNo, eventType: "Gesuch vorübergehender Schutz", eventDate: m.application, outcome: "Vorübergehender Schutz gewährt", outcomeCode: String(OUTCOME_CODE["Vorübergehender Schutz gewährt"]), outcomeDate: decision });
        } else if (!resettled) {
          const outcome = pending ? null : status === "B-FL" ? (m.rel === "Dossierträger/-in" ? "Asylgewährung Art. 3, 7" : "Asylgewährung Art. 51.1")
            : status === "F-FL" ? "Ablehnung mit Fl.-Eigenschaft Art 3, 7" : "Ablehnung Art. 3, 7";
          T.asylgeschaeft.push({ zemis: m.zemis, clientNo: m.clientNo, eventType: "Asylgesuch in CH (Kt normal, Kat. III)", eventDate: m.application,
            outcome, outcomeCode: outcome ? String(OUTCOME_CODE[outcome]) : null, outcomeDate: pending ? null : Math.max(decision, m.application + 30) });
          if (status === "VA" && !pending) T.asylgeschaeft.push({ zemis: m.zemis, clientNo: m.clientNo, eventType: "VA verfügt (unzumutbar)", eventDate: Math.max(decision, m.application + 30), outcome: null, outcomeCode: null, outcomeDate: null });
        }

        // Asylverfahrensstand (Historie)
        const st = [];
        if (!resettled && !isS) st.push({ status: "N (Asylsuchende)", from: m.application, to: pending ? null : Math.max(decision, m.application + 30) - 1 });
        if (!pending) {
          const f0 = isS || resettled ? m.entry : Math.max(decision, m.application + 30);
          st.push({ status, from: f0, to: m.ended ? m.respEnd - 1 : null });
          if (m.ended) st.push({ status: AFTER_END[status], from: m.respEnd, to: null });
        }
        for (const s of st) T.verfahrensstand.push({ zemis: m.zemis, clientNo: m.clientNo, dossierNo, from: s.from, to: s.to, status: s.status });

        T.dossierperson.push({ dossierNo, clientNo: m.clientNo, zemis: m.zemis, from: m.respStart, to: null,
          role: "Dossiermitglied", relationship: m.rel });

        // Unterbringung: zuerst Kollektivunterkunft, dann Wohnung
        const collEnd = addMonths(m.respStart, m.collectiveMonths);
        T.unterbringung.push({ clientNo: m.clientNo, from: m.respStart, to: collEnd < TODAY ? collEnd : null, type: "Kollektivunterkunft", zip: "3018", town: "Bern" });
        if (collEnd < TODAY) { const [zip, town] = PLZ_BERN[h % PLZ_BERN.length]; T.unterbringung.push({ clientNo: m.clientNo, from: collEnd + 1, to: null, type: chance(0.8) ? "Indiv. Wohnung" : "Partner-Wohnung", zip, town }); }

        // Integrationszielerreichung: erreichte Ziele werden meist (nicht immer) erfasst
        const age16 = addYears(m.birth, 16);
        const goalRow = (goalType, date) => T.zielerreichung.push({ zemis: m.zemis, goalType, reachedOn: date, partner: "Bern Stadt und Umgebung", cohortYear: cohort, reachedWithS: false });
        if (inScope && !pending) {
          if (m.a1 && m.a1 <= addYears(m.entry, 3) && m.a1 >= age16 - 365 && m.a1 < TODAY - 30 && chance(0.85)) goalRow("Sprachniveau A1", m.a1);
          if (m.goal2 && m.goal2 <= (m.respEnd ?? TODAY) && m.goal2 < TODAY - 30 && chance(0.85)) goalRow("Aufnahme Ausbildung / Erwerbstätigkeit", m.goal2);
          if (goal3 && goal3 <= (m.respEnd ?? TODAY) && goal3 < TODAY - 30 && m.rel === "Dossierträger/-in" && chance(0.85)) goalRow("Finanzielle Unabhängigkeit", goal3);
        }
      }

      // ---------- Situationsanalyse (Text) ----------
      if (!isS) texts.push({ name: `Situationsanalyse_${dossierNo}.txt`, text: situationText({ members, o, tongue, lastName, cm, status, respStart, h, chDate, ageAt, pick, chance, randint, youngKids }) });
    }

    // Leicht mischen, damit die Reihenfolge nicht nach Haushalt sortiert ist (wie echte Exporte)
    for (const id in T) T[id].sort((a, b) => String(a.zemis || a.clientNo || a.dossierNo).localeCompare(String(b.zemis || b.clientNo || b.dossierNo)));
    return { tables: T, texts, today: TODAY };
  }

  // ---------- Text der Situationsanalyse (nach Vorlage docs/Situationsanalyse_Familie.pdf) ----------
  function situationText(c) {
    const { members, o, tongue, lastName, cm, status, respStart, chDate, ageAt, pick, chance, randint, youngKids } = c;
    // Bericht wird kurz nach Zuständigkeitsbeginn geschrieben; später Geborene stehen noch nicht drin.
    const reportDate = respStart + randint(20, 60);
    const head = members[0], partner = members.find((m) => m.rel === "Ehefrau / -mann" && m.entry <= reportDate);
    const kids = members.filter((m) => m.rel === "Tochter / Sohn" && m.birth <= reportDate);
    const initials = cm.split(" ").map((s) => s[0]).join("");
    const L = [];
    const anrede = (m) => (m.gender === "Männlich" ? "Herr" : "Frau");
    L.push("Stadt Bern – Direktion für Bildung, Soziales und Sport – Asylsozialdienst");
    L.push(`Bern, ${chDate(reportDate)} - ${initials}`);
    L.push("", "Situationsanalyse und Potenzialerhebung", "", "1. Personalien aller Personen in der Unterstützungseinheit");
    const personalien = (m, label) => {
      const role = m.rel === "Dossierträger/-in" ? (m.gender === "Männlich" ? "Dossierträger" : "Dossierträgerin") : (m.gender === "Männlich" ? "Ehemann" : "Ehefrau");
      L.push("", `${label} ${role}`);
      L.push(`Name: ${lastName}    Vorname: ${m.first}    Geburtsdatum: ${chDate(m.birth)}`);
      L.push(`Nationalität: ${o.land}    Aufenthaltstatus: ${status}`);
      L.push(`Einreisedatum: ${chDate(m.entry)}    Ende Zuständigkeit: ${m.respEnd ? chDate(m.respEnd) : "-"}`);
      L.push(`Zivilstand: ${m.marital}    Zemis-Nr.: ${m.zemis}`);
      if (m.rel === "Dossierträger/-in") L.push(`Zust. SAR: ${cm}`);
    };
    personalien(head, "1.1");
    if (partner) personalien(partner, "1.2");
    kids.forEach((k, i) => {
      const age = ageAt(k.birth, reportDate);
      L.push("", `1.${i + 3} Kind ${i + 1}`);
      L.push(`Name: ${lastName}    Vorname: ${k.first}    Geburtsdatum: ${chDate(k.birth)}    Geschlecht: ${k.gender}`);
      L.push(`Kinderbetreuung: ${age < 4 ? (chance(0.4) ? "Kita 2 Tage" : "Betreuung durch Mutter") : age < 16 ? "keine" : "-"}    Schulklasse: ${age >= 6 && age < 16 ? `${Math.min(9, age - 5)}. Klasse` : "-"}`);
      L.push(`Zemis-Nr.: ${k.zemis}`);
    });

    L.push("", "2. Situationsanalyse", "", "2.1 Familiäre Situation, soziales Umfeld");
    L.push(`Familiensystem in der Schweiz und im Herkunftsland: ${members.length === 1 ? `${anrede(head)} ${lastName} lebt allein in der Schweiz.` : `Die Familie lebt zu ${1 + (partner ? 1 : 0) + kids.length} in der Schweiz.`} ${pick(["Eltern und Geschwister leben im Herkunftsland.", "Ein Bruder lebt in Deutschland.", "Kein Kontakt mehr zur Familie im Herkunftsland.", "Die Mutter lebt in einem Nachbarland."])}`);
    L.push(`Familiennachzug: ${pick(["Kein Gesuch.", "Kein Thema.", "Gesuch für Angehörige wird geprüft."])}`);
    L.push(`Soziales Umfeld und Vernetzung Freiwillige: ${pick(["Kontakt zu Landsleuten, wenig Kontakt zu Einheimischen.", "Begleitung durch eine Freiwillige (Tandem).", "Wenig soziale Kontakte.", "Aktiv in einem Fussballverein."])}`);
    L.push("", "2.2 Wohnen");
    L.push(`Aktuelle Wohnsituation: Kollektivunterkunft${head.collectiveMonths > 12 ? ", Wohnungssuche bisher erfolglos" : ""}.`);
    L.push(`Auf Wohnungssuche: ja`);
    L.push("", "2.3 Alltagsführung");
    L.push(`Selbständige Erledigung der Administration / Abtretungen: ${head.schoolYears >= 9 ? "weitgehend selbständig" : "braucht Unterstützung bei Briefen und Formularen"}.`);
    L.push("", "2.4 Kooperation und Zusammenarbeit");
    L.push(`Termine wahrnehmen / Pünktlichkeit / Erreichbarkeit: ${{ gut: "Termine werden zuverlässig wahrgenommen.", mittel: "Termine werden meist wahrgenommen, gelegentlich Verspätungen.", schwierig: "Termine werden oft verpasst, telefonisch schwer erreichbar." }[head.cooperation]}`);
    L.push("", "2.5 Finanzen");
    L.push(`Einkommen / Vermögen: Wirtschaftliche Hilfe. Schulden: ${pick(["keine bekannt", "keine", "kleinere Schulden bei Bekannten"])}.`);

    let sec = 3;
    for (const m of [head, partner, ...kids].filter((x) => x && ageAt(x.birth, reportDate) >= 16)) {
      const n = sec++;
      L.push("", `${n}. Individuelle Potenzialerhebung von ${lastName} ${m.first}, ${chDate(m.birth)}`);
      L.push("", `${n}.1 Gesundheit`);
      L.push(`Physischer Gesundheitszustand: ${m.phys ? pick(["Rückenbeschwerden seit der Flucht, kann nicht schwer heben.", "Chronische Knieschmerzen, eingeschränkt belastbar.", "Diabetes, regelmässige Arzttermine."]) : "Keine Einschränkungen bekannt."}`);
      L.push(`Psychischer Gesundheitszustand: ${m.psych ? pick(["Schlafstörungen und Konzentrationsprobleme, Verdacht auf PTBS; in Behandlung.", "Psychisch stark belastet durch Erlebnisse auf der Flucht, Therapie läuft.", "Depressive Verstimmung, Hausarzt involviert."]) : "Stabil."}`);
      L.push(`Einfluss auf die Arbeitsfähigkeit / Arztzeugnis: ${m.psych || m.phys ? pick(["Arztzeugnis 50 % arbeitsfähig.", "Eingeschränkte Arbeitsfähigkeit gemäss Hausarzt.", "Noch offen, Abklärung läuft."]) : "Keiner."}`);
      L.push("", `${n}.2 Sprachliche Integration`);
      L.push(`Muttersprache: ${tongue}`);
      L.push(`Fremdsprachen: ${pick(["keine", "etwas Englisch", "Englisch gut", "Arabisch", "Persisch"])}`);
      L.push(`Alphabetisierung Muttersprache: ${m.illiteracy === "Primäranalphabet/-in" ? "nein" : "ja"}`);
      L.push(`Alphabetisierung Zielsprache: ${m.latin === "Ja" ? "ja" : "nein"}`);
      L.push(`Sprachniveau lokale Amtssprache (Deutsch) Mündlich: A0  Schriftlich: A0  Zertifikat: keines`);
      L.push(`Lerntempo: ${{ langsam: "langsam, braucht viele Wiederholungen", mittel: "durchschnittlich", schnell: "schnell, lernt selbständig" }[m.pace]}`);
      L.push(`Kommunikation mit Sozialarbeiter/in: ${pick([`mit Dolmetscher/in (${tongue})`, "auf Englisch", `mit Dolmetscher/in (${tongue})`])}`);
      L.push("", `${n}.3 Berufliche Integration`);
      const sit = [m.childcare ? "Kinderbetreuung" : null, "nicht erwerbstätig", m.motivation !== "tief" ? "Stellensuche" : null].filter(Boolean);
      L.push(`Aktuelle Beschäftigungssituation: ${sit.join(", ")}`);
      L.push(`Verfügbarkeit für Arbeit oder Bildung: ${m.childcare ? `eingeschränkt wegen Betreuung von ${youngKids > 1 ? `${youngKids} Kleinkindern` : "einem Kleinkind"}` : m.psych || m.phys ? "eingeschränkt aus gesundheitlichen Gründen" : "voll verfügbar"}`);
      L.push(`Anzahl Jahre Berufserfahrung und Tätigkeiten in der Schweiz: keine`);
      L.push(`Anzahl Jahre Berufserfahrung und Tätigkeiten im Herkunftsland / auf der Flucht: ${m.workYears ? `${m.workYears} Jahre, ${m.jobField}` : "keine"}`);
      L.push(`Anzahl Schuljahre und Ausbildung: ${m.schoolYears} Schuljahre${m.education && m.education.startsWith("32") ? ", Hochschulabschluss" : ""}`);
      L.push(`Diplome im Herkunftsland oder Schweiz: ${m.education && /^(22|24|32)/.test(m.education) ? "ja" : "nein"}`);
      L.push(`EDV / ICT-Kenntnisse: ${m.ict}`);
      L.push(`Führerschein: ${m.license ? "ja, in der Schweiz nicht anerkannt" : "nein"}`);
      L.push("", `${n}.4 Potenzialeinschätzung`);
      L.push(`Ressourcen und Fähigkeiten: ${pick(["zuverlässig, handwerklich geschickt", "freundlich, kommunikativ", "ausdauernd, körperlich belastbar", "organisiert, lernbereit"])}`);
      L.push(`Berufliche Perspektiven und Vorstellungen aus Sicht Klient/in: ${m.jobField ? `möchte wieder im Bereich ${m.jobField} arbeiten` : pick(["möchte eine Lehre machen", "möchte rasch Geld verdienen", "noch keine klare Vorstellung"])}`);
      L.push(`Einschätzung Potenzial und Motivation aus Sicht Sozialarbeiter/in / externe Abklärung: ${{ hoch: pick(["Hohe Motivation, sehr engagiert.", "Sehr motiviert, nimmt Angebote aktiv wahr."]), mittel: pick(["Motivation vorhanden, braucht Begleitung.", "Grundsätzlich motiviert."]), tief: pick(["Motivation wirkt gering, Fokus auf andere Themen.", "Wenig Eigeninitiative erkennbar."]) }[m.motivation]}`);
    }
    return L.join("\n");
  }

  // ---------- Ausgabe als Excel ----------
  const toSerial = (n) => n + 25569; // Excel-Datumszahl
  function toWorkbook(tableId, rows) {
    const t = root.Cockpit.TABLES.find((x) => x.id === tableId);
    const aoa = [t.columns.map((c) => c.header)];
    for (const r of rows) aoa.push(t.columns.map((c) => {
      const v = r[c.id];
      if (v === null || v === undefined) return null;
      if (c.type === "date") return { t: "n", v: toSerial(v), z: "dd.mm.yyyy" };
      if (c.type === "bool") return v ? 1 : 0;
      return v;
    }));
    const ws = root.XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = t.columns.map((c) => ({ wch: Math.max(12, c.header.length + 2) }));
    const wb = root.XLSX.utils.book_new();
    root.XLSX.utils.book_append_sheet(wb, ws, "Resultat");
    return wb;
  }
  const fileName = (tableId) => {
    const t = root.Cockpit.TABLES.find((x) => x.id === tableId);
    return `Testdaten_${t.name.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/[^A-Za-z0-9]+/g, "_")}.xlsx`;
  };

  root.Cockpit = root.Cockpit || {};
  root.Cockpit.generator = { generate, toWorkbook, fileName };
})(typeof window !== "undefined" ? window : this);
