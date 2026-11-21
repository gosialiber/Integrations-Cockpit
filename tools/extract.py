#!/usr/bin/env python3
"""KI-Schritt: Merkmale aus den Situationsanalysen extrahieren → Situationsanalyse_Merkmale.xlsx

Läuft lokal, nur mit der Python-Standardbibliothek (keine Installation nötig).

  python3 -I tools/extract.py                      # auto: LM Studio, sonst Regeln (mock)
  python3 -I tools/extract.py --mode mock          # nur Regeln, ohne KI
  python3 -I tools/extract.py --mode lmstudio --model qwen3-8b
  python3 -I tools/extract.py --compare            # KI und Regeln vergleichen (Qualitätskontrolle)

Datenschutz:
  - Die KI läuft lokal in LM Studio (localhost). Andere Adressen werden abgelehnt (--allow-remote nötig).
  - Vor dem Senden wird pseudonymisiert: Namen, Zemis-/Dossier-Nummern, Daten, Telefon, E-Mail → Platzhalter.
  - Gesendet wird nur der Abschnitt «Individuelle Potenzialerhebung» einer Person, nicht der ganze Bericht.
  - Ausgegeben werden nur 5 Merkmale pro Person (Zemis-Nr. als Schlüssel), keine Texte.
  - Im Terminal werden keine Inhalte der Berichte ausgegeben, nur Zählungen.

Ergebnis: 12. Tabelle (optional) für das Cockpit, Spalten siehe ANNAHMEN.md M.10.
"""
import argparse
import glob
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from xml.sax.saxutils import escape

# ---------- Ausgabe-Spalten (müssen zu js/schema.js, Tabelle «merkmale», passen) ----------
COLUMNS = ["Zemis-Nr.", "Dossier-Nr.", "Arbeitsfähigkeit eingeschränkt", "Psychisch belastet",
           "Betreuung Kleinkinder", "Motivation", "Lerntempo", "Methode"]
YES, NO, UNKNOWN = "Ja", "Nein", ""

# ---------- Text zerlegen ----------
SECTION_RE = re.compile(r"\n(?=\d+\. Individuelle Potenzialerhebung von )")
HEAD_RE = re.compile(r"^\d+\. Individuelle Potenzialerhebung von (\S+) (\S+), (\d\d\.\d\d\.\d{4})")
PERSON_RE = re.compile(r"Name: (\S+)\s+Vorname: (\S+)\s+Geburtsdatum: (\d\d\.\d\d\.\d{4})[\s\S]*?Zemis-Nr\.: (\d+)")


def split_report(text):
    """Bericht → Liste von Personen-Abschnitten mit Zemis-Nr. (über Vorname + Geburtsdatum aus den Personalien).

    Gibt zurück: [{"zemis", "section", "names"}], names = alle Namen im Bericht (für die Pseudonymisierung).
    """
    ids, names = {}, set()
    for last, first, birth, zemis in PERSON_RE.findall(text):
        ids[(first, birth)] = zemis
        names.update([last, first])
    sar = re.search(r"Zust\. SAR: (.+)", text)
    if sar:
        names.update(sar.group(1).split())
    out = []
    for block in SECTION_RE.split(text)[1:]:
        m = HEAD_RE.match(block)
        if not m:
            continue
        zemis = ids.get((m.group(2), m.group(3)))
        if zemis:
            out.append({"zemis": zemis, "section": block, "names": names})
    return out


def pseudonymise(section, names):
    """Personenbezogene Angaben durch Platzhalter ersetzen, bevor Text an ein Modell geht."""
    s = section
    for n in sorted(names, key=len, reverse=True):
        if len(n) > 1:
            s = re.sub(r"\b" + re.escape(n) + r"\b", "[NAME]", s)
    s = re.sub(r"\b\d\d\.\d\d\.\d{4}\b", "[DATUM]", s)
    s = re.sub(r"\bD\d+\.\d+\b", "[DOSSIER]", s)
    s = re.sub(r"\b\d{6,}\b", "[NUMMER]", s)
    s = re.sub(r"[\w.+-]+@[\w-]+\.[\w.]+", "[EMAIL]", s)
    s = re.sub(r"\+?\d[\d ]{8,}\d", "[TELEFON]", s)
    return s


# ---------- Regeln (mock) ----------
def field(section, label):
    m = re.search(re.escape(label) + r"[^:\n]*: (.*)", section)
    return m.group(1).strip() if m else ""


def extract_rules(section):
    """Einfache Textregeln – Rückfall, wenn keine KI läuft, und Vergleich zur Qualitätskontrolle."""
    work = field(section, "Einfluss auf die Arbeitsfähigkeit")
    psych = field(section, "Psychischer Gesundheitszustand")
    avail = field(section, "Verfügbarkeit für Arbeit oder Bildung")
    moti = field(section, "Einschätzung Potenzial und Motivation")
    pace = field(section, "Lerntempo")
    yn = lambda cond, known: (YES if cond else NO) if known else UNKNOWN
    return {
        "Arbeitsfähigkeit eingeschränkt": yn(re.search(r"\d+ ?%|eingeschränkt", work, re.I) and not re.match(r"Keine?r?\b", work), bool(work)),
        "Psychisch belastet": yn(not re.match(r"stabil", psych, re.I), bool(psych)),
        "Betreuung Kleinkinder": yn(re.search(r"Betreuung von|Kleinkind", avail, re.I), bool(avail)),
        "Motivation": ("hoch" if re.search(r"hohe|sehr motiviert", moti, re.I) else
                       "tief" if re.search(r"gering|wenig", moti, re.I) else "mittel" if moti else UNKNOWN),
        "Lerntempo": ("langsam" if re.match(r"langsam", pace, re.I) else
                      "schnell" if re.match(r"schnell", pace, re.I) else "mittel" if pace else UNKNOWN),
    }


# ---------- LM Studio (OpenAI-kompatible API, lokal) ----------
SCHEMA = {
    "type": "object",
    "properties": {
        "arbeitsfaehigkeit_eingeschraenkt": {"type": "string", "enum": ["ja", "nein", "unbekannt"]},
        "psychisch_belastet": {"type": "string", "enum": ["ja", "nein", "unbekannt"]},
        "betreuung_kleinkinder": {"type": "string", "enum": ["ja", "nein", "unbekannt"]},
        "motivation": {"type": "string", "enum": ["hoch", "mittel", "tief", "unbekannt"]},
        "lerntempo": {"type": "string", "enum": ["schnell", "mittel", "langsam", "unbekannt"]},
    },
    "required": ["arbeitsfaehigkeit_eingeschraenkt", "psychisch_belastet", "betreuung_kleinkinder", "motivation", "lerntempo"],
    "additionalProperties": False,
}
SYSTEM = (
    "Du liest den Abschnitt «Individuelle Potenzialerhebung» einer Situationsanalyse des Asylsozialdienstes "
    "und gibst genau fünf Merkmale als JSON zurück. Nur was im Text steht; wenn nichts dazu steht: «unbekannt». "
    "arbeitsfaehigkeit_eingeschraenkt: ja, wenn ein Arztzeugnis oder eine Einschränkung der Arbeitsfähigkeit genannt ist. "
    "psychisch_belastet: ja, wenn eine psychische Belastung, Erkrankung oder Behandlung genannt ist; nein bei «stabil». "
    "betreuung_kleinkinder: ja, wenn die Verfügbarkeit wegen Betreuung von Kleinkindern eingeschränkt ist. "
    "motivation: Einschätzung der Sozialarbeiterin / des Sozialarbeiters (hoch, mittel, tief). "
    "lerntempo: schnell, mittel oder langsam laut Text. Keine Erklärungen, nur JSON."
)
MAP_YN = {"ja": YES, "nein": NO, "unbekannt": UNKNOWN}


def is_local(url):
    host = urllib.parse.urlparse(url).hostname or ""
    return host in ("localhost", "127.0.0.1", "::1")


def http_json(url, payload=None, timeout=120):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def pick_model(base, wanted=None):
    """Ersten geladenen Chat-Modell wählen (Embedding-Modelle überspringen) oder das gewünschte prüfen."""
    ids = [m["id"] for m in http_json(base + "/models", timeout=3).get("data", [])]
    chat = [i for i in ids if "embed" not in i.lower()]
    if wanted:
        if wanted not in ids:
            raise RuntimeError(f"Modell «{wanted}» ist in LM Studio nicht geladen. Geladen: {', '.join(ids) or 'keine'}")
        return wanted
    if not chat:
        raise RuntimeError("In LM Studio ist kein Chat-Modell geladen (nur: " + (", ".join(ids) or "keine") + ").")
    return chat[0]


def extract_llm(section_pseudo, base, model):
    payload = {
        "model": model,
        "temperature": 0,
        "max_tokens": 300,
        "messages": [{"role": "system", "content": SYSTEM},
                     {"role": "user", "content": section_pseudo + "\n\n/no_think"}],  # Qwen3: ohne «Denken», nur JSON
        "response_format": {"type": "json_schema", "json_schema": {"name": "merkmale", "strict": True, "schema": SCHEMA}},
    }
    content = http_json(base + "/chat/completions", payload)["choices"][0]["message"]["content"]
    content = re.sub(r"<think>[\s\S]*?</think>", "", content).strip()   # falls das Modell trotzdem «denkt»
    m = re.search(r"\{[\s\S]*\}", content)
    d = json.loads(m.group(0) if m else content)
    return {
        "Arbeitsfähigkeit eingeschränkt": MAP_YN.get(d.get("arbeitsfaehigkeit_eingeschraenkt"), UNKNOWN),
        "Psychisch belastet": MAP_YN.get(d.get("psychisch_belastet"), UNKNOWN),
        "Betreuung Kleinkinder": MAP_YN.get(d.get("betreuung_kleinkinder"), UNKNOWN),
        "Motivation": "" if d.get("motivation") in (None, "unbekannt") else d["motivation"],
        "Lerntempo": "" if d.get("lerntempo") in (None, "unbekannt") else d["lerntempo"],
    }


# ---------- Excel schreiben (minimales .xlsx ohne Zusatzpakete) ----------
def col_name(i):
    s = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def write_xlsx(path, rows):
    def cell(r, c, v):
        return f'<c r="{col_name(c)}{r}" t="inlineStr"><is><t>{escape(str(v))}</t></is></c>' if v != "" else ""
    sheet_rows = "".join(f'<row r="{r + 1}">' + "".join(cell(r + 1, c, v) for c, v in enumerate(row)) + "</row>"
                         for r, row in enumerate(rows))
    files = {
        "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        "xl/workbook.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Merkmale" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            f'<sheetData>{sheet_rows}</sheetData></worksheet>',
    }
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, content in files.items():
            z.writestr(name, content)


# ---------- Ablauf ----------
def main(argv=None):
    ap = argparse.ArgumentParser(description="Merkmale aus Situationsanalysen extrahieren (lokal).")
    ap.add_argument("--in", dest="inp", default="testdata/situationsanalyse", help="Ordner mit .txt-Berichten")
    ap.add_argument("--out", default="testdata/Situationsanalyse_Merkmale.xlsx")
    ap.add_argument("--mode", choices=["auto", "lmstudio", "mock"], default="auto")
    ap.add_argument("--url", default="http://localhost:1234/v1", help="LM Studio Server")
    ap.add_argument("--model", default=None, help="Modell-ID in LM Studio (Standard: erstes geladenes Chat-Modell)")
    ap.add_argument("--limit", type=int, default=0, help="nur die ersten N Berichte (zum Ausprobieren)")
    ap.add_argument("--compare", action="store_true", help="KI-Ergebnis mit den Regeln vergleichen")
    ap.add_argument("--allow-remote", action="store_true", help="nicht-lokale Server erlauben (Daten verlassen den Computer!)")
    a = ap.parse_args(argv)

    files = sorted(glob.glob(os.path.join(a.inp, "*.txt")) + glob.glob(os.path.join(a.inp, "*.md")))
    if a.limit:
        files = files[: a.limit]
    if not files:
        print(f"Keine Berichte (.txt/.md) in {a.inp}", file=sys.stderr)
        return 1

    mode, model = a.mode, None
    if mode in ("auto", "lmstudio"):
        if not is_local(a.url) and not a.allow_remote:
            print(f"Abgelehnt: {a.url} ist nicht lokal. Nur localhost erlaubt (sonst --allow-remote).", file=sys.stderr)
            return 2
        try:
            model = pick_model(a.url.rstrip("/"), a.model)
            mode = "lmstudio"
            print(f"KI lokal: LM Studio, Modell «{model}»")
        except (urllib.error.URLError, OSError, RuntimeError, ValueError) as e:
            if mode == "lmstudio":
                print(f"LM Studio nicht nutzbar: {e}", file=sys.stderr)
                return 3
            print(f"LM Studio nicht nutzbar ({e}) → Regeln (mock).")
            mode = "mock"
    else:
        print("Regeln (mock), ohne KI.")

    rows = [COLUMNS]
    stats = {"berichte": 0, "personen": 0, "fehler": 0}
    agree = {c: [0, 0] for c in COLUMNS[2:7]}
    for i, path in enumerate(files, 1):
        with open(path, encoding="utf-8") as f:
            text = f.read()
        dossier = re.sub(r"^Situationsanalyse_|\.(txt|md)$", "", os.path.basename(path))
        stats["berichte"] += 1
        for p in split_report(text):
            rules = extract_rules(p["section"])
            values, method = rules, "Regeln"
            if mode == "lmstudio":
                try:
                    values, method = extract_llm(pseudonymise(p["section"], p["names"]), a.url.rstrip("/"), model), "KI lokal"
                except Exception as e:  # einzelne Fehler: Regeln verwenden, weitermachen
                    stats["fehler"] += 1
                    print(f"  Fehler bei Bericht {i} ({type(e).__name__}) → Regeln", file=sys.stderr)
                if a.compare and method == "KI lokal":
                    for c in agree:
                        agree[c][1] += 1
                        agree[c][0] += values[c] == rules[c]
            rows.append([p["zemis"], dossier] + [values[c] for c in COLUMNS[2:7]] + [method])
            stats["personen"] += 1
        print(f"\r  {i}/{len(files)} Berichte", end="", flush=True)
    print()
    write_xlsx(a.out, rows)
    print(f"{stats['personen']} Personen aus {stats['berichte']} Berichten → {a.out}" + (f" ({stats['fehler']} Fehler, dort Regeln)" if stats["fehler"] else ""))
    if a.compare and mode == "lmstudio":
        print("Übereinstimmung KI ↔ Regeln:")
        for c, (ok, n) in agree.items():
            print(f"  {c}: {ok}/{n}" + (f" = {round(100 * ok / n)} %" if n else ""))
    print("Datei im Cockpit unter «Daten» hineinziehen; die Faktoren erscheinen im Reiter «Muster».")
    return 0


if __name__ == "__main__":
    sys.exit(main())
