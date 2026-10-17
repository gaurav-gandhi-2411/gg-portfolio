import { createRequire } from "node:module";
const req = createRequire("C:/Users/gaura/ml-projects/gg-portfolio-wt-verify311/package.json");
const { chromium } = req("@playwright/test");
const BASE = process.env.BASE || "http://localhost:3911";
const slugs = ["adk-tracegauge","aetherart","agentgauge","dealhunter","eval-defect-bench","expense-tracker","gold-rate-tracker","multimodal-fashion-recommender","reclaim","reviewiq","shelfsense","style-maitri","tracegauge","triageiq","warmer"];
const widths = [320,360,375,390,414,480,768,1440];
const b = await chromium.launch();
let mg = 1e9; const out = { overlaps: [], items: 0, strips: {}, dom: [], taps: {}, overflow: [] };
for (const w of widths) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  for (const s of slugs) {
    await page.goto(`${BASE}/work/${s}`, { waitUntil: "networkidle" });
    const r = await page.evaluate(() => {
      const strip = document.querySelector("[data-proof-strip]");
      const res = { has: !!strip, items: [], sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth };
      if (!strip) return res;
      const rect = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); const rs=[...rg.getClientRects()].filter(x=>x.width>0&&x.height>0); return rs.length? {top:Math.min(...rs.map(x=>x.top)), bottom:Math.max(...rs.map(x=>x.bottom))}:null; };
      const clean = (el) => { const c = el.cloneNode(true); c.querySelectorAll(".sr-only").forEach(n=>n.remove()); return c.textContent.trim(); };
      for (const it of strip.querySelectorAll("[data-proof-item]")) {
        const v = it.querySelector("[data-proof-value]"), l = it.querySelector("[data-proof-label]");
        const vb = v.querySelector("button");
        const vs = v.querySelector("button > span:first-child") ?? v; const vr = rect(vs), lr = rect(l);
        const bb = vb?.getBoundingClientRect();
        res.items.push({ value: vs.textContent.trim(), btnGap: bb ? l.getBoundingClientRect().top - bb.bottom : null, label: l.textContent.trim(), gap: lr.top - vr.bottom, btn: bb ? [bb.width, bb.height] : null, hasBtn: !!vb });
      }
      return res;
    });
    if (r.sw > r.cw) out.overflow.push({ w, s, sw: r.sw, cw: r.cw });
    if (w === 390) out.strips[s] = r.has ? r.items.length : 0;
    for (const it of r.items) {
      out.items++;
      mg = Math.min(mg, it.gap); if (it.gap < 0 || it.btnGap < 0) out.overlaps.push({ w, s, value: it.value, gap: it.gap, btnGap: it.btnGap });
      if (w === 390) out.taps[s + "|" + it.value] = it.btn;
    }
    if (w === 1440) {
      // DOM scan vs Results rows
      const rows = await page.evaluate(() => {
        const clean = (el) => el.querySelector("button > span:first-child").textContent.trim();
        return [...document.querySelectorAll(".case-chip-row .case-chip")].map(c => ({ value: clean(c.querySelector("dd")), label: c.querySelector("dt").textContent.trim(), btn: !!c.querySelector("dd button") }));
      });
      out.dom.push({ s, items: r.items.map(i=>({value:i.value,label:i.label,hasBtn:i.hasBtn})), rows });
    }
  }
  await ctx.close();
}
await b.close();
// verify each strip item equals some results row value+label (label: row dt startsWith label)
const bad = [];
for (const d of out.dom) for (const it of d.items) {
  const m = d.rows.find(r => r.value === it.value && r.label.startsWith(it.label));
  if (!m || !m.btn || !it.hasBtn) bad.push({ s: d.s, it, m: !!m });
}
// order: strip items must be first eligible; just print
console.log(JSON.stringify({ itemsMeasured: out.items, overlapCount: out.overlaps.length, overlaps: out.overlaps, overflow: out.overflow, stripsAt390: out.strips, domMismatch: bad }, null, 1));
console.log("TAP390", JSON.stringify(out.taps, null, 1));
console.log("MINGAP", mg);
