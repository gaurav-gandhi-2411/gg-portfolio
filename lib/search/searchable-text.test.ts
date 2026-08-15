import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSearchableText } from "./searchable-text.ts";

test("buildSearchableText joins name, tagline, techChips, and category labels", () => {
  const text = buildSearchableText({
    name: "TriageIQ",
    tagline: "Triages GitHub issues.",
    techChips: ["TF-IDF", "BGE + FAISS"],
    categoryLabels: ["LLM & Agents", "Retrieval & Embeddings"],
  });
  assert.equal(
    text,
    "TriageIQ. Triages GitHub issues.. TF-IDF. BGE + FAISS. LLM & Agents. Retrieval & Embeddings"
  );
});

test("buildSearchableText omits techChips entirely when absent", () => {
  const text = buildSearchableText({
    name: "DealHunter",
    tagline: "Multi-agent flight search.",
    categoryLabels: ["LLM & Agents"],
  });
  assert.equal(text, "DealHunter. Multi-agent flight search.. LLM & Agents");
});

test("buildSearchableText drops empty-string parts rather than leaving stray separators", () => {
  const text = buildSearchableText({
    name: "X",
    tagline: "",
    techChips: [],
    categoryLabels: [],
  });
  assert.equal(text, "X");
});
