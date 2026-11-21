# PROMPT — Integrations-Cockpit (AI for Access Hackathon, Bern, 20–21.11.2026)

You are building a prototype for the **Asylsozialdienst (ASD) of the City of Bern**.
Goal: compare target vs. actual for refugees' integration goals, show what helps them
reach the goals, and help social workers act on it — using **only Excel exports** from
the case management system (which cannot be changed or integrated with).

Read first:
- `docs/integration-cockpit-challenge-en.pdf` — the challenge (goals, levels, rules)
- `docs/datenmodell.html` — data model (tables, keys, which fields matter per goal)
- `docs/Situationsanalyse_Familie .pdf` — free-text household report template (unstructured)
- `templates/Hackathon_<Tabelle>_Resultat.xlsx` — column names and allowed values of each export
  (black = allowed values / number format, green = example values; no real clients)

## Hard constraints

1. **Excel in, Excel out.** Read `.xlsx` exports as they come: German column names,
   Swiss dates (`dd.mm.yyyy`), several rows per client (history). Results go back as `.xlsx`.
   Next month's export must work with the same clicks — no manual preprocessing.
2. **Runs fully in the browser, offline.** Plain HTML + CSS + vanilla JS
   (`index.html`, `css/`, `js/`). Parse/write Excel with the bundled `lib/xlsx.full.min.js` (SheetJS).
   No backend, no build step, no CDN, no telemetry. Data never leaves the user's machine.
3. **Data protection (revDSG / GDPR-like).** Asylum, social-assistance and health data are
   highly sensitive. Nothing is persisted (no localStorage of client data), nothing is sent
   over the network. Any AI feature must work on aggregated/pseudonymised data or run locally;
   document what would leave the network and why. Add a short `DATENSCHUTZ.md`.
4. **Patterns on groups, never a score per person** (Level 2).
5. UI language: **German + English switch** (DE default). Code identifiers in English,
   **comments in German** (so ASD can read the rules).

## Data model (summary)

`Klient` is the hub (1 row / person). Keys:
- person tables → `Zemis Nummer` / `Klient/-in Zemis-Nr.` or `Klientennummer`
- household tables → `Dossier-Nr.` (`Dossierperson`, `Finanzielle Unterstützung`)
- `Unterbringung` has only `Klientennummer`

Exports: Klient, Asylverfahrensstand, Asylgeschäftsdaten, Dossierperson, Finanzielle Unterstützung,
Unterbringung, Sprachstand, Integrationsförderung und Ausbildung, Erwerb, ZEMIS Tätigkeit,
Integrationszielerreichung. Normalise key formats (strings, trimmed) before joining.
Detect each table by its header row, not by file name.

Key facts:
- Birth date for "16+": `Klient.Geburtsdatum`
- Entry date: `Asylgeschäftsdaten` row with `Asylgeschäftsart` = "Aufenthalt (Einreise)", `Ereignisdatum`
  (if several, take the earliest; born in CH → "Aufenthalt (Geburt)")
- Asylum application date (for B-FL / B-RSFL / B-SL responsibility): `Asylgeschäftsart` starting with
  "Asylgesuch in CH" — `Ereignisdatum`
- Column names in the actual `Klient` export: `Verfahrensstand`, `Unterstützung`, `Fallführung`,
  `Geburtsdatum`, `Lateinisch alphabetisiert`, `Art Analphabetismus` (no "(aktuell)" suffix) —
  always trust the templates over the data model labels.
- End of responsibility: `Klient.Zuständigkeitsende` (5 y from asylum application for B-FL / B-RSFL / B-SL;
  7 y from entry for VA / F-FL — 5 y from 01.01.2027). Status **S and N are out of scope**.
- Already reached goals: `Integrationszielerreichung` (`Art`: "Sprachniveau A1",
  "Aufnahme Ausbildung / Erwerbstätigkeit", "Finanzielle Unabhängigkeit").

## Goals

| # | Goal | Who | Deadline | Data |
|---|------|-----|----------|------|
| 1 | Language A1 (Zertifizierung telc/fide, Muttersprache, Beendigung obligatorische Schulzeit, Beendigung Ausbildung) | VA + FL, 16+ | 3 years from entry | `Sprachstand` (`Art`, `Sprachniveau`, `Datum Erreichung`) |
| 2 | Work ≥ 60 % for 6 months uninterrupted (1st labour market), or education Sek II / Tertiär | VA + FL, 16+ | before end of responsibility | `Erwerb`, `Integrationsförderung und Ausbildung` |
| 3 | 12 months without social assistance, whole household | household (`Dossier-Nr.`) | before end of responsibility | `Finanzielle Unterstützung` |

## Build in levels (Level 1 first, each adds to the previous)

**Level 1 — target vs actual, goal 1.** For current clients: in scope?, entry date, age at
entry / today, deadline, reached A1 (date, type of proof), overdue ("should have by now").
Per person and totals per social worker (`Fallführung`) and per entry year. Export to `.xlsx`.

**Level 2 — why do clients reach goal 1?** Compare groups who reached vs. not: mother tongue,
schooling years, literacy, highest education, age group, language courses
(`Integrationsförderung`, `Art` = "Förderangebot Sprache"), accommodation type. Show rates per
group with counts; hide groups with n < 5 (re-identification risk). Optionally extract
structured features from Situationsanalyse texts — locally only.

**Level 3 — goals 2 and 3.** Same logic for work/education (person) and financial
independence (household).

**Level 4 — cockpit.** Traffic light per client and goal: green reached, yellow on track,
red at risk, grey not applicable. Two views:
- Social worker: "who do I call this week, and why?" — filtered by own caseload, sorted by urgency, with reason text.
- Management: totals, trends, per team / entry cohort.

**Further ideas:** payment forecast, what-if for the 2027 rule change, data-quality alerts
(e.g. job in `ZEMIS Tätigkeit` missing in `Erwerb`, missing entry date, overlapping periods),
caseload dashboard.

## Decisions (21.11.2026)

- **Scope:** breadth over depth — all 4 levels in a simplified form within one day.
- **Data:** synthetic only. A generator creates the 11 exports (same columns as `templates/`)
  plus matching fictional Situationsanalyse texts (same Zemis-Nr.), with built-in patterns
  (e.g. language course + Latin literacy → A1 more often) so Level 2 has something to find.
- **Traffic light (not reached):** red = deadline passed or < 6 months left; yellow = more time left.
  Thresholds as constants in `js/rules.js`.
- **AI = feature extraction from Situationsanalyse**, as a separate step outside the cockpit:
  1. local pseudonymisation (remove names, Zemis-Nr., dates, places → placeholders; Zemis-Nr. kept only locally as mapping)
  2. Claude API returns structured features per person/household (JSON schema: health limits,
     childcare duties, prior work field, schooling, motivation, housing situation …)
  3. output `Situationsanalyse_Merkmale.xlsx` (keyed by Zemis-Nr.) — loaded into the cockpit as a 12th table
  The cockpit itself stays offline (`connect-src 'none'`). `DATENSCHUTZ.md` describes the
  production variant (on-prem / Swiss-hosted model) and what leaves the network in the demo.
- Level 2 uses the features only for **group patterns** (n ≥ 5), never per-person scores.

## Style guide

**Visual:** calm, administrative — same look as `docs/datenmodell.html`: warm grey background
`#f6f5f1`, white cards, thin borders, system font. Goal colours: Ziel 1 blue `#2f6fdb`,
Ziel 2 orange `#d9711c`, Ziel 3 green `#1f9d63`, deadlines/status violet `#7a4fd1`,
household pink `#c23d6b`. Traffic lights: green / yellow / red / grey — always with a text
label or icon too (not colour only). Light + dark mode. No logos or city branding.

**Navigation:** tabs at the top — Daten (start page) · Cockpit · Ziel 1 · Sprache · Ziel 2 · Arbeit · Ziel 3 · Sozialhilfe · Muster. Goals 2 and 3 are separate tabs (different topics).
DE/EN switch in the header.

**Charts:** own inline SVG only (bars, progress bars, sparklines), no chart library, works offline.

**Wording:** ASD vocabulary exactly as in the exports (Fallführung, Zuständigkeitsende,
Dossier-Nr., Verfahrensstand …); EN view shows the English term with the German one in brackets.
Tone: factual and concrete — facts + dates, no judgement of persons, no recommendations.
Example reason: «Frist A1 in 4 Monaten (12.03.2027). Kein Sprachkurs seit 08.2025.»

**Code:** vanilla JS, plain `<script>` files (no modules, no build), opens from disk.
One file per concern: `schema.js`, `parse.js`, `rules.js`, `i18n.js`, `views/*.js`, `charts.js`.
`rules.js` is pure functions with German comments and has browser-run tests (`tests.html`).

## Plan

1. ✅ Load exports, recognise tables, parse values, preview
2. ✅ Synthetic data generator (11 exports + Situationsanalyse texts) — `tools/`, output in `testdata/`
3. ✅ Level 1: goal 1 per person + totals (Fallführung, entry year) + Excel export — rules in `js/rules.js`, tests `tests.html`, assumptions `ANNAHMEN.md`
4. ✅ Level 3: goals 2 and 3 in the same engine and views — shared `js/views/goalview.js`, 50 rule tests
5. ✅ Level 4: cockpit (`js/cockpit.js` + `js/views/cockpit.js`) — one view for everyone (Fallführung = filter, not login):
   KPIs, call list "Wen rufe ich diese Woche an, und warum?", matrix Klient:in × Ziel, overview (n < 5 hidden), Excel export,
   "Testdaten laden" in the browser; tabs: Daten (start page) · Cockpit · Ziel 1 · Ziel 2 · Ziel 3 · Muster; after loading → Cockpit; 61 tests
6. Level 2 + AI step:
   - ✅ Level 2 «Muster – Was hilft?» (`js/patterns.js` + `js/views/muster.js`): fair measures (in Frist / nach 12-24-36 Mt.),
     factors from tables + support + optional 12th table `Situationsanalyse_Merkmale`, stratified comparison, top differences,
     n < 5 masked, Excel export; 71 tests
   - AI extraction script (mock + Claude API with pseudonymisation) → produces `Situationsanalyse_Merkmale.xlsx` (columns: ANNAHMEN.md M.10)
7. Extras if time: data-quality alerts (ZEMIS Tätigkeit vs Erwerb), what-if 2027, `DATENSCHUTZ.md`, demo script

## Working rules

- Put all goal rules in one module (`js/rules.js`) with clear constants (deadlines, 60 %,
  6 months, 12 months, 2027 change) so ASD can review them.
- Every computed status shows its reason (which row/date led to it).
- Report unparseable rows and missing columns instead of silently dropping them.
- Generate synthetic test data matching the templates (`templates/`) to test without real data;
  never commit real exports.
- When a rule is ambiguous, list the assumption in `ANNAHMEN.md` — ASD answers questions about goals and rules.
