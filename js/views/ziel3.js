/* Reiter «Ziel 3»: Soll / Ist 12 Monate ohne Sozialhilfe (Haushalte). */
(function () {
  "use strict";
  const C = window.Cockpit;
  C.views.ziel3 = C.makeGoalView({
    no: 3, unit: "household", evaluate: C.rules.goal3,
    need: ["klient", "finanz"],
    deadlineKey: "c.respEnd", reachedKey: "c.reachedOn",
  });
})();
