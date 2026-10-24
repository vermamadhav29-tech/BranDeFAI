process.argv[2]="home";
const g=require("./gen.js");
const fs=require("fs");
const {kids,attr,ser,repl,pageDiv,rk,navNodes,root,main,outDir}=g;
const names={};
// drop badge
for(const n of rk) if(/1oyx3c6-container/.test(attr(n,"class")||"")) repl.set(n,"");
// nav
repl.set(navNodes[0],"Nav"); repl.set(navNodes[1],"");
const sectionNames=["Hero","Clients","Features","Steps","Integrations","FeaturesTwo","Testimonial","Pricing","AppSection","Cta"];
const pk=kids(pageDiv);
let si=0;
const defs=[["Nav",navNodes]];
for(const n of pk){
  const c=attr(n,"class")||"";
  if(n.tagName==="section"){ const nm=sectionNames[si++]; repl.set(n,nm); defs.push([nm,[n]]); }
  else if(/1rfv4am-container/.test(c)){ repl.set(n,"Cta"); defs.push(["Cta",[n]]); si++; }
  else if(/aky98i-container/.test(c)){ repl.set(n,""); }
}
for(const n of rk) if(/193pntc-container/.test(attr(n,"class")||"")){ repl.set(n,"Footer"); defs.push(["Footer",[n]]); }
// serialize page first (with replacements)
let pageJsx=ser(main);
// emit components
const saved=new Map(repl);
const imports=[];
for(const [name,nodes] of defs){
  for(const n of nodes) repl.delete(n);
  const jsx=nodes.map(ser).join("\n");
  for(const n of nodes) if(saved.has(n)) repl.set(n,saved.get(n));
  fs.writeFileSync(outDir+name+".tsx",`/* eslint-disable @next/next/no-img-element */\nimport type { CSSProperties } from "react";\n\nexport default function ${name}() {\n  return (\n    <>\n${jsx}\n    </>\n  );\n}\n`);
  imports.push(name);
}
const uniq=[...new Set(imports)];
const parse5=require("parse5");
const svgFrag=parse5.parseFragment(g.L[152]+g.L[153]);
const defsJsx=svgFrag.childNodes.filter(n=>n.tagName==="svg").map(ser).join("");
fs.writeFileSync(outDir+"HomePage.tsx",`import type { CSSProperties } from "react";
import DraftrEffects from "../DraftrEffects";
${uniq.map(n=>`import ${n} from "./${n}";`).join("\n")}\n\nexport default function HomePage() {\n  return (\n    <>\n${pageJsx}\n      <div aria-hidden style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>${defsJsx}</div>\n      <DraftrEffects />\n    </>\n  );\n}\n`);
// css
fs.writeFileSync(g.SP+"home.css.raw",g.css.join("\n"));
fs.writeFileSync(g.SP+"home.assets.json",JSON.stringify([...g.assets]));
console.log("components",uniq.join(","),"assets",g.assets.size,"css bytes",g.css.join("").length);
// ---- brand swap: replace template logo images with the BrandefAI wordmark ----
for(const name of ["Nav","Footer"]){
  const f=outDir+name+".tsx";let t=fs.readFileSync(f,"utf8");
  const tone=name==="Footer"?"light":"dark";
  t=t.replace(/<div style=\{\{"position":"absolute"[^>]*?\} as CSSProperties\} data-framer-background-image-wrapper="true"><img decoding="async" width="\d+" height="40" src="[^"]*" alt="Logo"[^>]*?\/><\/div>/g,`<Brand tone="${tone}"${name==="Footer"?" size={20}":""} />`);
  if(!/import Brand/.test(t)) t=t.replace('import type { CSSProperties } from "react";','import type { CSSProperties } from "react";\nimport Brand from "../Brand";');
  fs.writeFileSync(f,t);
}
require("./finish.js")(outDir);
