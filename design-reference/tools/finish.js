const fs=require("fs");
function matchClose(s,start){ // s[start] begins "<div"; return index after matching </div>
  let d=0;const re=/<(\/?)div\b/g;re.lastIndex=start;let m;
  while((m=re.exec(s))){ if(m[1]==="/"){d--;if(d===0)return s.indexOf(">",m.index)+1;} else d++; }
  throw new Error("unbalanced");
}
function removeLink(s,href){
  const key=`href="${href}"`;let n=0,i;
  while((i=s.indexOf(key))>=0){
    const rt=s.lastIndexOf("<div ",i);
    let start=rt;
    const before=s.slice(Math.max(0,rt-60),rt);
    if(/data-framer-name="Link Item">$/.test(before)) start=s.lastIndexOf("<div ",rt-1);
    const end=matchClose(s,start);
    s=s.slice(0,start)+s.slice(end);n++;
  }
  return [s,n];
}
function pages(outDir){for(const file of fs.readdirSync(outDir)){if(!file.endsWith('.tsx'))continue;let t=fs.readFileSync(outDir+file,'utf8');const o=t;t=t.split('href="./blog/').join('href="/blog/').split('href="./contact"').join('href="/login"').split('href="./"').join('href="/"');if(t!==o)fs.writeFileSync(outDir+file,t);}}
module.exports=function finish(outDir){
  // ---- Footer
  let f=fs.readFileSync(outDir+"Footer.tsx","utf8");
  for(const h of ["./changelog","./waitlist","./404","./about","./power-ups"]) [f]=removeLink(f,h);
  f=f.replace(/\{"Designed by\s"\}<a [^>]*webestica[^>]*>[\s\S]*?<\/a>\{",\sPowered by\s"\}<a [^>]*framer\.com[^>]*>[\s\S]*?<\/a>/g,'{"© 2026 BrandefAI. All rights reserved."}');
  f=f.replace(/href="\.\/#cta">Download</g,'href="/login">Get started<');
  const MAP={'href="./"':'href="/"','href="./#feature"':'href="/#feature"','href="./#pricing"':'href="/#pricing"','href="./#cta"':'href="/#cta"','href="./blog"':'href="/blog"','href="./contact"':'href="/contact"','href="./legal-pages/privacy-policy"':'href="/privacy"'};
  for(const [a,b] of Object.entries(MAP)) f=f.split(a).join(b);
  fs.writeFileSync(outDir+"Footer.tsx",f);
  // ---- Nav: Features / Pricing / Blog / Contact (changelog removed)
  let n=fs.readFileSync(outDir+"Nav.tsx","utf8");
  [n]=removeLink(n,"./changelog");
  n=n.replace('href="./about">About<','href="/#feature">Features<').replace('href="./blog">Blog<','href="/#pricing">Pricing<').replace('href="./contact">Contact<','href="/blog">Blog<').replace('href="./power-ups">Power-Ups<','href="/contact">Contact<');
  n=n.split('href="./"').join('href="/"').replace('href="https://www.framer.com/"','href="/login"');
  fs.writeFileSync(outDir+"Nav.tsx",n);
  // ---- Hero button + other in-page links
  for(const file of fs.readdirSync(outDir)){
    if(!file.endsWith(".tsx")) continue;
    let t=fs.readFileSync(outDir+file,"utf8");const o=t;
    t=t.split('href="./contact"').join('href="/login"').split('href="./blog"').join('href="/blog"').split('href="https://www.framer.com/plugins/"').join('href="/#feature"').split('href="https://www.framer.com/"').join('href="/login"');
    if(t!==o) fs.writeFileSync(outDir+file,t);
  }
};

module.exports.pages=pages;
