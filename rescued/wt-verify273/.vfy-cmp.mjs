import {readFileSync} from "node:fs";
const sp=process.argv[2];
const a=JSON.parse(readFileSync(sp+"/top5-main.json")), b=JSON.parse(readFileSync(sp+"/top5-pr.json"));
let setCh=0, ordCh=0; const rows=[];
for (const k of Object.keys(a)) {
  const x=a[k].top,y=b[k].top;
  const sx=[...x].sort().join("|"), sy=[...y].sort().join("|");
  const s=sx!==sy, o=x.join("|")!==y.join("|");
  if(s) setCh++; if(o) ordCh++;
  if(o) rows.push(`${k} set=${s} thresh_max ${a[k].max.toFixed(4)}->${b[k].max.toFixed(4)} top1 ${x[0]}${x[0]===y[0]?"":" -> "+y[0]}`);
}
console.log("fixtures",Object.keys(a).length,"top5 set changed",setCh,"order or set changed",ordCh);
console.log(rows.join("\n"));
const crossGate=Object.keys(a).filter(k=>(a[k].max>=0.3)!==(b[k].max>=0.3));
console.log("threshold(0.3) side flips:",crossGate);
const m=JSON.parse(readFileSync(sp+"/idx-main.json")), n=JSON.parse(readFileSync("content/chatbot/index.json"));
const mm=new Map(m.chunks.map(c=>[c.id,c]));
let miss=0, textdiff=0; const cs=[];
for(const c of n.chunks){const o=mm.get(c.id); if(!o){miss++;continue;} if(o.text!==c.text)textdiff++; let d=0,na=0,nb=0; for(let i=0;i<c.embedding.length;i++){d+=c.embedding[i]*o.embedding[i];na+=c.embedding[i]**2;nb+=o.embedding[i]**2;} cs.push(d/Math.sqrt(na*nb));}
cs.sort((p,q)=>p-q);
console.log("chunks new",n.chunks.length,"old",m.chunks.length,"missing-in-old",miss,"textdiff",textdiff);
console.log("cosine min",cs[0],"mean",cs.reduce((p,q)=>p+q,0)/cs.length,"median",cs[cs.length>>1],"p5",cs[Math.floor(cs.length*0.05)]);
