/* Reiter «Daten»: Exporte laden, erkannte Tabellen und Datenqualität anzeigen, Vorschau. */
(function () {
  "use strict";
  const C = window.Cockpit;
  const { TABLES, parse } = C;
  const { t, term } = C.i18n;

  let previewId = null; // welche Tabelle in der Vorschau gezeigt wird
  let busy = false;

  async function handleFiles(fileList) {
    const files = [...fileList].filter((f) => /\.xlsx?$/i.test(f.name));
    if (!files.length) return;
    busy = true; C.render();
    for (const f of files) {
      try {
        for (const s of await parse.readFile(f)) {
          // Gleiche Tabelle nochmals geladen → ersetzt die alte (z.B. Export vom nächsten Monat).
          if (s.recognised) C.state.loaded[s.table.id] = s;
          else C.state.unrecognised.push(`${s.fileName} (${s.sheetName})`);
        }
      } catch (e) {
        C.state.unrecognised.push(`${f.name}: ${e.message}`);
      }
    }
    busy = false;
    C.state.source = "files";
    // Nach erfolgreichem Laden direkt ins Cockpit (Startseite)
    if (Object.keys(C.state.loaded).length && location.hash !== "#cockpit") location.hash = "#cockpit";
    else C.render();
  }

  // Frühestes und spätestes Datum über alle Datumsspalten.
  function dateRange(s) {
    const ids = s.table.columns.filter((c) => c.type === "date").map((c) => c.id);
    let min = null, max = null;
    for (const r of s.rows) for (const id of ids) {
      const v = r[id];
      if (v && (!min || v < min)) min = v;
      if (v && (!max || v > max)) max = v;
    }
    return min ? `${C.util.fmtDate(min)} – ${C.util.fmtDate(max)}` : "–";
  }

  // Anzahl Personen (Zemis-Nr. bzw. Klientennummer) oder Dossiers bei Haushaltstabellen.
  function entityCount(s) {
    const hh = s.table.level === "household";
    const key = hh ? "dossierNo" : (s.table.columns.some((c) => c.id === "zemis") ? "zemis" : "clientNo");
    return { n: new Set(s.rows.map((r) => r[key]).filter(Boolean)).size, label: t(hh ? "dossiers" : "persons") };
  }

  function card(tbl) {
    const { esc } = C.util;
    const s = C.state.loaded[tbl.id];
    const name = esc(term(tbl.name, tbl.nameEn));
    const desc = esc(C.i18n.getLang() === "en" ? tbl.descEn : tbl.desc);
    if (!s && tbl.optional) return `<li class="tcard missing optional"><div class="tname">${name}</div><div class="tdesc">${desc}</div><div class="tstat">${t("optionalTable")}</div></li>`;
    if (!s) return `<li class="tcard missing"><div class="tname">${name}</div><div class="tdesc">${desc}</div><div class="tstat">${t("notLoaded")}</div></li>`;
    const ec = entityCount(s);
    const warn = s.missing.length || s.problems.length;
    return `<li class="tcard ${warn ? "warn" : "ok"} ${previewId === tbl.id ? "sel" : ""}" data-id="${tbl.id}" tabindex="0" role="button" aria-label="${t("previewOf")} ${name}">
      <div class="tname">${warn ? "⚠️" : "✓"} ${name}</div>
      <div class="tdesc">${esc(s.fileName)}</div>
      <div class="tstat"><b>${s.rows.length}</b> ${t("rows")} · <b>${ec.n}</b> ${ec.label}</div>
      <div class="tdesc">${t("dataRange")}: ${dateRange(s)}</div>
      ${s.missing.length ? `<div class="tissue">${t("missingCols")}: ${esc(s.missing.join(", "))}</div>` : ""}
      ${s.problems.length ? `<div class="tissue">${t("unreadable", { n: s.problems.length })}</div>` : ""}
    </li>`;
  }

  function cell(v, type) {
    if (v === null || v === undefined) return "";
    if (type === "date") return C.util.fmtDate(v);
    if (type === "bool") return v ? t("yes") : t("no");
    return C.util.esc(v);
  }

  function preview() {
    const { esc } = C.util;
    const s = previewId && C.state.loaded[previewId];
    if (!s) return "";
    const cols = s.table.columns, rows = s.rows.slice(0, 50), probs = s.problems.slice(0, 20);
    return `<section id="preview">
      <h2>${esc(term(s.table.name, s.table.nameEn))} <small>${esc(s.fileName)} · ${t("headerRow", { n: s.headerRow })}</small></h2>
      ${s.extra.length ? `<p class="muted">${t("extraCols")}: ${esc(s.extra.join(", "))}</p>` : ""}
      ${probs.length ? `<details open><summary>${t("unreadableValues")} (${s.problems.length})</summary><ul class="issues">
        ${probs.map((p) => `<li>${t("row")} ${p.row}, «${esc(p.column)}»: <code>${esc(p.value)}</code></li>`).join("")}
        ${s.problems.length > 20 ? `<li>${t("more", { n: s.problems.length - 20 })}</li>` : ""}</ul></details>` : ""}
      <div class="scroll"><table>
        <thead><tr><th>${t("row")}</th>${cols.map((c) => `<th>${esc(c.header)}</th>`).join("")}</tr></thead>
        <tbody>${rows.map((r) => `<tr><td class="muted">${r._row}</td>${cols.map((c) => `<td>${cell(r[c.id], c.type)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>
      ${s.rows.length > 50 ? `<p class="muted">${t("firstRows", { n: 50, total: s.rows.length })}</p>` : ""}
    </section>`;
  }

  function render(el) {
    const { esc, $ } = C.util;
    const n = Object.keys(C.state.loaded).length;
    el.innerHTML = `
      <h2>${t("loadTitle")}</h2>
      <div id="drop" class="drop" tabindex="0" role="button">
        <strong>${t("dropMain")}</strong> ${t("dropOr")}<br><span class="muted">${t("dropHint")}</span>
        <input id="file" type="file" accept=".xlsx,.xls" multiple hidden>
      </div>
      <div class="bar">
        <span>${t("progress", { n: TABLES.filter((x) => !x.optional && C.state.loaded[x.id]).length, total: TABLES.filter((x) => !x.optional).length })}</span>
        ${busy ? `<span>${t("busy")}</span>` : ""}
        ${n || C.state.unrecognised.length ? `<button id="clear" type="button">${t("clear")}</button>` : ""}
      </div>
      ${C.state.unrecognised.length ? `<p class="tissue">${t("unrecognised")}: ${C.state.unrecognised.map(esc).join("; ")}</p>` : ""}
      <ul class="tables">${TABLES.map(card).join("")}</ul>
      ${preview()}`;

    const drop = $("#drop", el), input = $("#file", el);
    drop.addEventListener("click", () => input.click());
    drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    input.addEventListener("change", () => handleFiles(input.files));
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
    drop.addEventListener("drop", (e) => handleFiles(e.dataTransfer.files));
    const clear = $("#clear", el);
    if (clear) clear.addEventListener("click", () => { C.state.loaded = {}; C.state.unrecognised = []; C.state.done.clear(); C.state.source = null; previewId = null; C.render(); });
    el.querySelectorAll(".tcard[data-id]").forEach((c) => {
      const open = () => { previewId = c.dataset.id; C.render(); $("#preview").scrollIntoView({ behavior: "smooth", block: "start" }); };
      c.addEventListener("click", open);
      c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    });
  }

  C.views.daten = { render };
})();
