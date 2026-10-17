import { createRequire } from "node:module";
const req = createRequire("C:/Users/gaura/ml-projects/gg-portfolio-wt-verify311/package.json");
const { chromium } = req("@playwright/test");
const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:320,height:900}}); const p = await ctx.newPage();
await p.goto("http://localhost:3911/work/adk-tracegauge",{waitUntil:"networkidle"});
console.log(await p.evaluate(()=>{const o=[];for(const e of document.querySelectorAll("body *")){const r=e.getBoundingClientRect();if(r.right>321&&r.width>0)o.push(e.tagName+"."+String(e.className).slice(0,60)+" right="+Math.round(r.right)+" inStrip="+!!e.closest("[data-proof-strip]"));}return o.slice(0,12).join("\n")+"\nsw="+document.documentElement.scrollWidth}));
await b.close();
