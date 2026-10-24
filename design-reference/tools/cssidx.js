// builds rules index: [{media, sel, body}]
const fs=require("fs");
function parse(css){
  const rules=[];let i=0;
  function block(media){
    while(i<css.length){
      while(/\s/.test(css[i]||""))i++;
      if(i>=css.length||css[i]==="}"){i++;return;}
      let start=i;
      while(i<css.length&&css[i]!=="{"&&css[i]!==";")i++;
      if(css[i]===";"){i++;continue;}
      const head=css.slice(start,i).trim();i++;
      if(head.startsWith("@media")||head.startsWith("@supports")){
        block((media?media+" && ":"")+head.replace(/^@(media|supports)\s*/,""));
      } else if(head.startsWith("@")){ let d=1;while(d&&i<css.length){if(css[i]==="{")d++;else if(css[i]==="}")d--;i++;} }
      else { let s=i,d=1;while(d&&i<css.length){if(css[i]==="{")d++;else if(css[i]==="}")d--;i++;} rules.push({media,sel:head,body:css.slice(s,i-1)}); }
    }
  }
  block("");return rules;
}
module.exports=function(n){
  const raw=fs.readFileSync(n+".html","utf8").split("\n")[132];
  const styles=[...raw.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join("\n");
  return parse(styles);
};
if(require.main===module){
  const [,,n,...pats]=process.argv;
  const rules=module.exports(n);
  for(const p of pats){
    const re=new RegExp(p);
    for(const r of rules) if(re.test(r.sel)) console.log((r.media?`@${r.media} `:"")+r.sel+" {"+r.body+"}\n");
  }
}
