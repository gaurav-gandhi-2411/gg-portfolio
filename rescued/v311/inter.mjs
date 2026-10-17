import { createRequire } from "node:module";
const req = createRequire("C:/Users/gaura/ml-projects/gg-portfolio-wt-verify311/package.json");
const { chromium } = req("@playwright/test");
const AxeBuilder = req("@axe-core/playwright").default;
const BASE = "http://localhost:3911";
const b = await chromium.launch();
const pages = ["triageiq","warmer","shelfsense","style-maitri"];
// tap target 390 + keyboard
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage();
  await p.goto(`${BASE}/work/triageiq`, { waitUntil: "networkidle" });
  const btn = p.locator("[data-proof-strip] button").first();
  console.log("tap box 390 triageiq first:", JSON.stringify(await btn.boundingBox()));
  const all = await p.locator("[data-proof-strip] button").evaluateAll(bs=>bs.map(x=>{const r=x.getBoundingClientRect();return [Math.round(r.width*10)/10,Math.round(r.height*10)/10]}));
  console.log("all triageiq strip buttons WxH:", JSON.stringify(all));
  await p.keyboard.press("Tab"); // walk until strip button focused
  for (let i=0;i<30;i++){ const inStrip = await p.evaluate(()=>!!document.activeElement?.closest("[data-proof-strip]")); if (inStrip) break; await p.keyboard.press("Tab"); }
  const f = await p.evaluate(()=>{const e=document.activeElement; const cs=getComputedStyle(e); const r=e.getBoundingClientRect(); let clip=[]; for(let a=e.parentElement;a;a=a.parentElement){const o=getComputedStyle(a); if(o.overflowX!=="visible"||o.overflowY!=="visible") clip.push(a.tagName+"."+String(a.className).slice(0,40)+" "+o.overflowX+"/"+o.overflowY);} return {matches:e.matches(":focus-visible"), outline:cs.outlineStyle+" "+cs.outlineWidth+" "+cs.outlineColor+" off "+cs.outlineOffset, rect:[r.left,r.top,r.right,r.bottom], clip, vw:innerWidth}});
  console.log("focus:", JSON.stringify(f));
  await p.screenshot({ path: "focus390.png", clip: { x: 0, y: Math.max(0,f.rect[1]-40), width: 390, height: 140 } });
  await p.keyboard.press("Enter");
  console.log("Enter -> aria-expanded:", await p.evaluate(()=>document.activeElement.getAttribute("aria-expanded")));
  await p.keyboard.press("Space");
  console.log("Space (after Enter) -> aria-expanded:", await p.evaluate(()=>document.activeElement.getAttribute("aria-expanded")));
  await p.keyboard.press("Space");
  console.log("Space again -> aria-expanded:", await p.evaluate(()=>document.activeElement.getAttribute("aria-expanded")));
  await ctx.close();
}
// popover in viewport at 320, last item, and overflow with popover open
for (const w of [320,375,768,1440]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); const p = await ctx.newPage();
  for (const s of pages) {
    await p.goto(`${BASE}/work/${s}`, { waitUntil: "networkidle" });
    const n = await p.locator("[data-proof-strip] button").count();
    for (const idx of [0, n-1]) {
      await p.locator("[data-proof-strip] button").nth(idx).click();
      await p.waitForTimeout(400);
      const r = await p.evaluate(()=>{const pn=[...document.querySelectorAll('[role=group][aria-label^="Source for"]')].find(e=>e.getBoundingClientRect().width>10); if(!pn) return null; const q=pn.getBoundingClientRect(); return {l:q.left,r:q.right,w:q.width,vw:document.documentElement.clientWidth,sw:document.documentElement.scrollWidth, op:getComputedStyle(pn).opacity}});
      const ok = r && r.l>=0 && r.r<=r.vw && r.sw<=r.vw;
      console.log(`w${w} ${s} item${idx}/${n-1} popover:`, JSON.stringify(r), ok?"OK":"PROBLEM");
      if (w===320 && idx===n-1 && s==="triageiq") await p.screenshot({path:"pop320-last.png"});
      await p.locator("[data-proof-strip] button").nth(idx).click(); // close
    }
  }
  await ctx.close();
}
// axe + contrast
for (const scheme of ["light","dark"]) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme }); const p = await ctx.newPage();
  for (const s of pages) {
    await p.goto(`${BASE}/work/${s}`, { waitUntil: "networkidle" });
    const res = await new AxeBuilder({ page: p }).analyze();
    const sc = res.violations.filter(v=>["serious","critical"].includes(v.impact));
    const ct = await p.evaluate(()=>{
      const cv=document.createElement("canvas").getContext("2d",{willReadFrequently:true});
      const px=(c)=>{cv.clearRect(0,0,1,1);cv.fillStyle="#000";cv.fillStyle=c;cv.fillRect(0,0,1,1);const d=cv.getImageData(0,0,1,1).data;return [d[0],d[1],d[2],d[3]/255]};
      const lum=([r,g,b])=>{const f=x=>{x/=255;return x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
      const bgOf=(el)=>{let layers=[];for(let a=el;a;a=a.parentElement){const c=px(getComputedStyle(a).backgroundColor);if(c[3]>0)layers.push(c);if(c[3]>=1)break;}let base=[255,255,255];if(getComputedStyle(document.documentElement).colorScheme.includes("dark")||matchMedia("(prefers-color-scheme: dark)").matches)base=[0,0,0];const bd=px(getComputedStyle(document.body).backgroundColor);if(bd[3]>0)base=bd.slice(0,3);for(const c of layers.reverse()){base=base.map((v,i)=>c[i]*c[3]+v*(1-c[3]))}return base};
      const out=[];for(const [sel,name] of [["[data-proof-value] button > span:first-child","value"],["[data-proof-label]","label"]]){for(const el of document.querySelectorAll("[data-proof-strip] "+sel)){const fg=px(getComputedStyle(el).color);const bg=bgOf(el);const fgc=fg.slice(0,3).map((v,i)=>v*fg[3]+bg[i]*(1-fg[3]));const L1=lum(fgc),L2=lum(bg);out.push(name+" "+((Math.max(L1,L2)+.05)/(Math.min(L1,L2)+.05)).toFixed(2));}}
      return out;});
    const ratios = ct.map(x=>parseFloat(x.split(" ")[1]));
    console.log(`${scheme} ${s}: axe serious/critical=${sc.length} ${sc.map(v=>v.id+"("+v.nodes.length+")").join(",")}; contrast min=${Math.min(...ratios)} (n=${ratios.length})`);
  }
  await ctx.close();
}
await b.close();
