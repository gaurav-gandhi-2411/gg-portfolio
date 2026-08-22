// Shared content types. Every displayed number/claim carries a `sourceRef` —
// an ID matching a row in content/provenance.md. No sourceRef, no ship (rule 65b).

export interface ExperienceBullet {
  text: string;
  sourceRef: string;
  /** Shown on the page (wave 6 shows a tightened selection; the resume carries the rest). */
  featured?: boolean;
}

export interface ExperienceSubRole {
  title: string;
  dateRange: string;
  bullets: ExperienceBullet[];
}

export interface ExperienceEntry {
  company: string;
  companyDetail?: string;
  dateRange: string;
  location: string;
  subRoles?: ExperienceSubRole[];
  bullets?: ExperienceBullet[];
  techChips: string[];
}

export interface ProductMetric {
  label: string;
  value: string;
  sourceRef: string;
}

/**
 * Wave 13 — project categories for the work filters. Multi-tag per
 * project; ids are the URL vocabulary (?category=llm-agents), labels are
 * the visible pill text. `as const` + derived union per rule 15.
 */
export const CATEGORIES = [
  { id: "llm-agents", label: "LLM & Agents" },
  { id: "retrieval", label: "Retrieval & Embeddings" },
  { id: "vision", label: "Vision & Generative" },
  { id: "forecasting", label: "Forecasting & Tabular" },
  { id: "evals-research", label: "Evals & Research" },
  { id: "tooling", label: "Developer Tooling" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

/**
 * Structured data behind a flagship row's eval figure (wave 7). Every value
 * must mirror the row's `metric` — same numbers, same claim, same sourceRef
 * (rule 65b): the figure is the metric drawn, never a second source of truth.
 */
export type ProductFigure =
  | { kind: "dumbbell"; from: number; to: number; scaleNote: string }
  | { kind: "bar"; pct: number; valueText: string }
  | { kind: "bars"; rows: { name: string; pct: number }[] };

export interface Product {
  slug: string;
  name: string;
  tagline: string;
  liveUrl?: string;
  repoUrl?: string;
  metric?: ProductMetric;
  secondaryMetric?: ProductMetric;
  /**
   * Wave 13 — the flagship/secondary tiering is retired (GG: every project
   * presents strongly, no second-class treatment). Projects are ordered by
   * AI/ML depth in content/products.ts and tagged with categories instead.
   */
  categories: CategoryId[];
  techChips?: string[];
  pypi?: { packageName: string; installCommand: string; badgeUrl: string };
  /** The metric, drawn — values must match `metric`, see ProductFigure. */
  figure?: ProductFigure;
}

/**
 * One stage of an architecture flow diagram (wave 12). Rendered by
 * components/flow-diagram.tsx as a vertical flow of boxes — `parallel`
 * renders side-by-side sub-boxes inside the stage (e.g. FAISS + BM25).
 * Only components that actually exist in the repo may appear here.
 */
export interface FlowStage {
  label: string;
  detail?: string;
  parallel?: { label: string; detail?: string }[];
  kind?: "input" | "stage" | "output";
}

/**
 * One point on a step-curve diagram (wave 17) — a metric's value after a
 * named method change, e.g. AgentGauge's minimum-detectable-effect curve
 * across three estimator changes. Rendered by components/step-curve.tsx.
 */
export interface CurvePoint {
  label: string;
  value: number;
  detail?: string;
}

/**
 * A /work/[slug] case-study page (wave 12). Written for a novice reader:
 * plain language, jargon explained in place. Every metric row carries a
 * sourceRef into content/provenance.md (rule 65b) — no sourceRef, no ship.
 */
export interface CaseStudy {
  slug: string;
  /**
   * Wave 19 — the last date every number/claim on this page was actually
   * re-checked against its source repo(s), as YYYY-MM-DD. NOT derived from
   * git, and NOT the same thing as "this file was recently edited."
   *
   * The incident this field exists to prevent: wave 15's commit 24a258d
   * touched every case study's `dek`/`story.title` for a site-wide framing
   * pass ("every dek... now opens with the capability/action demonstrated
   * ... every number [is] unchanged" — the commit's own message). That
   * commit landed 2026-07-26, two days AFTER triageiq's cited source
   * (`triage-iq` ADR-0035/0036) had already superseded the exact numbers
   * the page still displayed. The page's git-mtime said "fresh." It
   * wasn't. Nothing distinguished a copy-only touch from a real
   * verification pass — see docs/verified-at-rule.md if that file exists,
   * or content/provenance.md's wave-19 section, for the full postmortem.
   *
   * THE RULE: bump this date ONLY when you have gone back to the source
   * repo(s) this page cites and confirmed each number still matches
   * current reality. Editing prose, fixing a typo, reframing a dek,
   * reordering sections, adding a screenshot — none of that advances this
   * date, no matter how recent the commit touching this file is. If
   * you're not sure whether what you just did counts, it doesn't: re-check
   * the numbers against source first, then bump the date.
   *
   * scripts/check-metric-freshness.mjs's `verified-staleness` check reads
   * this field weekly and flags any case study whose verifiedAt is more
   * than 30 days old — independent of whether it also detects a numeric
   * drift. Staleness of verification is itself the signal: a page can have
   * no detected drift and still be overdue for a real re-check.
   */
  verifiedAt: string;
  /** Page h1 — the product name. */
  title: string;
  /** One-line dek under the title. */
  dek: string;
  /** Full pages get every section; short pages may omit architecture/decisions. */
  depth: "full" | "short";
  /** What real problem this solves and who it helps. Paragraphs. */
  problem: string[];
  /** How it works end-to-end, novice-readable. Paragraphs. */
  approach: string[];
  architecture?: { intro?: string; stages: FlowStage[]; note?: string };
  /** Model/method choices and why — the teaching core. */
  decisions?: { title: string; body: string; sourceRef: string }[];
  /** Sourced metrics, including the honest/unflattering ones. */
  results?: {
    label: string;
    value: string;
    detail?: string;
    sourceRef: string;
    /**
     * "prose" typesets `value` as readable body text instead of the huge
     * display numeral every other result gets — for a value that is
     * genuinely a sentence/finding rather than a number, ratio, or short
     * measured quantity (production audit, 2026-08-22: several case
     * studies had full sentences set at display-numeral size, which reads
     * as a fabricated-looking metric). Omit for anything that IS a short
     * number/ratio/quantity, which is most rows and stays the default.
     */
    format?: "prose";
  }[];
  /** The hardest documented engineering/debugging story. */
  story?: {
    title: string;
    /**
     * A plain string uses the story's own `sourceRef` below. A paragraph
     * that makes a claim really evidenced by a DIFFERENT, existing citation
     * (a topic shift mid-story, not just restated context) carries its own
     * `{ text, sourceRef }` instead — reuse the real sourceRef for that
     * claim elsewhere on the page rather than inventing a new one. Found
     * 2026-08-07 via agentgauge:v23-scoring-artifact (a second, distinct
     * finding two paragraphs in, actually evidenced by
     * agentgauge:attribution-kill's own citation) and mmfr:collapse-fix (a
     * third paragraph's scaling-budget figure actually evidenced by
     * mmfr:faiss-adr's own citation) — both stories shared one sourceRef
     * across topics its own citation never covered.
     */
    body: (string | { text: string; sourceRef: string })[];
    sourceRef: string;
    /**
     * An optional opening sentence sourced separately from the rest of the
     * story — for when the story's lead-in restates a fact that's really
     * evidenced by a different claim's own citation (e.g. an intent-accuracy
     * figure quoted as context before the story pivots to its own separate
     * finding). Keeps that restated number checkable against its own real
     * source instead of silently riding on the main story's sourceRef, which
     * would otherwise never mention it (found via style-maitri:live-audit,
     * 2026-08-07: the story's "93.8% intent accuracy" context line shared a
     * sourceRef with the adversarial-audit report, which was never about
     * intent accuracy and so never verified it).
     */
    leadIn?: { text: string; sourceRef: string };
  };
  /**
   * Wave 17 — an embedded step-curve chart for a metric that improves
   * across discrete, named method changes. Values must mirror the
   * matching `results` row (rule 65b: same numbers, same sourceRef).
   */
  diagram?: { title: string; unit: string; points: CurvePoint[]; caption: string; sourceRef: string };
  /**
   * Wave 15 — practical takeaway for someone evaluating whether to hire GG or
   * use the product. Synthesizes claims already sourced above; introduces no
   * new numbers, so no sourceRef required. Rendered under the fixed heading
   * "What this means if you need something similar".
   */
  closing?: string[];
  links: { label: string; href: string }[];
}

export interface ResearchPaper {
  title: string;
  abstract: string;
  /** Verbatim opening sentence of `abstract` — the thesis, for quiet display. */
  abstractExcerpt?: string;
  arxivUrl?: string;
  repoUrl: string;
  pdfUrl?: string;
  status: "preprint-pending" | "live";
  sourceRef: string;
}
