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
  // Real account, verified 2026-07-18: 2 public models (AetherArt LoRAs) +
  // 4 Spaces. Linked as a profile; no download stat anywhere — the actual
  // cumulative count (112) is too small to present as a headline number.
  huggingfaceUrl: "https://huggingface.co/gauravgandhi2411",
  resumeUrl: "/resume.pdf",
  // Feature-flagged: AgentGauge paper has no arXiv ID yet (see content/research.ts).
  // Flip to the arXiv/Scholar URL once assigned (Wave 3).
  scholarUrl: undefined as string | undefined,
};

// Hero stats moved to components/sections/hero.tsx (wave 5): one of the three
// needs a live server fetch (Warmer's puzzle number via lib/live-data, which
// imports "server-only"), and this file is imported by a client component
// (command-palette.tsx, for site.email/githubUrl/etc.) — bundling a
// server-only import into that client component would break the build.
