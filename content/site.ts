import { liveProductCount, products } from "./products";
import type { Stat } from "./types";

export const site = {
  name: "Gaurav Gandhi",
  role: "Senior Applied AI Scientist",
  tagline:
    "I build and ship AI products under my own name — and the production systems and research behind them.",
  status: "Open to Senior AI/ML roles",
  location: "Bengaluru, India",
  email: "gauravgandhi429@gmail.com",
  githubUrl: "https://github.com/gaurav-gandhi-2411",
  linkedinUrl: "https://www.linkedin.com/in/gauravgandhi03/",
  resumeUrl: "/resume.pdf",
  // Feature-flagged: AgentGauge paper has no arXiv ID yet (see content/research.ts).
  // Flip to the arXiv/Scholar URL once assigned (Wave 3).
  scholarUrl: undefined as string | undefined,
};

// Wave 5 positioning: hero stats are independent-work numbers only —
// employer-derived figures (50M docs, $10M savings) moved out of the hero
// entirely; they remain in the Experience section where they have context.
// TODO(GG): supply the two remaining independent-work stats. Until then the
// placeholders render as an em-dash + label so the scaffold is visibly
// incomplete rather than silently faked (rule 65b).
export const heroStats: Stat[] = [
  {
    value: String(liveProductCount(products)),
    label: "live AI products shipped under my own name",
    sourceRef: "derived:products-live-count",
  },
  {
    value: "—",
    label: "TODO: independent-work stat (GG to supply)",
    sourceRef: "todo:awaiting-gg",
  },
  {
    value: "—",
    label: "TODO: independent-work stat (GG to supply)",
    sourceRef: "todo:awaiting-gg",
  },
];
