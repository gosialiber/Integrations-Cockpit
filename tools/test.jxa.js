/* Regel-Tests im Terminal: osascript -l JavaScript tools/test.jxa.js */
ObjC.import("Foundation");
function run() {
  const fm = $.NSFileManager.defaultManager, cwd = fm.currentDirectoryPath.js;
  const read = (p) => $.NSString.stringWithContentsOfFileEncodingError(`${cwd}/${p}`, $.NSUTF8StringEncoding, null).js;
  const g = this; g.window = g;
  ["js/rules.js", "js/cockpit.js", "js/patterns.js", "js/tests.js"].forEach((f) => (0, eval)(read(f)));
  const r = g.Cockpit.runTests();
  return r.results.map((x) => `${x.ok ? "✓" : "✗"} ${x.name}${x.ok ? "" : " — " + x.msg}`).join("\n") + `\n${r.passed}/${r.total} bestanden`;
}
