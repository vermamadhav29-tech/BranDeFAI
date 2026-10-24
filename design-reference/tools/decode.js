const fs=require("fs");
const dir="C:/Users/akash/OneDrive/Documents/GitHub/BranDeFAI/frontend/public/";
for (const [f,o] of [["brandefai - home.html","home"],["brandefai - blog.html","blog"],["brandefai -  contact.html","contact"]]) {
  let s=fs.readFileSync(dir+f,"utf8");
  const rows=[...s.matchAll(/<td class="line-content">([\s\S]*?)<\/td><\/tr>/g)].map(m=>m[1].replace(/<[^>]+>/g,"").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,"&"));
  fs.writeFileSync(o+".html",rows.join("\n"));
  console.log(o,rows.length);
}
