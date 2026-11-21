/* Testdaten im Terminal erzeugen (macOS, ohne Installation):
 *
 *   osascript -l JavaScript tools/generate.jxa.js            → schreibt nach testdata/
 *   osascript -l JavaScript tools/generate.jxa.js 42         → anderer Seed
 *
 * Muss aus dem Projektordner aufgerufen werden.
 */
ObjC.import("Foundation");

function run(argv) {
  const fm = $.NSFileManager.defaultManager;
  const cwd = fm.currentDirectoryPath.js;
  const read = (p) => $.NSString.stringWithContentsOfFileEncodingError(`${cwd}/${p}`, $.NSUTF8StringEncoding, null).js;
  const mkdir = (p) => fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(`${cwd}/${p}`, true, $(), null);
  const writeText = (p, s) => $(s).writeToFileAtomicallyEncodingError(`${cwd}/${p}`, true, $.NSUTF8StringEncoding, null);
  const writeB64 = (p, b64) => $.NSData.alloc.initWithBase64EncodedStringOptions(b64, 0).writeToFileAtomically(`${cwd}/${p}`, true);

  // Browser-Skripte im JXA-Kontext laden
  const g = this;
  g.window = g;
  [ "lib/xlsx.full.min.js", "js/schema.js", "tools/generator.js" ].forEach((f) => (0, eval)(read(f)));

  const seed = argv[0] ? Number(argv[0]) : undefined;
  const out = g.Cockpit.generator.generate({ seed });
  mkdir("testdata/situationsanalyse");
  const lines = [];
  for (const id in out.tables) {
    const wb = g.Cockpit.generator.toWorkbook(id, out.tables[id]);
    const name = g.Cockpit.generator.fileName(id);
    writeB64(`testdata/${name}`, g.XLSX.write(wb, { type: "base64", bookType: "xlsx" }));
    lines.push(`${name}: ${out.tables[id].length} Zeilen`);
  }
  for (const t of out.texts) writeText(`testdata/situationsanalyse/${t.name}`, t.text);
  lines.push(`situationsanalyse/: ${out.texts.length} Texte`);
  return lines.join("\n");
}
