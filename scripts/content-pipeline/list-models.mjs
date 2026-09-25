#!/usr/bin/env node
// scripts/content-pipeline/list-models.mjs — workflow_dispatch-only model-discovery utility
// (fix/content-pipeline-groq-model, 2026-09): calls Groq's GET /openai/v1/models and prints model
// ids (+ owned_by/active when the API returns them), sorted. Diagnostic only — never called by
// run.mjs or any scheduled job. Prints no headers and never the key itself.
//
// Zero dependencies, same convention as scripts/refresh-metrics.mjs — global fetch only.

const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";

async function main() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY not set — cannot list Groq models.");
    process.exit(1);
  }

  let res;
  try {
    res = await fetch(GROQ_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  } catch (err) {
    console.error(`Groq models list failed: network error — ${err.message}`);
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`Groq models list failed: HTTP ${res.status}`);
    process.exit(1);
  }

  const data = await res.json();
  const models = (data?.data ?? [])
    .map((m) => ({ id: m.id, owned_by: m.owned_by, active: m.active }))
    .sort((a, b) => a.id.localeCompare(b.id));

  if (models.length === 0) {
    console.error("Groq models list returned zero models — treating as an error, not silently empty.");
    process.exit(1);
  }

  for (const m of models) {
    console.log(`${m.id}\towned_by=${m.owned_by ?? "?"}\tactive=${m.active ?? "?"}`);
  }
}

main().catch((err) => {
  console.error("list-models.mjs failed:", err);
  process.exit(1);
});
