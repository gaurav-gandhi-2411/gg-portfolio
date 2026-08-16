import type { CaseStudy } from "../types";

// Sources: reclaim repo (README.md, docs/CASE_STUDY.md, PLAN.md,
// docs/architecture/adr/0001, 0002, 0006, 0008, 0009, 0010, 0023, 0024,
// reclaim-spec.md, reclaim-ai-features-spec.md, evals/test_safe_mode_gate.py,
// tests/frontend/xss.test.mjs) — see provenance.md's reclaim section.
export const reclaim: CaseStudy = {
  slug: "reclaim",
  verifiedAt: "2026-07-31", // wave 19 -- last re-checked against source this session
  title: "Reclaim",
  dek: "A Windows disk-cleanup tool that only ever deletes by deterministic rule, never by model score, proved its own safety net by surviving a real incident where its own delete run hit three shared Python environments, recovered every file, and rebuilt detection to be structural rather than pattern-based.",
  depth: "full",
  problem: [
    "A Windows disk that's nearly full turns cleanup into a bet: delete the wrong thing, a config file that looks unused, a cache a build tool secretly still reads from, and something breaks, sometimes not until days later. Most cleanup tools resolve that tension by either being too conservative to free real space, or by trusting a model's \"this looks safe\" score enough to just act on it.",
    "Reclaim resolves it a different way: nothing is ever proposed for deletion by a model, only by a deterministic rule (an exact path pattern, a file extension, a byte-identical hash match), and every one of those rules still has to pass a deny-first safety gate before it can even be shown to the user. The project's real subject isn't the disk-cleanup feature, it's what it actually costs, in real bugs found and estimates corrected, to earn the right to call a delete \"safe.\"",
  ],
  approach: [
    "A scan builds a local, read-only SQLite index of a drive, nothing is touched yet. Deterministic detectors then query that index for candidates: files whose path matches a known-safe pattern (a build tool's cache directory), files with a known-disposable extension, or files that are byte-for-byte identical to another file already being kept. Every candidate passes through SafetyValidator, a deny-first gate that excludes protected system roots, git repositories, protected file extensions, database and VM disk files, Docker/WSL roots, and cloud-sync placeholders, a BLOCKED verdict means the file is excluded entirely, never just downgraded to a lower-priority tier.",
    "What happens to a file once it's approved depends on its category, not the run. Caches a build tool can regenerate with one command (a package manager's cache, browser temp files, crash dumps, dev-environment artifacts) are deleted permanently, because their real recovery path was always the rebuild command, not a backup copy. Everything else, including every exact-duplicate match, moves into a recoverable vault or the Windows Recycle Bin, with a manifest that supports restoring an entire batch by ID. Nothing on disk changes at all unless the user passes an explicit `--apply` flag; the default is always a dry-run report.",
    "An applied-AI layer sits beside the deterministic engine, bundled directly into the public installer by default since a July 2026 rework (ADR-0030) replaced torch with ONNX-converted models, cutting the AI footprint from roughly 1GB down to under 200MB. It finds near-duplicate photos with a perceptual hash (pHash, a fingerprint that stays similar for visually similar images, compared by Hamming distance, the number of bits that differ between two fingerprints), backed by OpenCLIP for semantic grouping (finding photos of the same *kind* of thing, like two different beach photos, not just copies of the same photo). It groups near-duplicate documents with MinHash text-shingle prefiltering (a fast way to estimate how similar two documents are without comparing every word) plus a sentence-embedding confirmation pass, classifies screenshots so an OCR failure never gets silently read as \"safe to delete,\" and ranks review-queue items with a small model trained on cross-LLM-labeled data. None of it can delete anything on its own, every AI-produced suggestion goes through the exact same human confirmation and SafetyValidator check as everything else, and the AI layer's own output types are structurally incompatible with the code path that actually deletes files.",
  ],
  architecture: {
    intro:
      "A deterministic engine handles every actual deletion; an optional AI layer only ever recommends, and is structurally unable to touch the filesystem itself.",
    stages: [
      {
        label: "Scan",
        kind: "input",
        detail: "read-only walk of every fixed drive into a local SQLite inventory index, no filesystem changes",
      },
      {
        label: "Deterministic detectors",
        detail: "path pattern, extension, and byte-identical hash rules propose candidates, never a model score",
      },
      {
        label: "SafetyValidator",
        detail:
          "deny-first gate: protected roots, git repos, protected extensions, DB/VM files, Docker/WSL roots, cloud-sync placeholders, BLOCKED means excluded, not downgraded",
      },
      {
        label: "Tiered candidates",
        detail:
          "dry-run report by default; retention is a property of the category, rebuild-recoverable caches delete permanently, everything else stays vault- or Recycle-Bin-recoverable",
      },
      {
        label: "AI layer (bundled by default)",
        detail: "recommend-only, structurally unable to call the delete path",
        parallel: [
          { label: "Near-dup images", detail: "pHash + OpenCLIP semantic grouping" },
          { label: "Document near-dup", detail: "MinHash prefilter + sentence-embedding confirmation" },
          { label: "Screenshot/OCR classifier", detail: "content-tag scorer, biased toward keep" },
          { label: "Clutter-likelihood ranker", detail: "LightGBM LambdaMART, cross-LLM-labeled" },
        ],
      },
      {
        label: "Apply",
        detail:
          "dry-run unless --apply; safe mode (default for every install) forces Recycle-Bin-only + the riskiest categories off, regardless of config",
      },
      {
        label: "Quarantine & Restore",
        kind: "output",
        detail: "vault/Recycle-Bin batch, restorable by batch ID, or Windows' own Recycle Bin under safe mode",
      },
    ],
    note: "The public installer (Nuitka + Inno Setup) bundles the AI layer by default as of ADR-0030, torch was dropped in favor of ONNX-converted CLIP + MiniLM models (199.4MB total), for a 309.3MB installer and an 884.0MB installed footprint. This supersedes the project's earlier core/optional-extra split (ADR-0024).",
  },
  decisions: [
    {
      title: "AI recommends, it never deletes, enforced structurally, not by convention",
      body: "The AI layer's output types (AICluster/AIClusterMember) deliberately share zero field names with the deterministic engine's Candidate object, the executor accesses candidate.safety_verdict unconditionally on every item it's handed, so passing it an AI-produced object raises an AttributeError before any filesystem call, not because a rule was followed but because the object literally doesn't have the field. A static scan re-checks every AI-layer file on every CI run for an import of the delete-executing code, and a pydantic \"extra=forbid\" config model rejects any attempt to inject an AI-named category into the auto-apply path.",
      sourceRef: "reclaim:ai-layer-boundary",
    },
    {
      title: "Retention is a property of the category, not the run",
      body: "An early build vaulted everything uniformly, real and recoverable, but a same-volume move measures as a 0-byte disk-free delta, which meant the project's own top-level success bar (reclaiming real, measured disk space) was structurally unreachable. The fix made retention a per-category property instead: caches whose only real recovery path was always \"rebuild it\" delete permanently; everything else, including every exact-duplicate candidate, stays vault- or Recycle-Bin-recoverable.",
      sourceRef: "reclaim:architecture",
    },
    {
      title: "Hardlink- and structure-aware accounting, because byte-identical isn't the same as reclaimable",
      body: "A \"duplicate\" can be a hardlink to its own keep copy (0 bytes actually freed), or a byte-identical file inside a shared Python interpreter build that a dozen unrelated tools depend on. Crediting a candidate's full size only when every name pointing to its inode is in the same delete set (hardlink-aware accounting) took the exact-duplicate reclaimable estimate from ~48GB to 23.09GB; excluding model caches and live environments from generic duplicate detection took it to 4.26GB, the largest single correction in the project's honesty arc, and every correction moved the number down, never up.",
      sourceRef: "reclaim:honesty-arc",
    },
    {
      title: "Never pool a metric across a declared distribution tier",
      body: "A remeasurement of the document near-duplicate detector reported 95.24% precision pooled across a large, easy prose tier and a small, hard templated-document tier, comfortably above the 95% target. The templated tier alone, at the identical threshold, was actually 86.34% precision: a real 71%-false-positive failure the large tier's thousands of clean negatives had mathematically diluted into invisibility. The fix wasn't a better threshold; it was a structural one, the eval harness gained functions with no code path capable of concatenating counts across tiers before computing a ratio, and the incident itself became a permanent regression test.",
      sourceRef: "reclaim:pooling-bug",
    },
    {
      title: "Safe mode ships as the default the moment strangers, not just the author, can run it",
      body: "Every safety mechanism up to this point had been built and measured against one disk, watched by the person who wrote the code. A public installer changes that audience, so safe mode became three independent, structurally-proven guarantees rather than one flag: permanent delete is unreachable in code whenever mode is safe (proven by monkeypatching os.unlink and shutil.rmtree to raise if ever called), the three highest-risk category groups are forced off regardless of what a config file requests, and every apply must be an explicit, human-picked list of paths, never a one-click \"apply everything.\" The same proof was run twice against the actual compiled installer, not just the source tree.",
      sourceRef: "reclaim:safe-mode-installer",
    },
  ],
  results: [
    {
      label: "Real disk-free reclaimed (measured before/after, three real applies)",
      value: "33.73GB (36,216,430,592 bytes)",
      detail: "independently cross-checked byte-for-byte against the actual filesystem, not just each apply's own report",
      sourceRef: "reclaim:honest-metrics",
    },
    {
      label: "Exact-duplicate reclaimable estimate, across 3 correctness fixes",
      value: "~48GB → 23.09GB → 4.26GB → 3.92GB, never corrected upward",
      detail: "3.92GB is net of 186 files restored after the capstone incident below; still pending in the Recycle Bin, not yet freed",
      sourceRef: "reclaim:honesty-arc",
    },
    {
      label: "Near-dup image recall, adversarial data vs. the realistic distribution the feature is actually for",
      value: "7.64% (Copydays \"strong\" adversarial split) vs. 100.00% (realistic resave/resize/messaging-app duplicates)",
      detail: "both numbers are real and measured at the same threshold, the low one was answering the wrong question, and it's reported anyway rather than only the flattering one",
      sourceRef: "reclaim:phash-measurement",
    },
    {
      label: "Clutter-likelihood ranker, cross-LLM-labeled, permanently provisional",
      value: "Fleiss' κ = 0.6768 (N=120); trained on the 79/120 (65.8%) unanimous subset only",
      detail: "NDCG@5 0.9763 / precision@3 1.0000 on held-out batches, but the eval gate refuses to ever call this MEASURED, the labels are LLM-consensus on synthetic data, not real user decisions",
      sourceRef: "reclaim:ranker-consensus",
    },
    {
      label: "Filename-driven XSS in the review UI, found and closed",
      value: "0 innerHTML assignments carry a path field anywhere in the codebase today",
      detail: "the one bug in this project's own review UI, not the deletion engine, the screen a human is supposed to trust before confirming a delete was itself exploitable via a maliciously-named file",
      sourceRef: "reclaim:xss-finding",
    },
  ],
  story: {
    title: "Recovered 186 files from three shared dev environments after its own delete run hit them, then rebuilt detection so it wouldn't depend on knowing what to look for",
    body: [
      "The exact-duplicate estimate had already been corrected twice by the time a real apply of exact-duplicate candidates ran for real. Within minutes, this project's own development environment stopped working: a basic `import socket` started failing. The investigation found 186 files across three shared Python installations, a package-manager-built Python, a cloud SDK's bundled Python, and a mobile toolchain's own Python, had been sent to the Recycle Bin. None of the three was recognized as a protected \"environment\" by the existing check, because none of them had the marker files (a conda metadata folder, a venv config file) the check was looking for.",
      "A first, keyword-driven recovery pass found and restored 71 files and looked complete. It wasn't. A systematic re-audit, re-running the fixed detector against every one of the 10,134 applied files, not just the paths a keyword search thought to check, found 186 true violations, not 71. All 186 were recovered by parsing the Windows Recycle Bin's own internal index format directly, since Reclaim's own restore command didn't support restoring Recycle Bin batches at all.",
      "The fix landed twice, not once: first a marker-based check (an interpreter executable plus a sibling library folder), then a second pass that root-caused why marker-based detection would always be incomplete and replaced it with structural detection by default, a check that, run against Reclaim's own development environment, found that Windows virtual environments put their interpreter in a `Scripts/` subfolder, not the environment root, meaning even the first fix would have missed an environment whose own config file ever went missing. The write-up is explicit that this doesn't prove the class of risk is closed.",
      "What actually saved this incident wasn't the detector, the recovery script, or the second fix, it was choosing the Recycle Bin specifically for its recoverability, before anyone knew it would be the thing that mattered. That choice is the difference between this being a paragraph in a case study and a rebuilt development machine.",
    ],
    sourceRef: "reclaim:bug-trail",
  },
  closing: [
    "If you're building any tool that deletes, moves, or mutates a user's files, this is the design worth copying: make the recoverable path the default until you've earned trust in the risky one, and choose reversibility before you know it'll be the thing that saves you, not after.",
  ],
  links: [
    {
      label: "Download latest release",
      href: "https://github.com/gaurav-gandhi-2411/reclaim/releases/latest",
    },
    { label: "Source on GitHub", href: "https://github.com/gaurav-gandhi-2411/reclaim" },
  ],
};
