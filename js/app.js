/* App-Rahmen: Reiter, Sprachumschaltung, gemeinsamer Zustand.
 * Jeder Reiter ist eine «View» in js/views/*.js mit einer Funktion render(element).
 */
(function () {
  "use strict";
  const C = window.Cockpit;
  const { t } = C.i18n;

  // Zustand nur im Arbeitsspeicher. loaded: Tabellen-ID → Ergebnis von parse.readSheet.
  // stichtag: gemeinsam für Cockpit und Ziel-Reiter. done: im Cockpit als erledigt markierte Punkte.
  C.state = { loaded: {}, unrecognised: [], stichtag: C.rules.todayIso(), done: new Set(), source: null };

  // Kleine Helfer, die alle Views nutzen.
  C.util = {
    $: (sel, root = document) => root.querySelector(sel),
    esc: (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])),
    fmtDate: (iso) => (iso ? iso.split("-").reverse().join(".") : ""),
  };

  const TABS = ["daten", "cockpit", "ziel1", "ziel2", "ziel3", "muster"];
  C.views = C.views || {};

  // Aktiver Reiter steht im URL-Fragment (#ziel1), damit Neuladen und Zurück-Taste funktionieren.
  const currentTab = () => (TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "daten"); // Startseite: Daten laden

  function renderShell() {
    const { $ } = C.util;
    $("#subtitle").textContent = t("appSubtitle");
    // Datenschutz-Hinweis als kleines Schloss-Abzeichen; ausführlicher Text als Tooltip
    const priv = $("#privacy");
    priv.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 7V5a4 4 0 1 1 8 0v2h1v8H3V7h1zm2 0h4V5a2 2 0 1 0-4 0v2z"/></svg>${t("privacyBadge")}`;
    priv.title = t("privacy");
    // Reiter: Klasse pro Reiter (Farbe der aktiven Linie), Punkt in Zielfarbe vor den Ziel-Reitern
    $("#tabs").innerHTML = TABS.map((id) =>
      `<a href="#${id}" role="tab" aria-selected="${id === currentTab()}" class="tab-${id} ${id === currentTab() ? "on" : ""}">${/^ziel/.test(id) ? '<span class="tdot" aria-hidden="true"></span>' : ""}${t("tab." + id)}</a>`).join("");
    document.querySelectorAll("#lang button").forEach((b) => b.setAttribute("aria-pressed", b.dataset.l === C.i18n.getLang()));
  }

  // Zeichnet den aktiven Reiter neu. Wird nach jedem Laden von Daten und bei Sprachwechsel aufgerufen.
  C.render = function () {
    renderShell();
    const id = currentTab();
    const el = C.util.$("#view");
    el.dataset.tab = id; // für Akzentfarbe des Reiters (CSS)
    const view = C.views[id];
    if (view) view.render(el);
    else el.innerHTML = `<p class="placeholder">${t("comingSoon")}</p>`;
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.documentElement.lang = C.i18n.getLang();
    document.querySelectorAll("#lang button").forEach((b) => b.addEventListener("click", () => C.i18n.setLang(b.dataset.l)));
    C.i18n.onChange(C.render);
    window.addEventListener("hashchange", C.render);
    C.render();
  });
})();
