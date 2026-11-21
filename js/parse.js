/* Einlesen der .xlsx-Exporte: Kopfzeile finden, Tabelle erkennen, Werte vereinheitlichen.
 * Alles geschieht im Arbeitsspeicher des Browsers; nichts wird gespeichert oder gesendet.
 */
(function () {
  "use strict";
  const { TABLES } = window.Cockpit;

  const norm = (s) => String(s ?? "").normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

  function validYMD(y, m, d) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  /* Gibt ein ISO-Datum zurück, null wenn leer, undefined wenn nicht lesbar.
   Akzeptiert Excel-Datumszahlen, Schweizer Format tt.mm.jjjj (auch tt.mm.jj) und ISO. */
  function parseDate(v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") {
      const p = XLSX.SSF.parse_date_code(v);
      return p && validYMD(p.y, p.m, p.d) ? iso(p.y, p.m, p.d) : undefined;
    }
    const s = String(v).trim();
    if (!s || /^\(?leer\)?$/i.test(s)) return null;
    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/); // Schweizer Format tt.mm.jjjj
    if (m) {
      let y = +m[3];
      if (m[3].length === 2) y += y > 50 ? 1900 : 2000;
      return validYMD(y, +m[2], +m[1]) ? iso(y, +m[2], +m[1]) : undefined;
    }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); // ISO-Format
    if (m) return validYMD(+m[1], +m[2], +m[3]) ? iso(+m[1], +m[2], +m[3]) : undefined;
    return undefined;
  }

  function parseNum(v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") return v;
    const s = String(v).trim().replace(/['’\s]/g, "").replace(/%$/, "").replace(",", ".");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }

  function parseBool(v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "boolean") return v;
    const s = norm(v);
    if (["1", "ja", "wahr", "true", "x"].includes(s)) return true;
    if (["0", "nein", "falsch", "false"].includes(s)) return false;
    return undefined;
  }

  function parseKey(v) {
    if (v === null || v === undefined) return null;
    let s = typeof v === "number" ? String(Math.round(v)) : String(v).trim();
    if (!s || /^\(?leer\)?$/i.test(s)) return null;
    return s;
  }

  const PARSERS = {
    date: parseDate, num: parseNum, bool: parseBool, key: parseKey,
    text: (v) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim()),
  };

  /* Bewertet jede Tabelle danach, wie viele ihrer Pflichtspalten in einer Zeile vorkommen. */
  function matchTable(headerRow) {
    const present = new Set(headerRow.map(norm));
    let best = null;
    for (const t of TABLES) {
      const req = t.columns.filter((c) => c.required);
      const found = req.filter((c) => present.has(norm(c.header))).length;
      // Fremde Spalten geben Abzug, damit ähnliche Tabellen (z.B. mit Spalte «Art») nicht verwechselt werden.
      const known = new Set(t.columns.map((c) => norm(c.header)));
      const extra = [...present].filter((h) => h && !known.has(h)).length;
      const score = found / req.length - extra * 0.02;
      if (!best || score > best.score) best = { table: t, score, found, required: req.length };
    }
    return best;
  }

  /* Sucht die Kopfzeile in den ersten 15 Zeilen (Exporte können eine Titelzeile darüber haben). */
  function findHeader(aoa) {
    let best = null;
    for (let i = 0; i < Math.min(15, aoa.length); i++) {
      const m = matchTable(aoa[i] || []);
      if (m && (!best || m.score > best.match.score)) best = { rowIndex: i, match: m };
    }
    return best && best.match.score >= 0.6 ? best : null;
  }

  function readSheet(ws, fileName, sheetName) {
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
    const hdr = findHeader(aoa);
    if (!hdr) return { fileName, sheetName, recognised: false };

    const table = hdr.match.table;
    const headerRow = aoa[hdr.rowIndex].map(norm);
    const colIndex = {};
    const missing = [];
    for (const c of table.columns) {
      const idx = headerRow.indexOf(norm(c.header));
      if (idx >= 0) colIndex[c.id] = idx;
      else if (c.required) missing.push(c.header);
    }
    const extra = aoa[hdr.rowIndex].filter((h) => h && !table.columns.some((c) => norm(c.header) === norm(h)));

    const rows = [];
    const problems = []; // nicht lesbare Werte: {row, column, value}
    for (let r = hdr.rowIndex + 1; r < aoa.length; r++) {
      const raw = aoa[r];
      if (!raw || raw.every((v) => v === null || String(v).trim() === "")) continue;
      const obj = { _row: r + 1 };
      for (const c of table.columns) {
        if (!(c.id in colIndex)) { obj[c.id] = null; continue; }
        const v = raw[colIndex[c.id]];
        const parsed = PARSERS[c.type](v);
        if (parsed === undefined) {
          problems.push({ row: r + 1, column: c.header, value: String(v) });
          obj[c.id] = null;
        } else obj[c.id] = parsed;
      }
      rows.push(obj);
    }
    return { fileName, sheetName, recognised: true, table, headerRow: hdr.rowIndex + 1, rows, missing, extra, problems };
  }

  async function readFile(file) {
    const buf = await file.arrayBuffer();
    return readWorkbook(XLSX.read(buf, { type: "array", cellDates: false, cellText: false }), file.name);
  }

  const readWorkbook = (wb, fileName) => wb.SheetNames.map((n) => readSheet(wb.Sheets[n], fileName, n));

  window.Cockpit.parse = { readFile, readWorkbook, parseDate, parseNum, parseBool, parseKey };
})();
