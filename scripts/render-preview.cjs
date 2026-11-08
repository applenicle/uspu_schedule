/**
 * Offline JSX preview renderer for the ACTUAL application components.
 * It does not execute React effects or Next.js. Only for visual QA when npm
 * is unavailable. Screenshots created from this output are NOT Next.js builds.
 */
const ts = require('/usr/local/slides_js/node_modules/typescript');
const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
let frame=null;
const React={
  Fragment: Symbol('Fragment'),
  createElement(type,props,...children){return {type,props:{...(props||{}),children:children.length===1?children[0]:children}};},
  useState(initial){const n=frame.index++; const value=Object.hasOwn(frame.overrides,n)?frame.overrides[n]:typeof initial==='function'?initial():initial;return [value,()=>{}];},
  useEffect(){},useCallback(fn){return fn;},useMemo(fn){return fn();},useRef(value){return {current:value};},
};
const iconPaths={
  'BookOpen':'<path d="M12 7v14"/><path d="M3 18V5a2 2 0 0 1 2-2h3a4 4 0 0 1 4 4v14a4 4 0 0 0-4-4H5a2 2 0 0 0-2 1Z"/><path d="M21 18V5a2 2 0 0 0-2-2h-3a4 4 0 0 0-4 4v14a4 4 0 0 1 4-4h3a2 2 0 0 1 2 1Z"/>',
  'Search':'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  'Bookmark':'<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  'Star':'<path d="m12 2 3.2 6.5 7.2 1-5.2 5.1 1.2 7.1L12 18.3l-6.4 3.4 1.2-7.1-5.2-5.1 7.2-1z"/>',
  'Moon':'<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>',
  'Sun':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.4 1.4m11.34 11.34 1.4 1.4M2 12h2m16 0h2M4.93 19.07l1.4-1.4M17.67 6.33l1.4-1.4"/>',
  'CalendarDays':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  'ChevronLeft':'<path d="m15 18-6-6 6-6"/>',
  'ChevronRight':'<path d="m9 18 6-6-6-6"/>',
  'ArrowRight':'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  'X':'<path d="M18 6 6 18M6 6l12 12"/>',
  'MapPin':'<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>',
  'UserRound':'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  'Users':'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  'FlaskConical':'<path d="M9 3h6m-5 0v7l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M8 15h8"/>',
  'GraduationCap':'<path d="m2 10 10-5 10 5-10 5-10-5zm4 2v5c4 3 8 3 12 0v-5m4-2v7"/>',
  'ClipboardList':'<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2h6v2m-6 8h6m-6 4h6"/>',
  'Microscope':'<path d="m7 4 3-2 5 8-3 2-5-8zm5 7-4 3m-2 2a7 7 0 0 0 13 2M4 22h16"/>',
  'RefreshCw':'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 9a7 7 0 0 1 12-3l3 3M19 15a7 7 0 0 1-12 3l-3-3"/>',
  'ArrowUpRight':'<path d="M7 17 17 7M7 7h10v10"/>',
  'AlertCircle':'<circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>',
};
const iconProxy=new Proxy({}, {get(_,name){if(typeof name!=='string')return;return function Icon({size=24,fill='none',...props}={}){
 const node=iconPaths[name]||iconPaths.AlertCircle;
 return {type:'svgraw',props:{size,fill,attrs:props,node}};
};}});
const cache=new Map();
function resolveFile(spec,from){
 if(spec.startsWith('@/'))return resolveFile(path.join(root,'src',spec.slice(2)),from);
 const base=spec.startsWith('.')?path.resolve(path.dirname(from),spec):spec;
 for(const candidate of [base,base+'.js',base+'.jsx',base+'.mjs',base+'.cjs'])if(fs.existsSync(candidate)&&fs.statSync(candidate).isFile())return candidate;
 throw Error(`Cannot resolve ${spec} from ${from}`);
}
function load(spec,from=path.join(root,'src/app/page.jsx')){
 if(spec==='react')return React;
 if(spec==='lucide-react')return iconProxy;
 if(spec.endsWith('.css'))return {};
 const file=resolveFile(spec,from);
 if(file.endsWith('.mjs'))return require(file);
 if(cache.has(file))return cache.get(file).exports;
 const mod={exports:{}};cache.set(file,mod);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,jsxFactory:'React.createElement'}}).outputText;
 const localRequire=sub=>load(sub,file);
 new Function('require','module','exports','React',code)(localRequire,mod,mod.exports,React);
 return mod.exports;
}
const esc=str=>String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const attrs=p=>Object.entries(p||{}).filter(([name,value])=>!['children','key','ref'].includes(name)&&!name.startsWith('on')&&value!==null&&value!==undefined&&value!==false).map(([name,value])=>{
 name=name==='className'?'class':name==='htmlFor'?'for':name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase());
 if(value===true)return ` ${name}`;
 if(typeof value==='object')return '';
 return ` ${name}="${esc(value)}"`;
}).join('');
const voids=new Set(['input','img','br','hr','meta','link']);
function render(node, overrides={}){
 if(node===null||node===undefined||typeof node==='boolean')return '';
 if(Array.isArray(node))return node.map(x=>render(x,overrides)).join('');
 if(typeof node==='string'||typeof node==='number')return esc(node);
 if(node.type==='svgraw')return `<svg width="${node.props.size}" height="${node.props.size}" viewBox="0 0 24 24" fill="${esc(node.props.fill)}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${attrs(node.props.attrs)}>${node.props.node}</svg>`;
 if(typeof node.type==='function'){
  const previous=frame;
  frame={index:0,overrides:overrides[node.type.name]||{}};
  let out;
  try{out=node.type(node.props);}finally{frame=previous;}
  return render(out,overrides);
 }
 if(typeof node.type==='symbol')return render(node.props.children,overrides);
 const tag=node.type;
 if(typeof tag!=='string')return '';
 const attr=attrs(node.props);
 return voids.has(tag)?`<${tag}${attr}/>`:`<${tag}${attr}>${render(node.props.children,overrides)}</${tag}>`;
}
const {SchedulePage}=load('@/fsd/pages/schedule/ui/schedule-page');
const {demoCatalog,demoLessons}=load('@/shared/lib/demo-data.mjs');
const demoToday='2026-11-08';
const group=demoCatalog.find(x=>x.kind==='group'&&x.id==='ДГ-304');
const groupLessons=demoLessons(demoToday,'group','ДГ-304');
const teacherRecord=demoCatalog.find(x=>x.kind==='teacher'&&x.id==='T2');
const teacherLessons=demoLessons(demoToday,'teacher','T2');
const stressLessons=groupLessons.map(item=>({...item, teacher:item.subgroup==='1'?'Александрова-Кузнецова Екатерина Константиновна':item.subgroup==='2'?'Станиславская-Владимирова Анастасия Александровна':item.teacher}));
const previews=[
 {name:'light-mobile',theme:'light',over:{0:true,1:'light',2:'group',3:'group',4:group,5:demoToday,6:'2026-11-09',7:groupLessons}},
 {name:'dark-mobile',theme:'dark',over:{0:true,1:'dark',2:'group',3:'group',4:group,5:demoToday,6:'2026-11-09',7:groupLessons}},
 {name:'light-teacher',theme:'light',over:{0:true,1:'light',2:'teacher',3:'teacher',4:teacherRecord,5:demoToday,6:'2026-11-09',7:teacherLessons}},
 {name:'light-subgroups',theme:'light',over:{0:true,1:'light',2:'group',3:'group',4:group,5:demoToday,6:'2026-11-09',7:groupLessons,13:'Смирнова Елена Викторовна'}},
 {name:'long-names',theme:'light',over:{0:true,1:'light',2:'group',3:'group',4:group,5:demoToday,6:'2026-11-09',7:stressLessons}}
];
for(const item of previews){
 const body=render(React.createElement(SchedulePage),{SchedulePage:item.over});
 const html=`<!DOCTYPE html><html lang="ru" data-theme="${item.theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>USPU source JSX visual QA</title><link href="../src/app/globals.css" rel="stylesheet"></head><body>${body}</body></html>`;
 const dir=path.join(root,'previews');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,item.name+'.html'),html);
 console.log(item.name,html.length);
}
