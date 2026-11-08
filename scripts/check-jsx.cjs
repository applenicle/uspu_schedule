/** Check JSX when TypeScript is available. Otherwise validate backend and MJS syntax. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..', 'src');
function files(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : /\.(?:jsx?|mjs)$/.test(entry.name) ? [full] : [];
  });
}
const sources = files(root);
let ts;
try { ts = require('typescript'); }
catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
let errors = 0;
if (ts) {
  for (const file of sources) {
    const source = fs.readFileSync(file, 'utf8');
    const kind = file.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.JS;
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
    for (const diagnostic of parsed.parseDiagnostics) {
      const at = parsed.getLineAndCharacterOfPosition(diagnostic.start || 0);
      console.error(`${file}:${at.line+1}:${at.character+1}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
      errors++;
    }
  }
  console.log(`JSX_PARSE_FILES=${sources.length} ERRORS=${errors}`);
} else {
  // Node cannot parse JSX. Validate modules that are known not to contain JSX,
  // then let the Next.js build on Vercel perform the full JSX compilation.
  const checkable = sources.filter(file => file.endsWith('.mjs') || file.includes(`${path.sep}api${path.sep}`));
  for (const file of checkable) {
    const result = spawnSync(process.execPath, ['--check', file], {encoding: 'utf8'});
    if (result.status !== 0) {
      process.stderr.write(result.stderr || `Syntax check failed: ${file}\n`);
      errors++;
    }
  }
  console.warn(`WARN: TypeScript не установлен: JSX-проверка пропущена. Проверено модулей=${checkable.length}; итоговую сборку Next.js должен проверить Vercel.`);
}
process.exitCode = Number(errors > 0);
