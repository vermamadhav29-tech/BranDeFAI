const fs=require("fs");
const n=process.argv[2];
let b=fs.readFileSync(n+".body.txt","utf8").replace(/<svg[\s\S]*?<\/svg>/g,"<svg/>");
const toks=b.split("\n");
let depth=0,out=[];
const VOID=new Set(["img","br","hr","input","meta","link","source","svg"]);
for(const t of toks){
  let m;
  if((m=t.match(/^<\/(\w+)/))){depth--;continue;}
  if((m=t.match(/^<(\w+)([^>]*?)(\/?)>(.*)$/s))){
    const tag=m[1],attrs=m[2];
    const name=(attrs.match(/data-framer-name="([^"]*)"/)||[])[1];
    const cls=(attrs.match(/class="([^"]*)"/)||[])[1];
    const href=(attrs.match(/href="([^"]*)"/)||[])[1];
    const src=(attrs.match(/ src="([^"]*)"/)||[])[1];
    const comp=(attrs.match(/data-framer-component-type="([^"]*)"/)||[])[1];
    const txt=m[4].trim();
    if(tag!=="style"&&tag!=="script"){
      out.push("  ".repeat(Math.max(depth,0))+`<${tag}${name?` [${name}]`:""}${comp?` {${comp}}`:""} .${(cls||"").replace(/framer-text|framer-/g,"").trim().split(/\s+/).slice(0,3).join(".")}${href?` href=${href}`:""}${src?` src=${src.slice(0,90)}`:""}${txt?` "${txt.slice(0,80)}"`:""}`);
    }
    if(!m[3]&&!VOID.has(tag)&&!m[4].includes("</"+tag)) depth++;
  } else if(t.trim()) out.push("  ".repeat(Math.max(depth,0))+"T:"+t.trim().slice(0,100));
}
fs.writeFileSync(n+".tree.txt",out.join("\n"));
console.log(out.length);
