import {readFileSync,writeFileSync} from "node:fs";
import {serializeIndex} from "./lib/chatbot/index-format.mjs";
const p="content/chatbot/index.json";
const mode=process.argv[2];
const raw=readFileSync(p,"utf8"); const idx=JSON.parse(raw);
if(mode==="swap"){const a=idx.chunks[10].embedding; idx.chunks[10].embedding=idx.chunks[200].embedding; idx.chunks[200].embedding=a; writeFileSync(p,serializeIndex(idx));}
if(mode==="oneline"){writeFileSync(p,JSON.stringify(idx));}
