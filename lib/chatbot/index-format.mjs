// Pure helpers for content/chatbot/index.json: the on-disk layout and the
// embedding-reuse rule. No I/O and no model, so both are unit-testable.
//
// WHY THE LAYOUT IS WHAT IT IS: the index used to be one 5 MB line with a
// per-run `generatedAt`, so any two content PRs conflicted on it even when they
// touched different projects. The file is still ONE valid JSON document (the
// bundler, the eval loader and the e2e specs all `import` it as JSON), but it is
// laid out one chunk per line, sorted by id, with a leading comma, so git's
// line-based three-way merge can combine edits to different chunks:
//
//   {"model":"<id>","chunks":[
//   {chunk}
//   ,{chunk}
//   ]}
//
// `generatedAt` and `chunkCount` are gone: the first changed on every rebuild
// (a guaranteed conflict and a byte-instability), the second is derivable from
// `chunks.length` and was a second line every PR touched.

/**
 * Natural-order comparator on chunk ids: digit runs compare numerically, other
 * text by UTF-16 code unit (locale-independent, so the order is identical on
 * every OS and Node build). Numeric comparison keeps `p2` before `p10` and
 * `foo#2` before `foo#10`; the latter matters because lib/chatbot/retrieve.ts
 * builds a sourceRef -> chunk Map in which the LAST duplicate wins.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareIds(a, b) {
  const ta = a.match(/\d+|\D+/g) ?? [];
  const tb = b.match(/\d+|\D+/g) ?? [];
  for (let i = 0; i < Math.min(ta.length, tb.length); i++) {
    const x = ta[i];
    const y = tb[i];
    if (x === y) continue;
    if (/^\d/.test(x) && /^\d/.test(y)) {
      const d = BigInt(x) - BigInt(y);
      if (d !== 0n) return d < 0n ? -1 : 1;
      // Equal value, different spelling (leading zeros): fall through to text.
    }
    return x < y ? -1 : 1;
  }
  return ta.length - tb.length;
}

/**
 * Returns the chunks sorted by id. Throws on a duplicate id: ids are the merge
 * key and the reuse key, so a duplicate is a builder bug, not data.
 * @param {{id: string}[]} chunks
 */
export function sortChunks(chunks) {
  const sorted = [...chunks].sort((p, q) => compareIds(p.id, q.id));
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].id === sorted[i - 1].id) {
      throw new Error(`Duplicate chunk id: ${sorted[i].id}`);
    }
  }
  return sorted;
}

/**
 * Serialises the index in the one-chunk-per-line layout. Deterministic: sorted
 * by id, and floats go through JSON.stringify (shortest round-trip form), so the
 * same vectors always produce the same bytes.
 * @param {{model: string, chunks: object[]}} index
 * @returns {string}
 */
export function serializeIndex({ model, chunks }) {
  const lines = sortChunks(chunks).map((c, i) => (i === 0 ? "" : ",") + JSON.stringify(c));
  return `{"model":${JSON.stringify(model)},"chunks":[\n${lines.join("\n")}\n]}\n`;
}

/**
 * The reuse key. A prior embedding is valid for a new chunk only if the id, the
 * exact text AND the model all match. The model component is the model id only:
 * embed.mjs does not pin a Hugging Face revision yet (IMPROVEMENTS A3), so a
 * silent upstream re-upload of the same id would NOT invalidate reuse. Pinning
 * the revision and adding it here is what makes this strict.
 * @param {string} model
 * @param {{id: string, text: string}} chunk
 * @returns {string}
 */
export function reuseKey(model, chunk) {
  return JSON.stringify([model, chunk.id, chunk.text]);
}

/**
 * Splits freshly-chunked records into those whose embedding can be taken from
 * the prior index and those that must be embedded.
 * @param {{id: string, text: string}[]} chunks
 * @param {{model?: string, chunks?: {id: string, text: string, embedding?: number[]}[]} | null} prior
 * @param {string} model
 * @returns {{reused: {id: string, text: string, embedding: number[]}[], missing: {id: string, text: string}[]}} `reused` entries already carry `embedding`.
 */
export function partitionForReuse(chunks, prior, model) {
  const priorByKey = new Map();
  if (prior && prior.model === model && Array.isArray(prior.chunks)) {
    for (const p of prior.chunks) {
      if (Array.isArray(p.embedding) && p.embedding.length > 0) {
        priorByKey.set(reuseKey(model, p), p.embedding);
      }
    }
  }
  const reused = [];
  const missing = [];
  for (const c of chunks) {
    const emb = priorByKey.get(reuseKey(model, c));
    if (emb) reused.push({ ...c, embedding: emb });
    else missing.push(c);
  }
  return { reused, missing };
}
