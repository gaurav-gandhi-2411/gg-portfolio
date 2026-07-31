// Wave 20 — prose/semantic drift detection (report-only, never auto-edits).
// Full explanation, calibration numbers, and the real-world false-positive
// finding that keeps this MANUAL rather than scheduled: docs/prose-drift-checker.md.
//
// Run: `node scripts/check-prose-drift.mjs` (real case studies) or
// `node scripts/check-prose-drift.mjs --controls` (calibration set).
//
// scripts/check-metric-freshness.mjs checks numeric claims; it has no anchor
// for architecture/status/enumeration prose. This bundles each case study's
// problem/approach/architecture/closing text and sends it, alongside the
// source repo's current README, to three local LLMs from different model
// families (gemma2:9b, llama3.1:8b, qwen2.5:7b), run BLIND on an identical
// prompt. A 2-of-3 majority vote that the prose contradicts the README
// triggers a flag. Labeled LLM-consensus (docs/content-pipeline-rubric.md's
// convention) — model judgment, not verified fact. FLAGS for review, never
// auto-edits. Fails CLOSED (rule 98a): an unreachable judge or unparseable
// output is UNVERIFIABLE, never silently "consistent."
//
// Requires a local Ollama with gemma2:9b, llama3.1:8b, qwen2.5:7b pulled. No
// paid provider, no ANTHROPIC_API_KEY, no network egress beyond
// localhost:11434 and (real-case-study mode) raw.githubusercontent.com.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CASE_STUDIES_DIR = join(ROOT, "content", "case-studies");
const CASE_STUDIES_INDEX_PATH = join(CASE_STUDIES_DIR, "index.ts");
const CONTROLS_DIR = join(ROOT, "scripts", "prose-drift-controls");
const SUMMARY_PATH = process.env.PROSE_DRIFT_SUMMARY_PATH ?? "/tmp/prose-drift-summary.md";
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const FETCH_TIMEOUT_MS = 20_000, JUDGE_TIMEOUT_MS = 120_000;
const JUDGES = ["gemma2:9b", "llama3.1:8b", "qwen2.5:7b"];

// null = private repo, not fetchable.
const CASE_STUDY_REPO = {
  warmer: null, "style-maitri": "gaurav-gandhi-2411/agentic-shopping-assistant",
  triageiq: "gaurav-gandhi-2411/triage-iq", dealhunter: "gaurav-gandhi-2411/agentic-travel-booking-system",
  shelfsense: "gaurav-gandhi-2411/shelfsense-m5", reviewiq: "gaurav-gandhi-2411/review-iq",
  "multimodal-fashion-recommender": "gaurav-gandhi-2411/multimodal-fashion-recommender",
  "gold-rate-tracker": "gaurav-gandhi-2411/gold-rate-tracker", aetherart: "gaurav-gandhi-2411/AetherArt",
  agentgauge: "gaurav-gandhi-2411/agentgauge", reclaim: "gaurav-gandhi-2411/reclaim",
  tracegauge: "gaurav-gandhi-2411/token-efficiency-scorer", "expense-tracker": "gaurav-gandhi-2411/expense-tracker",
};
async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

// Everything that isn't a numeric results/decision row (check-metric-freshness.mjs's
// territory) — architecture/status/enumeration prose has no numeric anchor.
function buildProseBundle(study) {
  const parts = [
    ...study.problem,
    ...study.approach,
    study.architecture?.intro ?? "",
    ...(study.architecture?.stages ?? []).map((s) => `${s.label}: ${s.detail ?? ""}`),
    study.architecture?.note ?? "",
    ...(study.closing ?? []),
  ];
  return parts.filter(Boolean).join("\n\n");
}

function buildPrompt(prose, readme) {
  return `You are fact-checking a portfolio case-study page against the software project's own README. You will be shown two texts: CASE STUDY PROSE (a description of the project's architecture, status, and behavior) and CURRENT README (the project's own current documentation).

Your job: does the CASE STUDY PROSE contain any claim that CONTRADICTS the CURRENT README? Check specifically for these three contradiction classes, one at a time, before answering:

1. DATA-SOURCE / COMPONENT PRIMACY — does the prose name one system, source, or step as the primary/default one, when the README names a DIFFERENT one as primary/default (even if both are mentioned in both texts — what matters is which one is described as primary vs. secondary/fallback/opportunistic)?
2. OPERATIONAL STATUS — does the prose say a feature/system/signal is on, live, shown, or working, when the README says it is off, dark, suppressed, or down (or vice versa)?
3. ENUMERATION — does the prose list a specific set of things (models, stages, integrations) that the README shows has changed (an item added, removed, or renamed)?

A contradiction is an ACTIVE factual conflict, not a mere omission or difference in emphasis — the two texts must actually disagree about the same fact. Read both texts fully before deciding; the contradiction may be stated in different words in each (e.g. one text says "the old approach" without naming it, the other explains what changed and why).

First, briefly reason step by step through each of the three classes above (2-3 sentences total). Then, on a final line by itself, output ONLY a JSON object in exactly this shape:
{"contradicts": true or false, "evidence": "the specific contradicting sentence quoted from each text, or empty string if no contradiction"}

CASE STUDY PROSE:
"""
${prose}
"""

CURRENT README (may be truncated):
"""
${readme.slice(0, 8000)}
"""`;
}

async function askJudge(model, prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JUDGE_TIMEOUT_MS);
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        // num_predict: reasoning-then-JSON responses run long; Ollama's
        // unspecified default truncated qwen2.5:7b mid-reasoning before it
        // ever reached the JSON line during calibration.
        options: { temperature: 0, num_predict: 800 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
    const data = await res.json();
    const text = data.response ?? "";
    // Deliberately NOT a strict JSON.parse of the whole object: calibration
    // showed qwen2.5:7b reliably reaches the correct "contradicts" verdict
    // but sometimes wraps its "evidence" string in malformed nested quotes
    // (mixed single/double quotes, stray braces) that fail strict parsing.
    // The verdict is the decision; evidence is display-only — extract each
    // independently so a malformed evidence string can't discard a valid
    // verdict. Take the LAST match, since the prompt asks for reasoning
    // first and the JSON line last.
    const contradictsMatches = [...text.matchAll(/"contradicts"\s*:\s*(true|false)/gi)];
    if (contradictsMatches.length === 0) {
      throw new Error(
        `no "contradicts" field in judge response (done_reason=${data.done_reason}, len=${text.length}): ...${text.slice(-300)}`
      );
    }
    const contradicts = contradictsMatches[contradictsMatches.length - 1][1].toLowerCase() === "true";
    const evidenceMatch = text.match(/"evidence"\s*:\s*['"]?(.*?)['"]?\s*[,}]\s*$/s) ?? text.match(/"evidence"\s*:\s*['"]?([^\n]*)/);
    const evidence = (evidenceMatch?.[1] ?? "").slice(0, 300);
    return { ok: true, contradicts, evidence };
  } catch (err) {
    // Fails CLOSED: a judge failure is UNVERIFIABLE for that judge, never
    // silently counted as "consistent" in the consensus vote.
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function runPanel(prose, readme) {
  const prompt = buildPrompt(prose, readme);
  const verdicts = [];
  for (const model of JUDGES) {
    const result = await askJudge(model, prompt);
    verdicts.push({ model, ...result });
  }
  const usable = verdicts.filter((v) => v.ok);
  const contradictCount = usable.filter((v) => v.contradicts).length;
  const allAgree = usable.length > 0 && (contradictCount === 0 || contradictCount === usable.length);
  return {
    verdicts,
    usableCount: usable.length,
    contradictCount,
    flagged: usable.length >= 2 && contradictCount * 2 > usable.length, // majority of USABLE judges, needs >=2 usable to mean anything
    allAgree,
  };
}

function discoverCaseStudyModules() {
  const indexSrc = readFileSync(CASE_STUDIES_INDEX_PATH, "utf8");
  const matches = [...indexSrc.matchAll(/import \{ (\w+) \} from "\.\/([\w-]+)";/g)];
  return matches.map(([, exportName, fileName]) => ({ exportName, fileName }));
}

// Shared by both modes: load+bundle a case study's prose, fetch its repo's
// README, run the judge panel. { error } means UNVERIFIABLE either way.
async function checkStudy(dir, file, exportName, repo) {
  if (repo === undefined) return { error: "no repo mapping" };
  if (repo === null) return { error: "private repo, not fetchable" };
  const mod = await import(pathToFileURL(join(dir, file)).href);
  const prose = buildProseBundle(mod[exportName]);
  let readme;
  try {
    readme = await fetchText(`https://raw.githubusercontent.com/${repo}/HEAD/README.md`);
  } catch (err) {
    return { error: `README fetch failed — ${err.message}` };
  }
  return { panel: await runPanel(prose, readme) };
}

function formatVerdicts(panel, evidenceChars) {
  return panel.verdicts
    .map((v) =>
      v.ok
        ? `${v.model}: ${v.contradicts ? "CONTRADICTS" : "consistent"} — ${v.evidence.slice(0, evidenceChars)}`
        : `${v.model}: ERROR — ${v.error}`
    )
    .join("\n  ");
}

const isControlsMode = process.argv.includes("--controls");
const lines = [];
const today = new Date().toISOString().slice(0, 10);

if (isControlsMode) {
  lines.push(`## Prose-drift checker — calibration run against controls — ${today}`);
  lines.push("");
  lines.push(
    "Positive controls (SHOULD be flagged): the actual pre-fix case-study text for gold-rate-tracker " +
      "(inverted Tanishq/IBJA architecture) and expense-tracker (wrong outage status), both real text " +
      "this site shipped before this session's remediation. Negative controls (should NOT be flagged): " +
      "the current, corrected text for both (loaded live from content/case-studies/), checked against " +
      "the same current README."
  );
  lines.push("");

  const controls = [
    { name: "gold-rate-tracker (PRE-FIX, positive control)", dir: CONTROLS_DIR, file: "gold-pre.ts", export_: "goldRateTracker", repo: CASE_STUDY_REPO["gold-rate-tracker"], expectFlag: true },
    { name: "gold-rate-tracker (POST-FIX, negative control)", dir: CASE_STUDIES_DIR, file: "gold-rate-tracker.ts", export_: "goldRateTracker", repo: CASE_STUDY_REPO["gold-rate-tracker"], expectFlag: false },
    { name: "expense-tracker (PRE-FIX, positive control)", dir: CONTROLS_DIR, file: "expense-pre.ts", export_: "expenseTracker", repo: CASE_STUDY_REPO["expense-tracker"], expectFlag: true },
    { name: "expense-tracker (POST-FIX, negative control)", dir: CASE_STUDIES_DIR, file: "expense-tracker.ts", export_: "expenseTracker", repo: CASE_STUDY_REPO["expense-tracker"], expectFlag: false },
  ];

  let correct = 0;
  const rows = [];
  for (const c of controls) {
    const { panel, error } = await checkStudy(c.dir, c.file, c.export_, c.repo);
    if (error) {
      rows.push(`- **${c.name}**: UNVERIFIABLE — ${error}`);
      continue;
    }
    const isCorrect = panel.flagged === c.expectFlag;
    if (isCorrect) correct++;
    rows.push(
      `- **${c.name}**: expected ${c.expectFlag ? "FLAG" : "no flag"}, got **${panel.flagged ? "FLAGGED" : "not flagged"}** ` +
        `(${isCorrect ? "correct" : "WRONG"}) — ${panel.contradictCount}/${panel.usableCount} judges said contradicts, ` +
        `all-agree: ${panel.allAgree}\n  ${formatVerdicts(panel, 150)}`
    );
  }

  lines.push(`### Results: ${correct}/${controls.length} controls correctly classified`);
  lines.push("");
  lines.push(...rows);
} else {
  lines.push(`## Prose-drift checker — LLM-consensus, report-only, flags for human review — ${today}`);
  lines.push("");
  lines.push(
    "Architecture/status/enumeration prose has no numeric anchor, so scripts/check-metric-freshness.mjs " +
      "cannot check it. This is a DIFFERENT kind of check: 3 local LLMs (gemma2:9b, llama3.1:8b, qwen2.5:7b), " +
      "run blind, vote on whether each case study's prose contradicts its source repo's current README. " +
      "Majority (2 of 3) triggers a flag. LLM-consensus judgment, not verified fact — never auto-edits, " +
      "always needs a human read. See this script's calibration run (--controls) for measured precision."
  );
  lines.push("");

  const flagged = [];
  const clean = [];
  const unverifiable = [];
  for (const { exportName, fileName } of discoverCaseStudyModules()) {
    const { panel, error } = await checkStudy(CASE_STUDIES_DIR, `${fileName}.ts`, exportName, CASE_STUDY_REPO[fileName]);
    if (error) {
      unverifiable.push(`\`${fileName}\`: ${error}`);
    } else if (panel.usableCount < 2) {
      unverifiable.push(`\`${fileName}\`: only ${panel.usableCount}/3 judges returned a usable verdict`);
    } else if (panel.flagged) {
      flagged.push({ fileName, panel });
    } else {
      clean.push(fileName);
    }
  }

  if (flagged.length > 0) {
    lines.push(`### Flagged for human review — ${flagged.length} case stud${flagged.length === 1 ? "y" : "ies"}`);
    lines.push("");
    for (const { fileName, panel } of flagged) {
      lines.push(`- \`${fileName}\`: ${panel.contradictCount}/${panel.usableCount} judges, all-agree: ${panel.allAgree}`);
      lines.push(`  ${formatVerdicts(panel, 200)}`);
    }
    lines.push("");
  }
  lines.push(`### Not flagged — ${clean.length} case stud${clean.length === 1 ? "y" : "ies"}: ${clean.map((s) => `\`${s}\``).join(", ") || "none"}`);
  lines.push("");
  if (unverifiable.length > 0) {
    lines.push(`### Unverifiable — ${unverifiable.length}`);
    lines.push("");
    for (const u of unverifiable) lines.push(`- ${u}`);
    lines.push("");
  }
}

const summary = lines.join("\n") + "\n";
process.stdout.write(summary);
writeFileSync(SUMMARY_PATH, summary);
