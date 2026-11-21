/* Reiter «Ziel 1»: Soll / Ist Sprache A1 (Personen). */
(function () {
  "use strict";
  const C = window.Cockpit;
  C.views.ziel1 = C.makeGoalView({
    no: 1, unit: "person", evaluate: C.rules.goal1,
    need: ["klient", "asylgeschaeft", "sprachstand"],
    deadlineKey: "c.deadline", reachedKey: "c.reached",
  });
})();
