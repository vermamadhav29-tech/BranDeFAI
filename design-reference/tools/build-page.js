const page=process.argv[2];
process.argv[2]=page;
const g=require("./gen.js");
const fs=require("fs");
const {kids,attr,ser,repl,pageDiv,rk,navNodes,main,outDir}=g;
const NAMES={blog:{"Hero Section":"BlogHero","Blog Section":"BlogList"},contact:{"Contact Section":"ContactSection","Faq Section":"FaqSection"}}[page];
const Page=page[0].toUpperCase()+page.slice(1)+"Page";
for(const n of rk) if(/1oyx3c6-container/.test(attr(n,"class")||"")) repl.set(n,"");
repl.set(navNodes[0],"Nav"); repl.set(navNodes[1],"");
const defs=[];
for(const n of kids(pageDiv)){
  const nm=NAMES[attr(n,"data-framer-name")];
  if(n.tagName==="section"&&nm){repl.set(n,nm);defs.push([nm,[n]]);}
  else console.log("unmapped page child:",n.tagName,attr(n,"class"),attr(n,"data-framer-name"));
}
for(const n of rk) if(/193pntc-container/.test(attr(n,"class")||"")) repl.set(n,"Footer");
let pageJsx=ser(main);
const saved=new Map(repl);
for(const [name,nodes] of defs){
  for(const n of nodes) repl.delete(n);
  const jsx=nodes.map(ser).join("\n");
  for(const n of nodes) if(saved.has(n)) repl.set(n,saved.get(n));
  fs.writeFileSync(outDir+name+".tsx",`/* eslint-disable @next/next/no-img-element */\nimport type { CSSProperties } from "react";\n\nexport default function ${name}() {\n  return (\n    <>\n${jsx}\n    </>\n  );\n}\n`);
}
const imps=defs.map(([n])=>`import ${n} from "./${n}";`).join("\n");
fs.writeFileSync(outDir+Page+".tsx",`import type { CSSProperties } from "react";\nimport Nav from "../home/Nav";\nimport Footer from "../home/Footer";\nimport DraftrEffects from "../DraftrEffects";\n${imps}\n\nexport default function ${Page}() {\n  return (\n    <>\n${pageJsx}\n      <DraftrEffects />\n    </>\n  );\n}\n`);
fs.writeFileSync(g.SP+page+".css.raw",g.css.join("\n"));
fs.writeFileSync(g.SP+page+".assets.json",JSON.stringify([...g.assets]));
console.log(page,"ok",defs.map(d=>d[0]).join(","),"assets",g.assets.size);

if(page==="contact"){
  const f=outDir+"ContactSection.tsx";let t=fs.readFileSync(f,"utf8");
  const map={"Full name":"name","Email address":"email","Company name":"company","Phone number":"phone"};
  for(const [ph,nm] of Object.entries(map)) t=t.split('name="Name" placeholder="'+ph+'"').join('name="'+nm+'" placeholder="'+ph+'"');
  t=t.replace(/<textarea([^>]*?)name="Name"/g,'<textarea$1name="message"');
  t=t.split("support@draftr.com").join("support@brandefai.com").split("sales@draftr.com").join("sales@brandefai.com");
  fs.writeFileSync(f,t);
}
require("./finish.js").pages(outDir);
