# Annahmen zu den Regeln (bitte durch ASD bestätigen)

Alle Regeln sind in `js/rules.js` als Konstanten umgesetzt und dort anpassbar.

## Allgemein

| # | Annahme | Quelle / Begründung |
|---|---------|---------------------|
| A1 | **Aktuelle Klient:innen** = `Zuständigkeitsende` leer oder ≥ Stichtag. Bereits übergebene Personen (z.B. B-FL+5, VA+7) werden separat als «abgeschlossen» gezeigt. | Challenge: «for our current clients» |
| A2 | **Einreisedatum** = frühestes `Ereignisdatum` mit `Asylgeschäftsart` «Aufenthalt (Einreise)»; bei in der Schweiz geborenen Kindern «Aufenthalt (Geburt)». | Challenge «Good to know» |
| A3 | **Status** für den Zielbereich = `Verfahrensstand` in `Klient` (aktuell). VA und FL = VA, F-FL, B-FL, B-RSFL, B-SL. N und S sind ausgeschlossen. | Challenge |
| A4 | **Stichtag** = heutiges Datum, in der App änderbar. | – |

## Ziel 1 · Sprache A1

| # | Annahme | Quelle / Begründung |
|---|---------|---------------------|
| Z1.1 | **Frist** = Einreisedatum + 3 Jahre. | Challenge |
| Z1.2 | **«16+»**: im Zielbereich ist, wer **vor Ablauf der Frist** 16 Jahre alt wird (nicht nur, wer bei Einreise 16 war). | Entscheid Team, offen für ASD |
| Z1.3 | **A1 erreicht** = Eintrag in `Sprachstand` mit Niveau A1 oder höher **und** Nachweis-Art Zertifizierung, Muttersprache, Beendigung obligatorische Schulzeit oder Beendigung Ausbildung. «Weiteres» (z.B. Einstufung) zählt nicht. Massgebend ist das früheste solche Datum. Ein Eintrag «Sprachniveau A1» in `Integrationszielerreichung` zählt ebenfalls. | Challenge, Datenmodell |
| Z1.4 | **Erreicht in Frist** = Datum Erreichung ≤ Frist. Nach der Frist erreicht = «verpasst» (wird nicht abgegolten). | Challenge «within a deadline» |
| Z1.5 | **Noch nicht gemeldet** = in Frist erreicht laut `Sprachstand`, aber kein Eintrag «Sprachniveau A1» in `Integrationszielerreichung`. | Entscheid Team |
| Z1.6 | **Ampel** (nicht erreicht): rot = Frist abgelaufen oder < 6 Monate; gelb = mehr Zeit. | Entscheid Team |

## Ziel 2 · Arbeit ≥ 60 % (6 Monate) oder Ausbildung Sek II / Tertiär

| # | Annahme | Quelle / Begründung |
|---|---------|---------------------|
| Z2.1 | **Frist** = `Zuständigkeitsende` der Person. Fehlt es, ist Ziel 2 nicht beurteilbar. | Challenge |
| Z2.2 | **«16+»** wie Ziel 1: im Zielbereich, wer spätestens am Zuständigkeitsende 16 ist. | analog Z1.2 |
| Z2.3 | **Arbeit**: Pensen gleichzeitiger Anstellungen (`Erwerb`) werden **addiert**. Ziel erreicht, sobald die Summe **6 Monate ohne Unterbruch ≥ 60 %** ist. Lücken bis **7 Tage** (Stellenwechsel) unterbrechen nicht. Laufende Anstellungen (ohne «Bis») zählen bis zum Stichtag. Erreicht am = Beginn + 6 Monate. | Entscheid Team |
| Z2.4 | Selbstständige und unselbstständige Erwerbstätigkeit zählen beide. | offen für ASD |
| Z2.5 | **Ausbildung**: Eintrag in `Integrationsförderung und Ausbildung` mit Art «Sek II» oder «Tertiär»; erreicht am **Startdatum** («Aufnahme Ausbildung»). | Entscheid Team |
| Z2.6 | **Ampel** (nicht erreicht): gelb, wenn die Person aktuell ≥ 60 % arbeitet und die 6 Monate vor der Frist voll werden; rot, wenn weniger als **12 Monate** bis zur Frist bleiben (6 Monate Suche + 6 Monate Arbeit) oder die laufende Arbeit erst nach der Frist 6 Monate erreicht. | Entscheid Team |
| Z2.7 | **Noch nicht gemeldet**: erreicht, aber kein Eintrag «Aufnahme Ausbildung / Erwerbstätigkeit» in `Integrationszielerreichung`. | analog Z1.5 |
| Z2.8 | **Datenqualität**: Arbeit in `ZEMIS Tätigkeit` ohne passende Anstellung im `Erwerb` (Beginn ± 31 Tage) wird als Hinweis angezeigt. | Challenge «further ideas» |

## Ziel 3 · 12 Monate ohne Sozialhilfe (Haushalt)

| # | Annahme | Quelle / Begründung |
|---|---------|---------------------|
| Z3.1 | **Haushalt** = `Dossier-Nr.` aus `Klient`. Im Zielbereich, wenn mindestens ein Mitglied VA oder FL ist. | Challenge |
| Z3.2 | **Frist** = spätestes `Zuständigkeitsende` der Mitglieder im Zielbereich. | Entscheid Team |
| Z3.3 | **Ohne Sozialhilfe** = Perioden in `Finanzielle Unterstützung` mit Unterstützung «Keine Unterstützung». «Nothilfe» gilt als Unterstützung. Lücken in den Daten gelten **nicht** als ohne Sozialhilfe. Aufeinanderfolgende Perioden (≤ 1 Tag Abstand) werden zusammengezählt. | Entscheid Team |
| Z3.4 | Erreicht am = Beginn einer ununterbrochenen Periode ohne Sozialhilfe + 12 Monate. | Challenge |
| Z3.5 | **Ampel** (nicht erreicht): gelb, wenn der Haushalt aktuell ohne Sozialhilfe ist und die 12 Monate vor der Frist voll werden; rot, wenn weniger als **18 Monate** bis zur Frist bleiben oder die laufende Periode erst nach der Frist 12 Monate erreicht. | Entscheid Team |
| Z3.6 | **Noch nicht gemeldet**: erreicht, aber bei keinem Mitglied ein Eintrag «Finanzielle Unabhängigkeit». | analog Z1.5 |

## Cockpit

| # | Annahme | Quelle / Begründung |
|---|---------|---------------------|
| C.1 | **Anrufliste** enthält: Ziele mit Ampel rot **und noch offener Frist** («gefährdet»), erreichte aber nicht gemeldete Ziele, Datenqualität. Ziele mit bereits abgelaufener Frist (verpasst / nach Frist erreicht) sind in der Matrix rot, aber nicht in der Anrufliste – ein Anruf ändert daran nichts mehr. | Entscheid Team |
| C.2 | **Datenqualität** = fehlendes Einreisedatum, Geburtsdatum, Zuständigkeitsende oder fehlende Finanzdaten (bei Status im Zielbereich) sowie ZEMIS-Arbeit ohne Erwerb. Ein Punkt pro Person bzw. Haushalt. | Entscheid Team |
| C.3 | **Ziel 3** erscheint pro Haushalt; Hauptperson = älteste Person im Dossier (die Rolle «Dossierträger/-in» steht nicht im Klient-Export). Der Haushalt gehört zur Fallführung der Hauptperson. | Datenmodell |
| C.4 | **Übersicht**: Gruppen mit weniger als 5 Personen werden ausgeblendet (Datenschutz). | Entscheid Team |
| C.5 | **Initialen** können nicht angezeigt werden: die Exporte enthalten keine Namen. Angezeigt wird die Klientennummer. | Datenmodell |

## Muster (Level 2 · «Was hilft?»)

| # | Annahme | Quelle / Begründung |
|---|---------|---------------------|
| M.1 | **Grundsatz**: nur Gruppenvergleiche, keine Personenlisten, keine Scores oder Wahrscheinlichkeiten pro Person. Zusammenhänge, keine Beweise für Ursachen. | Challenge «patterns on groups, never a score per person» |
| M.2 | **Faire Messung «Erreicht in Frist»**: nur Personen / Haushalte im Zielbereich, deren Frist vor dem Stichtag liegt (inkl. abgeschlossene Zuständigkeit). Erfolg = in Frist erreicht. | Entscheid Team |
| M.3 | **Faire Messung «Erreicht nach X Monaten»** (12 / 24 / 36): nur Fälle mit Einreise mindestens X Monate vor dem Stichtag. Erfolg = Ziel spätestens X Monate nach Einreise erreicht. Kürzlich Eingereiste zählen so nicht als Misserfolg. | Entscheid Team |
| M.4 | **Ziel 3**: Einheit = Haushalt; Personen-Faktoren beziehen sich auf die Hauptperson (siehe C.3). | Entscheid Team |
| M.5 | **Gruppen**: Alter bei Einreise 16–25 / 26–35 / 36–45 / 46+ (unter 16 separat, weil «16+» bis zur Frist zählt); Schuljahre 0 / 1–6 / 7–12 / > 12; Arbeitserfahrung 0 / 1–5 / > 5; Verfahrensstand VA vs. FL (= B-FL, F-FL, B-RSFL, B-SL). Muttersprachen mit < 10 Personen → «andere». | Entscheid Team |
| M.6 | **Erster Sprachkurs** = frühester Eintrag Art «Förderangebot Sprache»; Monate ab Einreisedatum. **Anzahl Kurse** zählt Förderangebote, Brückenangebote, Kurs Schlüsselkompetenzen, Sprachkurs (N), Beschäftigungsangebot (N), IV-Massnahmen, RAV – nicht Volksschule, Erstinformation, Sek II / Tertiär (die sind selbst Ziel 2). | Entscheid Team |
| M.7 | **A1 vor Arbeitsbeginn** (Ziel 2): ja = A1 erreicht vor der ersten Anstellung im Erwerb, oder A1 erreicht und noch keine Anstellung. | Entscheid Team |
| M.8 | **Kinder unter 4 J.**: bei Einreise des Haushalts. **Erwerbstätige im Haushalt**: Mitglieder mit mindestens einer Anstellung bis zum Stichtag. | Entscheid Team |
| M.9 | **Datenschutz**: Gruppen mit n < 5 ohne Zahlen (Anzeige und Export); Rohzahlen kleiner Gruppen verlassen `analyze()` nicht. Bekannte Grenze: wenn nur eine Gruppe ausgeblendet ist, liesse sie sich aus Gesamtzahl minus übrige Gruppen zurückrechnen (keine sekundäre Sperrung umgesetzt). | Entscheid Team, offen für ASD |
| M.10 | **Optionale 12. Tabelle** `Situationsanalyse_Merkmale` (Ergebnis des KI-Schritts, Schlüssel Zemis-Nr.): Pflichtspalten Zemis-Nr., Arbeitsfähigkeit eingeschränkt, Betreuung Kleinkinder, Motivation; optional Dossier-Nr., Psychisch belastet, Lerntempo, Kooperation, Führerschein, EDV-Kenntnisse. Nur für Gruppenvergleiche. | Schnittstelle zum KI-Schritt |
| M.11 | **Stärkste Unterschiede**: die 5 Gruppen (n ≥ 5, ohne «unbekannt» / «andere») mit der grössten Abweichung zur Gesamtquote. Nur Fakten, keine Empfehlungen. | Entscheid Team |
