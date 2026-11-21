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

  // Ampel mit Form und Text (Farbe nie allein): grün = Kreis mit Haken, gelb = Ring, rot = Dreieck, grau = Strich.
  const SHAPES = {
    green: '<circle cx="7" cy="7" r="7"/><path class="tick" d="M3.8 7.3l2.2 2.2 4.2-4.6"/>',
    yellow: '<circle cx="7" cy="7" r="5.5"/>',
    red: '<path d="M7 .8l6.6 12.2H.4z"/>',
    grey: '<rect x="1.5" y="5.8" width="11" height="2.4" rx="1.2"/>',
  };
  const light = (cls, text) => `<span class="light ${cls}"><svg class="shape" viewBox="0 0 14 14" aria-hidden="true">${SHAPES[cls] || SHAPES.grey}</svg>${C.util.esc(text)}</span>`;

  C.charts = { stackedBar, light };
})();
