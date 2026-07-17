// Shared content types. Every displayed number/claim carries a `sourceRef` —
// an ID matching a row in content/provenance.md. No sourceRef, no ship (rule 65b).

export interface Stat {
  value: string;
  label: string;
  sourceRef: string;
}

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

export interface ProductStoryLine {
  text: string;
  sourceRef: string;
}

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
  tier: "flagship" | "secondary";
  techChips?: string[];
  pypi?: { packageName: string; installCommand: string; badgeUrl: string };
  /** One-line "hard problem solved" — flagship cards only, sourced from provenance.md. */
  storyLine?: ProductStoryLine;
  /** The metric, drawn (flagship only) — values must match `metric`, see ProductFigure. */
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
 * A /work/[slug] case-study page (wave 12). Written for a novice reader:
 * plain language, jargon explained in place. Every metric row carries a
 * sourceRef into content/provenance.md (rule 65b) — no sourceRef, no ship.
 */
export interface CaseStudy {
  slug: string;
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
  results?: { label: string; value: string; detail?: string; sourceRef: string }[];
  /** The hardest documented engineering/debugging story. */
  story?: { title: string; body: string[]; sourceRef: string };
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
