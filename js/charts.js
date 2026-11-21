/* Kleine SVG-Diagramme ohne Bibliothek. Farben kommen aus CSS-Variablen (hell/dunkel). */
(function () {
  "use strict";
  const C = window.Cockpit;

  /* Gestapelter Balken. parts: [{value, cls, label}]. cls = CSS-Klasse für die Farbe (z.B. "green"). */
  function stackedBar(parts, { width = 160, height = 12 } = {}) {
    const total = parts.reduce((s, p) => s + p.value, 0);
    if (!total) return `<svg class="bar" width="${width}" height="${height}" aria-hidden="true"></svg>`;
    let x = 0;
    const rects = parts.filter((p) => p.value > 0).map((p) => {
      const w = (p.value / total) * width;
      const r = `<rect class="${p.cls}" x="${x.toFixed(1)}" y="0" width="${Math.max(w - 1, 0.5).toFixed(1)}" height="${height}" rx="2"><title>${C.util.esc(p.label)}: ${p.value}</title></rect>`;
      x += w;
      return r;
    }).join("");
    const label = parts.map((p) => `${p.label}: ${p.value}`).join(", ");
    return `<svg class="bar" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${C.util.esc(label)}">${rects}</svg>`;
  }

  // Ampel-Punkt mit Text (Farbe nie allein).
  const light = (cls, text) => `<span class="light ${cls}"><i aria-hidden="true"></i>${C.util.esc(text)}</span>`;

  C.charts = { stackedBar, light };
})();
