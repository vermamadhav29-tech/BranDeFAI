const fs=require("fs"),path=require("path"),crypto=require("crypto");
const parse5=require("parse5");
const SP="C:/Users/akash/AppData/Local/Temp/claude/c--Users-akash-OneDrive-Documents-GitHub-BranDeFAI/3f4a52ac-960c-4da6-b3fb-5eef188b668a/scratchpad/";
const FE="C:/Users/akash/OneDrive/Documents/GitHub/BranDeFAI/frontend/";
const page=process.argv[2];            // home|blog|contact
const L=fs.readFileSync(SP+page+".html","utf8").split("\n");
const bodyHtml=L[142];
const frag=parse5.parseFragment(bodyHtml);
const assets=new Map(); // url -> localname
function localize(u){
  if(!/^https?:\/\/(framerusercontent\.com|framer\.com)/.test(u)) return u;
  const clean=u.split("?")[0].replace(/&amp;/g,"&");
  const ext=(clean.match(/\.(svg|png|jpg|jpeg|webp|avif|gif|woff2|mp4)$/i)||[""])[0];
  const name=crypto.createHash("md5").update(clean).digest("hex").slice(0,10)+(ext||".bin");
  assets.set(clean,name); return "/draftr/img/"+name;
}
const css=[];const repl=new Map();
const ATTR={class:"className","for":"htmlFor",srcset:"srcSet",tabindex:"tabIndex",viewbox:"viewBox",readonly:"readOnly",maxlength:"maxLength",colspan:"colSpan",autocomplete:"autoComplete",crossorigin:"crossOrigin",fetchpriority:"fetchPriority",referrerpolicy:"referrerPolicy",allowfullscreen:"allowFullScreen",playsinline:"playsInline",autoplay:"autoPlay",preserveaspectratio:"preserveAspectRatio"};
function camel(s){return s.replace(/[-:]([a-z])/g,(_,c)=>c.toUpperCase());}
function styleObj(s){
  const o={};
  for(const d of s.split(/;(?![^(]*\))/)){ if(!d.trim())continue; const i=d.indexOf(":"); if(i<0)continue;
    let k=d.slice(0,i).trim(),v=d.slice(i+1).trim();
    if(k.startsWith("--")) o[k]=v; else { k=k.replace(/^-ms-/,"ms-"); o[camel(k.replace(/^-webkit-/,"Webkit-"))]=v; }
  } return JSON.stringify(o);
}
const VOID=new Set(["img","br","hr","input","meta","link","source","path_"]);
const BOOL=new Set(["disabled","checked","required","autoplay","loop","muted","playsinline","controls","selected","hidden","readonly"]);
function attrs(n,tag){
  let out=[];
  for(const a of n.attrs){
    let k=a.name,v=a.value;
    if(k==="data-framer-hydrate-v2"||k==="data-framer-ssr-released"||k==="data-framer-appear-id-bak") continue;
    if(k==="style"){ out.push(`style={${styleObj(v)} as CSSProperties}`); continue; }
    if((k==="src"||k==="href"&&/\.(svg|png|jpg|webp)/.test(v))) v=localize(v);
    if(k==="srcset"){ continue; }
    if(k==="sizes") continue;
    if(k==="loading"||k==="decoding"&&false) {}
    let name=((tag==="input"||tag==="textarea")&&k==="value")?"defaultValue":ATTR[k]||(k.startsWith("data-")||k.startsWith("aria-")?k:camel(k));
    if(tag==="img"&&k==="src"){}
    if(BOOL.has(k)&&v===""){ out.push(name); continue; }
    if(/^on/.test(k)) continue;
    v=v.replace(/\s*\/\*[\s\S]*?\*\/\s*/g,"");
    out.push(name==="tabIndex"?`tabIndex={${parseInt(v)}}`:(/["\\\n]/.test(v)?`${name}={${JSON.stringify(v)}}`:`${name}="${v}"`));
  }
  return out.length?" "+out.join(" "):"";
}
function esc(t){ return /[{}<>\n\r'"]|^\s|\s$/.test(t)||t.trim()===""? `{${JSON.stringify(t)}}` : t; }
function ser(n){
  if(typeof repl!=="undefined"&&repl.has(n)) return repl.get(n)?`<${repl.get(n)} />`:"";
  if(n.nodeName==="#comment") return "";
  if(n.nodeName==="#text") { if(!n.value) return ""; return esc(n.value); }
  const tag=n.tagName||n.nodeName;
  if(tag==="style"){ css.push(n.childNodes.map(c=>c.value).join("")); return ""; }
  if(tag==="script") return "";
  if(n.attrs && n.attrs.some(a=>a.name==="id"&&a.value==="__framer-badge-container")) return "";
  const kids=(n.childNodes||[]).concat(n.content?n.content.childNodes:[]).map(ser).join("");
  const a=attrs(n,tag);
  if(VOID.has(tag)) return `<${tag}${a}${tag==="img"?"":""} />`;
  if(!kids) return `<${tag}${a}></${tag}>`;
  return `<${tag}${a}>${kids}</${tag}>`;
}

function kids(n){return (n.childNodes||[]).filter(c=>c.nodeName!=="#comment"&&!(c.nodeName==="#text"&&!c.value.trim()));}
const attr=(n,k)=>((n.attrs||[]).find(a=>a.name===k)||{}).value;
function walk(n,f){f(n);(n.childNodes||[]).forEach(c=>walk(c,f));}
// css pre-pass: body styles + head styles
const headRaw=L[132];
for(const m of headRaw.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) css.push(m[1]);
walk(frag,n=>{ if(n.tagName==="style") css.push(n.childNodes.map(c=>c.value).join("")); });
const main=kids(frag).find(n=>attr(n,"id")==="main");
const root=kids(main).find(n=>n.tagName==="div");
const pageDiv=kids(root).find(n=>/framer-iHjSt|framer-Gel6I|data-framer-root/.test((attr(n,"class")||"")+(attr(n,"data-framer-root")!==undefined?"data-framer-root":"")));
const outDir=FE+"src/components/draftr/"+page+"/";
fs.mkdirSync(outDir,{recursive:true});
const comps=[];
function define(node,name){ repl.set(node,name); comps.push([name,node]); }
const rk=kids(root);
const navNodes=rk.filter(n=>/ssr-variant/.test(attr(n,"class")||"")&&kids(n).some(k=>/11hb6jp/.test(attr(k,"class")||"")));
module.exports={frag,main,root,pageDiv,kids,attr,ser,css,assets,outDir,comps,repl,define,rk,navNodes,page,SP,FE,L};
