# Testdaten (synthetisch)

Alle Personen sind **fiktiv**. Erzeugt mit `tools/generator.js`:

```
osascript -l JavaScript tools/generate.jxa.js        # im Terminal (macOS), schreibt hierher
tools/generator.html                                  # im Browser, lädt testdata.zip herunter
```

- 11 Exporte `Testdaten_<Tabelle>.xlsx` – gleiche Spalten wie `templates/`
- `situationsanalyse/Situationsanalyse_<Dossier-Nr>.txt` – Freitext pro Haushalt nach Vorlage, mit Zemis-Nr. im Kopf
- Stichtag: 21.11.2026, Seed 20261121, 160 Haushalte (~450 Personen)

## Eingebaute Muster (zum Prüfen der Analyse)

| Merkmal | Wirkung |
|---|---|
| Sprachkurs besucht | A1 deutlich schneller |
| Sprachkurs früh (≤ 3 Monate nach Einreise, ~35 % der Kurse) | A1 früher (A1 frühestens 3 Monate nach Kursbeginn) |
| Primäranalphabet/-in / Zweitschriftlernende/-r | A1 deutlich / etwas langsamer |
| psychisch belastet (nur im Text) | A1 und Arbeit langsamer, weniger Kurse |
| Betreuung Kleinkinder (nur im Text) | weniger Kurse, Arbeit später, Pensum ≤ 60 % |
| Motivation hoch / tief (nur im Text) | schneller / langsamer |
| Kollektivunterkunft > 12 Monate | etwas langsamer |
| A1 früh erreicht, ≥ 5 Jahre Arbeitserfahrung | Arbeit früher |

## Eingebaute Datenqualitäts-Fälle

- ~2 % ohne Ereignis «Aufenthalt (Einreise)»; ~1 % ohne Geburtsdatum
- ~5 % Arbeit nur in ZEMIS Tätigkeit, fehlt im Erwerb
- ~15 % erreichte Ziele noch nicht in Integrationszielerreichung erfasst
- Status N und S (ausserhalb der Ziele), abgelaufene Zuständigkeit (B-FL+5, VA+7 …)
