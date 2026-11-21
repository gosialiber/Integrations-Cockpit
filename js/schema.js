/* Schema der 11 Exporte aus dem Fallführungssystem.
 * Spaltennamen wörtlich aus templates/Hackathon_<Tabelle>_Resultat.xlsx.
 * Jede Spalte erhält eine feste Feld-ID, mit der der Rest der App arbeitet.
 * Typen: key (Schlüssel, als Text), date (ISO jjjj-mm-tt), num (Zahl), bool (Ja/Nein), text.
 */
(function () {
  "use strict";

  const C = (header, id, type = "text", required = true) => ({ header, id, type, required });

  const TABLES = [
    {
      id: "klient", name: "Klient", nameEn: "Client", descEn: "Master data, 1 row per person", level: "person", desc: "Stammdaten, 1 Zeile pro Person",
      columns: [
        C("Dossier-Nr.", "dossierNo", "key"),
        C("Unterstützung", "support"),
        C("Zemis Nummer", "zemis", "key"),
        C("Klientennummer", "clientNo", "key"),
        C("Zuständigkeitsbeginn", "respStart", "date"),
        C("Zuständigkeitsende", "respEnd", "date"),
        C("Datum Übergang Gemeindezuständigkeit", "municipalHandover", "date"),
        C("Verfahrensstand", "status"),
        C("Geschlecht", "gender"),
        C("Nationalität Land", "nationality"),
        C("Muttersprache", "motherTongue"),
        C("Zivilstand", "maritalStatus"),
        C("Jahre Arbeitserfahrung vor Einreise", "workYearsBefore", "num"),
        C("Höchste abgeschlossene Ausbildung", "highestEducation"),
        C("Lateinisch alphabetisiert", "latinLiterate"),
        C("Art Analphabetismus", "illiteracyType"),
        C("Schuljahre vor Einreise", "schoolYearsBefore", "num"),
        C("Fallführung", "caseManager"),
        C("Geburtsdatum", "birthDate", "date"),
      ],
    },
    {
      id: "asylgeschaeft", name: "Asylgeschäftsdaten", nameEn: "Asylum case events", descEn: "ZEMIS events (entry, asylum application)", level: "person", desc: "Ereignisse ZEMIS (Einreise, Asylgesuch)",
      columns: [
        C("Klient/-in Zemis-Nr.", "zemis", "key"),
        C("Klientennummer", "clientNo", "key"),
        C("Asylgeschäftsart", "eventType"),
        C("Ereignisdatum", "eventDate", "date"),
        C("Erledigung", "outcome"),
        C("Erledigungscode", "outcomeCode"),
        C("Erledigungsdatum", "outcomeDate", "date"),
      ],
    },
    {
      id: "verfahrensstand", name: "Asylverfahrensstand", nameEn: "Asylum procedure status", descEn: "Status history", level: "person", desc: "Status-Historie",
      columns: [
        C("Zemis Nummer", "zemis", "key"),
        C("Klientennummer", "clientNo", "key"),
        C("Dossier-Nr.", "dossierNo", "key"),
        C("Verfahrensstand Gültig ab", "from", "date"),
        C("Verfahrensstand Gültig bis", "to", "date"),
        C("Verfahrensstand", "status"),
      ],
    },
    {
      id: "dossierperson", name: "Dossierperson", nameEn: "Household member", descEn: "Members of the household", level: "household", desc: "Haushaltsmitglieder",
      columns: [
        C("Dossier-Nr.", "dossierNo", "key"),
        C("Klientennummer", "clientNo", "key"),
        C("Zemis Nummer", "zemis", "key"),
        C("Dossierperson Von", "from", "date"),
        C("Dossierperson Bis", "to", "date"),
        C("Rolle", "role"),
        C("Beziehung", "relationship"),
      ],
    },
    {
      id: "finanz", name: "Finanzielle Unterstützung", nameEn: "Financial support", descEn: "Social assistance periods per household", level: "household", desc: "Sozialhilfe-Perioden pro Haushalt",
      columns: [
        C("Dossier-Nr.", "dossierNo", "key"),
        C("Unterstützung", "support"),
        C("Finanzielle Unterstützung Gültig von", "from", "date"),
        C("Finanzielle Unterstützung Gültig bis", "to", "date"),
        C("Hauptgrund Beendigung Unterstützung", "endReason"),
      ],
    },
    {
      id: "unterbringung", name: "Unterbringung", nameEn: "Accommodation", descEn: "Type of housing and location", level: "person", desc: "Wohnform und Ort",
      columns: [
        C("Klientennummer", "clientNo", "key"),
        C("Unterbringung Von", "from", "date"),
        C("Unterbringung Bis", "to", "date"),
        C("Unterbringung Art", "type"),
        C("PLZ", "zip"),
        C("Ort", "town"),
      ],
    },
    {
      id: "sprachstand", name: "Sprachstand", nameEn: "Language level", descEn: "Language levels and proof", level: "person", desc: "Sprachniveaus und Nachweis",
      columns: [
        C("Klient/-in Zemis-Nr.", "zemis", "key"),
        C("Klientennummer", "clientNo", "key"),
        C("Sprache", "language"),
        C("Sprachniveau", "level"),
        C("Art", "proofType"),
        C("Bemerkungen", "remarks", "text", false),
        C("Datum Erreichung", "date", "date"),
      ],
    },
    {
      id: "foerderung", name: "Integrationsförderung und Ausbildung", nameEn: "Integration support and education", descEn: "Courses, bridging programmes, education", level: "person", desc: "Kurse, Brückenangebote, Ausbildung",
      columns: [
        C("Klient/-in Zemis-Nr.", "zemis", "key"),
        C("Klientennummer", "clientNo", "key"),
        C("Start", "start", "date"),
        C("Abschluss", "end", "date"),
        C("Institution Name", "institution"),
        C("Art", "type"),
        C("Bezeichnung", "title"),
        C("Stunden pro Woche", "hoursPerWeek", "num"),
        C("Bemerkungen", "remarks", "text", false),
      ],
    },
    {
      id: "erwerb", name: "Erwerb", nameEn: "Employment", descEn: "Jobs", level: "person", desc: "Anstellungen",
      columns: [
        C("Klient/-in Zemis-Nr.", "zemis", "key"),
        C("Klientennummer", "clientNo", "key"),
        C("Von", "from", "date"),
        C("Bis", "to", "date"),
        C("Arbeitgeber Name", "employer"),
        C("Arbeitgeber Ort", "employerTown"),
        C("Pensum %", "workload", "num"),
        C("Erwerbsstatus", "employmentStatus"),
        C("Monatseinkommen brutto CHF", "grossMonthly", "num"),
        C("Stundenlohn", "hourlyWage", "num"),
        C("Unregelmässiges Einkommen", "irregularIncome", "bool"),
        C("Abtretung Sozialdienst", "wageAssigned", "bool"),
        C("Bemerkungen", "remarks", "text", false),
      ],
    },
    {
      id: "zemisTaetigkeit", name: "ZEMIS Tätigkeit", nameEn: "ZEMIS employment", descEn: "Employment reported to the federal government", level: "person", desc: "Erwerbsmeldungen beim Bund",
      columns: [
        C("Zemis Nummer", "zemis", "key"),
        C("Klientennummer", "clientNo", "key"),
        C("Arbeitsbeginn", "start", "date"),
        C("Verpflichtet bis", "end", "date"),
        C("Betrieb", "company"),
      ],
    },
    {
      id: "zielerreichung", name: "Integrationszielerreichung", nameEn: "Integration goals reached", descEn: "Goals reached and paid", level: "person", desc: "Erreichte, abgegoltene Ziele",
      columns: [
        C("Klient/-in Zemis-Nr.", "zemis", "key"),
        C("Art", "goalType"),
        C("Erreicht am", "reachedOn", "date"),
        C("Partner", "partner"),
        C("Jahr Grundgesamtheit", "cohortYear", "num"),
        C("Ziel mit Status S erreicht", "reachedWithS", "bool"),
      ],
    },
    {
      // Optional: Ergebnis des separaten KI-Schritts (Merkmale aus der Situationsanalyse), Schlüssel Zemis-Nr.
      // Wird nur in «Muster» für Gruppenvergleiche verwendet, nie pro Person angezeigt.
      id: "merkmale", name: "Situationsanalyse_Merkmale", nameEn: "Situation analysis features", optional: true, level: "person",
      desc: "Optional: Merkmale aus der Situationsanalyse (KI-Schritt)", descEn: "Optional: features from the situation analysis (AI step)",
      columns: [
        C("Zemis-Nr.", "zemis", "key"),
        C("Dossier-Nr.", "dossierNo", "key", false),
        C("Arbeitsfähigkeit eingeschränkt", "workLimited", "bool"),
        C("Psychisch belastet", "psych", "bool", false),
        C("Betreuung Kleinkinder", "childcare", "bool"),
        C("Motivation", "motivation"),
        C("Lerntempo", "pace", "text", false),
        C("Kooperation", "cooperation", "text", false),
        C("Führerschein", "license", "bool", false),
        C("EDV-Kenntnisse", "ict", "text", false),
      ],
    },
  ];

  window.Cockpit = window.Cockpit || {};
  window.Cockpit.TABLES = TABLES;
})();
