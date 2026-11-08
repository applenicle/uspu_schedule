/** Parse every JSX/JS/MJS file using TypeScript's parser. No npm installation needed. */
const ts = require('/usr/local/slides_js/node_modules/typescript');
const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..','src');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(path.join(dir,x.name)):/\.(jsx?|mjs)$/.test(x.name)?[path.join(dir,x.name)]:[])}
let errors=0;
for(const file of files(root)){
 const source=fs.readFileSync(file,'utf8');
 const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('.jsx')?ts.ScriptKind.JSX:ts.ScriptKind.JS);
 for(const diag of sf.parseDiagnostics){
  const pos=sf.getLineAndCharacterOfPosition(diag.start||0);
  console.error(`${file}:${pos.line+1}:${pos.character+1}: ${ts.flattenDiagnosticMessageText(diag.messageText,' ')}`);errors++;
 }
}
console.log(`JSX_PARSE_FILES=${files(root).length} ERRORS=${errors}`);
process.exitCode=Number(errors>0);
