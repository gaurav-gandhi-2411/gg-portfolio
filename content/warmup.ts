/**
 * Config for /warmup/[service] (cold-start bridge pages). Each of these three
 * backends runs with min-instances=0 (scales to zero, $0 idle cost) and has no
 * existing keep-warm traffic, unlike TriageIQ/Samidha which stay warm via their
 * own cron/health-check traffic and so never need this page.
 *
 * expectedWakeSeconds is a measured cold start, not an estimate (rule 65b) —
 * see the sourceNote on each entry for how/when it was taken. failAfterSeconds
 * is exactly 2x expected, per GG's spec.
 */
export interface WarmupConfig {
  slug: string;
  /** Display name of the product being woken. */
  name: string;
  /** Polled with mode:'no-cors' — only "did the round trip complete" matters. */
  healthUrl: string;
  /** Where the visitor lands once the service responds. */
  destinationUrl: string;
  /** Repo link shown in the failure state. */
  repoUrl: string;
  /** Measured cold-start time in seconds — see sourceNote. */
  expectedWakeSeconds: number;
  /** True if the backend holds a GPU allocation (changes the copy). */
  gpuBacked: boolean;
  /** Where/how expectedWakeSeconds was measured. */
  sourceNote: string;
}

export const warmupConfigs: Record<string, WarmupConfig> = {
  aetherart: {
    slug: "aetherart",
    name: "AetherArt",
    // Custom domain mapped 2026-08-11 (Cloud Run Domain Mappings API, CNAME
    // aetherart -> ghs.googlehosted.com. in samidhareviews.xyz's Namecheap
    // DNS), verified with a valid Google Trust Services cert
    // (ssl_verify_result=0) before flipping off the raw Cloud Run URL, which
    // leaked the GCP project number.
    healthUrl: "https://aetherart.samidhareviews.xyz/",
    destinationUrl: "https://aetherart.samidhareviews.xyz/",
    repoUrl: "https://github.com/gaurav-gandhi-2411/AetherArt",
    expectedWakeSeconds: 23,
    gpuBacked: true,
    sourceNote:
      "Measured 2026-08-11: 22.8s cold (confirmed genuinely idle via Cloud Logging — no prior request in the preceding 40 minutes), 0.43s warm repeat.",
  },
  "style-maitri": {
    slug: "style-maitri",
    name: "Style Maitri",
    healthUrl: "https://asa-stylist-api-657468372797.asia-south1.run.app/",
    destinationUrl: "https://stylemaitri.vercel.app",
    repoUrl: "https://github.com/gaurav-gandhi-2411/agentic-shopping-assistant",
    expectedWakeSeconds: 56,
    gpuBacked: false,
    sourceNote:
      "Measured 2026-08-11: 55.7s cold (confirmed genuinely idle via Cloud Logging — 18m17s since the prior request, no traffic in between), 0.11s warm repeat. An initial attempt the same session exceeded a 60s probe ceiling with 24h prior idle — this is the clean re-measurement.",
  },
  dealhunter: {
    slug: "dealhunter",
    name: "DealHunter",
    healthUrl: "https://agentic-travel-booking-api-prod-646079085526.asia-south1.run.app/health",
    destinationUrl: "https://agentic-travel-booking-system.vercel.app",
    repoUrl: "https://github.com/gaurav-gandhi-2411/agentic-travel-booking-system",
    expectedWakeSeconds: 20,
    gpuBacked: false,
    sourceNote:
      "Measured 2026-08-11: 19.4s cold (confirmed genuinely idle via Cloud Logging — no prior request in the preceding 16 hours), 0.12s warm repeat.",
  },
};

export function getWarmupConfig(slug: string): WarmupConfig | undefined {
  return warmupConfigs[slug];
}
