import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
register(pathToFileURL("evals/chatbot/alias-loader.mjs").href, pathToFileURL("./x.mjs").href);
const m = await import(pathToFileURL("lib/chatbot/retrieve.ts").href);
const out = {};
for (const f of readdirSync("evals/chatbot/fixtures").sort()) {
  const fx = JSON.parse(readFileSync("evals/chatbot/fixtures/" + f, "utf8"));
  const r = await m.retrieve(fx.question);
  out[f] = { max: r.maxScore, top: r.chunks.map((c) => c.sourceRef ?? c.id ?? JSON.stringify(Object.keys(c))) };
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log("fixtures", Object.keys(out).length);
