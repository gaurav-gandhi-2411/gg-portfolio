#!/usr/bin/env node
// Build a JD-tailored resume variant. See spec-resume-variants.md.
//
// Usage: node scripts/build_resume.js --variant <name> [--allow-unverified]
//
// Pipeline: load content -> select/score/order -> print ranking table ->
// page-fit loop (render -> soffice -> pypdf page count -> drop lowest-scored
// project if over budget) -> hard-gate lint on the final selection -> write
// .docx/.pdf -> keyword-coverage report.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { Packer } = require("docx");

const { selectForVariant, buildCollapsedLine } = require("./lib/resume-select");
const { buildDocument, extractRenderedText } = require("./lib/resume-layout");
const lint = require("./lib/resume-lint");

const ROOT = path.resolve(__dirname, "..");
const BUILD_DIR = path.join(ROOT, "build", "resume");
const REPORTS_DIR = path.join(ROOT, "reports");

// Item A: independent of the ranker's own sequence. The two-stage model in
// resume-select.js still produces the full best-first order; this just caps
// how many of that order render as full entries before the page-fit loop
// even starts. A variant may override via `max_full_entries`.
const DEFAULT_MAX_FULL_ENTRIES = 8;

function parseArgs(argv) {
  const args = { variant: null, allowUnverified: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--variant") args.variant = argv[++i];
    else if (argv[i] === "--allow-unverified") args.allowUnverified = true;
  }
  if (!args.variant) {
    console.error("Usage: node scripts/build_resume.js --variant <name> [--allow-unverified]");
    process.exit(2);
  }
  return args;
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

// Amendment 3, items 5-7: soffice preferred (matches the spec's original hard
// requirement), Word COM via docx2pdf as a detected fallback when soffice
// isn't installed. Never guesses — returns null if neither backend is
// actually usable, and the caller fails the build closed rather than skip
// the page-count gate (rule 98a: a verification gate that can't verify must
// deny, not silently pass).
function findSoffice() {
  const candidates = [
    "soffice",
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
  ];
  for (const c of candidates) {
    try {
      execFileSync(c, ["--version"], { stdio: "pipe" });
      return c;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function findWordCom() {
  const wordPaths = [
    "C:\\Program Files\\Microsoft Office\\root\\Office16\\WINWORD.EXE",
    "C:\\Program Files (x86)\\Microsoft Office\\root\\Office16\\WINWORD.EXE",
  ];
  if (!wordPaths.some((p) => fs.existsSync(p))) return false;
  try {
    execFileSync("python", ["-c", "import docx2pdf"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function detectPdfBackend() {
  const sofficeBin = findSoffice();
  if (sofficeBin) return { kind: "soffice", bin: sofficeBin };
  if (findWordCom()) return { kind: "word-com" };
  return null;
}

function countPdfPages(pdfPath) {
  const script = `from pypdf import PdfReader; print(len(PdfReader(r"${pdfPath}").pages))`;
  const out = execFileSync("python", ["-c", script], { encoding: "utf-8" });
  const n = parseInt(out.trim(), 10);
  if (Number.isNaN(n)) throw new Error(`could not parse page count from pypdf output: ${out}`);
  return n;
}

async function renderAndCountPages(selection, variantName, backend) {
  const doc = buildDocument(selection);
  const buffer = await Packer.toBuffer(doc);
  const docxPath = path.join(BUILD_DIR, `${variantName}.docx`);
  fs.writeFileSync(docxPath, buffer);
  const pdfPath = path.join(BUILD_DIR, `${variantName}.pdf`);

  // Delete any stale PDF from a prior run first — if the conversion below
  // silently no-ops, the page-count check must not pass by counting old
  // output (rule 98a: fail closed, never on an unverified/ambiguous result).
  if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);

  if (backend.kind === "soffice") {
    execFileSync(backend.bin, ["--headless", "--convert-to", "pdf", "--outdir", BUILD_DIR, docxPath], {
      stdio: "pipe",
      timeout: 60000,
    });
  } else if (backend.kind === "word-com") {
    const script = `from docx2pdf import convert; convert(r"${docxPath}", r"${pdfPath}")`;
    execFileSync("python", ["-c", script], { stdio: "pipe", timeout: 60000 });
  } else {
    throw new Error(`unknown pdf backend: ${JSON.stringify(backend)}`);
  }

  if (!fs.existsSync(pdfPath)) {
    throw new Error(`${backend.kind} conversion did not produce ${pdfPath} — refusing to assume a page count.`);
  }
  const pages = countPdfPages(pdfPath);
  return { docxPath, pdfPath, pages };
}

function printScoreRows(rows) {
  console.log("  rank  score  id                     demo role depth metric");
  rows.forEach((c, i) => {
    const e = c.entry;
    console.log(
      `  ${String(i + 1).padStart(2)}    ${c.score.toFixed(2).padStart(4)}  ${e.id.padEnd(22)} ${e.demo_quality}    ${e.role_relevance}    ${e.technical_depth}     ${e.metric_strength}`,
    );
  });
}

// Amendment 3: two-stage positional model. Prints BOTH stage tables (the
// audit-trail requirement) plus the combined final order.
function printRankingTable(variantName, base) {
  const w = base.weights;
  console.log(
    `\n[${variantName}] STAGE 1 (fills ranks 1..${w.stage1Cutoff}, weights: demo=${w.stage1.demo_quality} role=${w.stage1.role_relevance} depth=${w.stage1.technical_depth} metric=${w.stage1.metric_strength}):`,
  );
  printScoreRows(base.stage1Scored);
  console.log(`  → winners (fill ranks 1..${w.stage1Cutoff}): ${base.stage1Scored.slice(0, w.stage1Cutoff).map((c) => c.entry.id).join(", ")}`);

  console.log(
    `\n[${variantName}] STAGE 2 (ranks ${w.stage1Cutoff + 1}.., weights: demo=${w.stage2.demo_quality} role=${w.stage2.role_relevance} depth=${w.stage2.technical_depth} metric=${w.stage2.metric_strength}):`,
  );
  printScoreRows(base.stage2Scored);

  console.log(`\n[${variantName}] combined final order: ${base.scoredProjects.map((c) => c.entry.id).join(", ")}`);
  if (base.forcedCollapse.length > 0) {
    console.log(`  (force-collapsed, surface=repo_only, never ranked as full entries: ${base.forcedCollapse.map((e) => e.id).join(", ")})`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const resumeData = loadJson(path.join(ROOT, "content", "resume-data.json"));
  const certifications = loadJson(path.join(ROOT, "content", "certifications.json"));
  const variantPath = path.join(ROOT, "variants", `${args.variant}.json`);
  if (!fs.existsSync(variantPath)) {
    console.error(`No such variant: variants/${args.variant}.json`);
    process.exit(2);
  }
  const variant = loadJson(variantPath);

  const base = selectForVariant(resumeData, certifications, variant);
  printRankingTable(args.variant, base);

  // Static lints — independent of the page-fit loop, fail fast.
  const staticViolations = [
    ...lint.lintSummary(base.summary),
    ...lint.lintCertifications(base.certifications),
    ...lint.lintCertificationKind(base.certifications),
    ...lint.lintHeadlineMetricNoParens(resumeData.entries.filter((e) => e.section === "project")),
    ...lint.lintArtifactUrl(resumeData.entries.filter((e) => e.section === "project")),
    ...lint.lintNoRawTestCounts(resumeData.entries),
  ];
  if (staticViolations.length > 0) {
    console.error(`\n[FAIL] ${args.variant}: static lint violations (before any render):`);
    staticViolations.forEach((v) => console.error(`  - ${v}`));
    process.exit(1);
  }

  fs.mkdirSync(BUILD_DIR, { recursive: true });
  fs.mkdirSync(REPORTS_DIR, { recursive: true });

  const backend = detectPdfBackend();
  if (!backend) {
    console.error(
      "\n[FAIL] page-count gate unavailable: neither soffice (LibreOffice) nor Word COM " +
        "(WINWORD.EXE + the docx2pdf Python package) was found. The hard max_pages gate requires " +
        "a real rendered page count — refusing to emit an unverified PDF or pass max_pages by " +
        "assumption. Install LibreOffice or Microsoft Word + `python -m pip install docx2pdf` " +
        "before running this build.",
    );
    process.exit(1);
  }
  console.log(`\n[${args.variant}] PDF backend: ${backend.kind}${backend.bin ? ` (${backend.bin})` : ""}`);

  // Item A: reason every collapsed entry ends up collapsed, distinctly, so
  // the build never trims (by cap or by page-fit) without saying which
  // entries and why. Never a bare silent .pop().
  const collapseReasons = new Map(); // id -> reason string
  let includedProjects = base.scoredProjects.slice(); // best-first
  let includedResearch = base.scoredResearch.slice(); // best-first
  let collapsedEntries = base.forcedCollapse.slice();
  for (const e of base.forcedCollapse) collapseReasons.set(e.id, `surface=repo_only, never a full entry`);

  const maxFullEntries = variant.max_full_entries ?? DEFAULT_MAX_FULL_ENTRIES;
  if (includedProjects.length > maxFullEntries) {
    const overCap = includedProjects.slice(maxFullEntries);
    includedProjects = includedProjects.slice(0, maxFullEntries);
    for (const c of overCap) {
      collapsedEntries.push(c.entry);
      collapseReasons.set(c.entry.id, `max_full_entries cap (${maxFullEntries}): ranked below the top ${maxFullEntries} in the two-stage order`);
    }
    console.log(
      `\n[${args.variant}] max_full_entries cap (${maxFullEntries}): collapsed ${overCap.length} project(s) into "More on GitHub": ${overCap.map((c) => c.entry.id).join(", ")}`,
    );
  }

  let result = null;

  while (true) {
    const projects = includedProjects.map((c) => c.entry);
    const research = includedResearch.map((c) => c.entry);
    const { line: collapsedLine, tooLong: collapsedLineTooLongAtBuildTime } = buildCollapsedLine(collapsedEntries, base.weights);
    const selection = {
      header: base.header,
      summary: base.summary,
      experience: base.experience,
      research,
      projects,
      collapsedLine,
      skills: base.skills,
      education: base.education,
      certifications: base.certifications,
    };

    result = await renderAndCountPages(selection, args.variant, backend);
    console.log(`[${args.variant}] attempt: ${projects.length} projects, ${research.length} research, ${result.pages} page(s)`);

    if (result.pages <= variant.max_pages) {
      // Final hard-gate lints, on exactly what got rendered.
      const renderedEntries = [...base.header, base.summary, ...base.experience, ...research, ...projects, ...base.skills, ...base.education].filter(Boolean);
      const violations = [
        ...lint.lintSurfaceGate(projects),
        ...lint.lintUnverified(renderedEntries, args.allowUnverified),
        ...lint.lintResearchStatus(research),
        ...lint.lintMoreOnGithubLine(collapsedLine),
      ];
      if (violations.length > 0) {
        console.error(`\n[FAIL] ${args.variant}: hard-gate violations on final render:`);
        violations.forEach((v) => console.error(`  - ${v}`));
        process.exit(1);
      }
      break;
    }

    if (includedProjects.length > 0) {
      const dropped = includedProjects.pop(); // lowest weighted score
      collapsedEntries.push(dropped.entry);
      collapseReasons.set(dropped.entry.id, `page-fit overflow: ${result.pages} pages > ${variant.max_pages}-page limit, dropped as the lowest-ranked remaining full entry`);
      console.log(`  -> dropped "${dropped.entry.id}" to fit the page limit (${collapseReasons.get(dropped.entry.id)})`);
    } else if (includedResearch.length > 0) {
      const dropped = includedResearch.pop(); // research has no "More on GitHub" equivalent — just drops
      console.log(`  -> dropped research entry "${dropped.entry.id}" to fit the page limit (page-fit overflow, no projects left to drop)`);
    } else {
      console.error(`[FAIL] ${args.variant}: cannot fit within ${variant.max_pages} page(s) even with zero projects/research included.`);
      process.exit(1);
    }
  }

  const finalProjects = includedProjects.map((c) => c.entry);
  const finalResearch = includedResearch.map((c) => c.entry);
  const { line: finalCollapsedLine } = buildCollapsedLine(collapsedEntries, base.weights);

  console.log(`\n[${args.variant}] rendered as full entries (${finalProjects.length}): ${finalProjects.map((e) => e.id).join(", ")}`);
  console.log(`[${args.variant}] collapsed into "More on GitHub" (${collapsedEntries.length}):`);
  for (const e of collapsedEntries) {
    console.log(`  - ${e.id}: ${collapseReasons.get(e.id) || "(reason not recorded)"}`);
  }
  const finalSelection = {
    header: base.header,
    summary: base.summary,
    experience: base.experience,
    research: finalResearch,
    projects: finalProjects,
    collapsedLine: finalCollapsedLine,
    skills: base.skills,
    education: base.education,
    certifications: base.certifications,
  };
  const renderedText = extractRenderedText(finalSelection);
  const coverage = variant.jd_keywords.map((kw) => ({
    keyword: kw,
    present: renderedText.toLowerCase().includes(kw.toLowerCase()),
  }));
  const presentCount = coverage.filter((c) => c.present).length;

  const reportLines = [
    `# Keyword coverage — ${args.variant}`,
    "",
    `Target role: ${variant.target_role}`,
    `Pages: ${result.pages}/${variant.max_pages} · Projects included: ${finalSelection.projects.length} · Collapsed to "More on GitHub": ${collapsedEntries.length} · Research included: ${finalSelection.research.length}`,
    finalCollapsedLine ? `"More on GitHub" line (${finalCollapsedLine.length}/200 chars): ${finalCollapsedLine}` : `"More on GitHub" line: (none — every eligible project fit)`,
    "",
    `## Full entries (${finalProjects.length}, max_full_entries=${maxFullEntries})`,
    ...finalProjects.map((e) => `- ${e.id}`),
    "",
    `## Collapsed into "More on GitHub" (${collapsedEntries.length})`,
    ...collapsedEntries.map((e) => `- ${e.id}: ${collapseReasons.get(e.id) || "(reason not recorded)"}`),
    "",
    `**${presentCount}/${coverage.length} JD keywords present**`,
    "",
    "| Keyword | Present |",
    "|---|---|",
    ...coverage.map((c) => `| ${c.keyword} | ${c.present ? "✅" : "❌ missing"} |`),
  ];
  const reportPath = path.join(REPORTS_DIR, `resume-coverage-${args.variant}.md`);
  fs.writeFileSync(reportPath, reportLines.join("\n") + "\n");

  console.log(`\n[OK] ${args.variant}: ${result.pages} page(s), ${presentCount}/${coverage.length} keywords covered.`);
  console.log(`  docx: ${result.docxPath}`);
  console.log(`  pdf:  ${result.pdfPath}`);
  console.log(`  coverage report: ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
