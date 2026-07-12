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
}

export interface ResearchPaper {
  title: string;
  abstract: string;
  arxivUrl?: string;
  repoUrl: string;
  pdfUrl?: string;
  status: "preprint-pending" | "live";
  sourceRef: string;
}
