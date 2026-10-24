const fs=require("fs");
for (const n of ["home","blog","contact"]) {
  const L=fs.readFileSync(n+".html","utf8").split("\n");
  const head=L[132], body=L[142];
  fs.writeFileSync(n+".head.txt", head.replace(/<\/style>/g,"</style>\n").replace(/\}/g,"}\n"));
  fs.writeFileSync(n+".body.txt", body.replace(/></g,">\n<"));
  // text only
  const txt=body.replace(/<style[\s\S]*?<\/style>/g,"").replace(/<svg[\s\S]*?<\/svg>/g,"[svg]").replace(/<(p|h[1-6]|a|div|span|li)\b[^>]*>/g,"\n").replace(/<[^>]+>/g,"").replace(/\n\s*\n+/g,"\n");
  fs.writeFileSync(n+".text.txt",txt);
  console.log(n, head.length, body.length, txt.length);
}
