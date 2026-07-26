// scripts/content-pipeline/framer.mjs — Wave 15, stage 3: drafts the actual copy for a
// curator-approved candidate, applying the wave-15 framing rule (lead with the capability
// demonstrated; the honest number is evidence of the skill, never removed or softened).
//
// Deliberately does NOT write directly into content/case-studies/*.ts — those are hand-crafted
// prose files, and splicing generated text into them programmatically risks corrupting a file a
// human wrote carefully. The framer's draft is proposed in content/provenance.md (this pipeline's
// only file output — see run.mjs) for GG to fold into the actual case study by hand once
// reviewed, same posture as every other "propose, never auto-apply" step in this pipeline.

const SYSTEM_PROMPT = `You are the framer stage of an automated content-curation pipeline for a
software engineer's (GG's) portfolio site. You draft a short, honest, capability-first sentence
for a curator-approved fact. Rules:
- Lead with the capability/action demonstrated (diagnosed, caught, measured, built, tested...),
  not the raw problem or a bare number.
- The honest number/detail is evidence of the skill — include it, never remove or soften it.
- One or two sentences, in a direct, plain-spoken voice (no marketing adjectives like
  "revolutionary" or "seamless").
- You are proposing text for human review — you are not editing any file yourself.

Respond with JSON only: {"draft": "the proposed sentence(s)", "suggested_source_ref_id":
"slug:short-kebab-name", "rationale": "one sentence on why this framing was chosen"}.`;

export async function frame(callLlm, repo, candidate) {
  const userPrompt = `Repo: ${repo}
Candidate fact (curator score ${candidate.curator?.score ?? "n/a"}/5, passed): "${candidate.text ?? candidate.value}"
Source: ${candidate.source_file}${candidate.source_line ? `:${candidate.source_line}` : ""}

Draft the proposed copy for this fact.`;

  const result = await callLlm("framer", SYSTEM_PROMPT, userPrompt);
  if (!result) return { ...candidate, framer: null };
  return { ...candidate, framer: result };
}
