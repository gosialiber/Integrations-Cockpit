/* Reiter «Ziel 2»: Soll / Ist Arbeit / Ausbildung (Personen). */
(function () {
  "use strict";
  const C = window.Cockpit;
  C.views.ziel2 = C.makeGoalView({
    no: 2, unit: "person", evaluate: C.rules.goal2,
    need: ["klient", "erwerb", "foerderung"],
    deadlineKey: "c.respEnd", reachedKey: "c.reachedOn",
  });
})();
