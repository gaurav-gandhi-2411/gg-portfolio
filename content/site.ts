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

export const heroStats: Stat[] = [
  {
    value: "9",
    label: "live AI products shipped under my own name",
    sourceRef: "derived:products-live-count",
  },
  {
    value: "50M+",
    label: "documents processed by a system I built",
    sourceRef: "resume:indium-ds-docunderstanding",
  },
  {
    value: "$10M+",
    label: "in measured annual cost savings",
    sourceRef: "resume:indium-ds-docunderstanding",
  },
];
