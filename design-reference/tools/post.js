const fs=require("fs"),path=require("path"),crypto=require("crypto"),https=require("https");
const FE="C:/Users/akash/OneDrive/Documents/GitHub/BranDeFAI/frontend/";
const pages=process.argv.slice(2);
function dl(url,dest){
  return new Promise((res,rej)=>{
    if(fs.existsSync(dest)&&fs.statSync(dest).size>0) return res("cached");
    https.get(url,{headers:{"User-Agent":"Mozilla/5.0"}},r=>{
      if(r.statusCode>=300&&r.statusCode<400&&r.headers.location) return dl(new URL(r.headers.location,url).href,dest).then(res,rej);
      if(r.statusCode!==200){r.resume();return rej(new Error(r.statusCode+" "+url));}
      const f=fs.createWriteStream(dest);r.pipe(f);f.on("finish",()=>f.close(()=>res("ok")));
    }).on("error",rej);
  });
}
async function pool(items,n,fn){let i=0;const w=Array.from({length:n},async()=>{while(i<items.length){const it=items[i++];try{await fn(it)}catch(e){console.log("FAIL",e.message)}}});await Promise.all(w);}
function localName(clean){
  const ext=(clean.match(/\.(svg|png|jpg|jpeg|webp|avif|gif|woff2|mp4)$/i)||[""])[0];
  return crypto.createHash("md5").update(clean).digest("hex").slice(0,10)+(ext||".bin");
}
(async()=>{
  fs.mkdirSync(FE+"public/draftr/img",{recursive:true});fs.mkdirSync(FE+"public/draftr/fonts",{recursive:true});
  const imgs=new Map();
  // css
  const blocks=new Set();let cssOut=[];
  for(const p of pages){
    const raw=fs.readFileSync(p+".css.raw","utf8");
    // split raw into top-level chunks by newline joins already per <style>
    for(const chunk of raw.split("\n")) { if(chunk.trim()&&!blocks.has(chunk)){blocks.add(chunk);cssOut.push(chunk);} }
    for(const [u] of JSON.parse(fs.readFileSync(p+".assets.json","utf8"))) imgs.set(u,localName(u));
  }
  let css=cssOut.join("\n");
  css=css.replace(/url\((["']?)(https?:\/\/framerusercontent\.com[^)"']*)\1\)/g,(m,q,u)=>{const clean=u.split("?")[0];const n=localName(clean);imgs.set(clean,n);return `url("/draftr/img/${n}")`;});
  fs.mkdirSync(FE+"src/styles",{recursive:true});
  fs.writeFileSync(FE+"src/styles/draftr.css",css);
  // fonts
  const allHtml=fs.readFileSync(pages[0]+".html","utf8");
  const ff=[...allHtml.matchAll(/@font-face\s*\{[^}]*\}/g)].map(m=>m[0]);
  const fonts=new Map();let fcss=[];
  for(const f of ff){
    if(/font-style:\s*italic/.test(f)) continue;
    if(/Placeholder/.test(f)){fcss.push(f);continue;}
    f.replace(/url\("([^"]+)"\)/,(m,u)=>{const n=localName(u.split("?")[0]);fonts.set(u,n);fcss.push(f.replace(u,"/draftr/fonts/"+n));return m;});
  }
  fs.writeFileSync(FE+"src/styles/draftr-fonts.css",fcss.join("\n"));
  console.log("fonts",fonts.size,"imgs",imgs.size);
  await pool([...fonts],8,async([u,n])=>{await dl(u,FE+"public/draftr/fonts/"+n);});
  await pool([...imgs],8,async([u,n])=>{await dl(u,FE+"public/draftr/img/"+n);});
  console.log("done");
})();
