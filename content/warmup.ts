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
      "Checked 2026-08-11: 22.8s cold (confirmed genuinely idle via Cloud Logging, no prior request in the preceding 40 minutes), 0.43s warm repeat.",
  },
  "style-maitri": {
    slug: "style-maitri",
    name: "Style Maitri",
    // URL corrected 2026-08-25: the GCP sole-identity migration (CLAUDE.md rule 55c)
    // redeployed this service under a new project (stylemaitri-prod-260813), which
    // changed the Cloud Run URL's project-number segment. The old URL
    // (asa-stylist-api-657468372797...) now 404s at the GFE level -- confirmed via
    // direct curl, not assumed. The live stylemaitri.vercel.app frontend already
    // calls the correct new URL (verified via a real page load, 200 on /api/brand),
    // so this only affects this bridge page's own probe target, not the actual demo.
    // expectedWakeSeconds/sourceNote below are carried over from the pre-migration
    // deployment (same container image) and have NOT been re-measured against this
    // URL -- flagged, not silently presented as current.
    healthUrl: "https://asa-stylist-api-631709154646.asia-south1.run.app/",
    destinationUrl: "https://stylemaitri.vercel.app",
    repoUrl: "https://github.com/gaurav-gandhi-2411/agentic-shopping-assistant",
    expectedWakeSeconds: 56,
    gpuBacked: false,
    sourceNote:
      "Checked 2026-08-11 against the pre-migration URL: 55.7s cold (confirmed genuinely idle via Cloud Logging, 18m17s since the prior request, no traffic in between), 0.11s warm repeat. URL updated 2026-08-25 after the GCP migration moved the service to a new project; not re-measured under the new URL.",
  },
  dealhunter: {
    slug: "dealhunter",
    name: "DealHunter",
    // URL corrected 2026-08-25: same migration-driven project-number change as
    // style-maitri above (new project dealhunter-prod-260812). The old URL
    // (agentic-travel-booking-api-prod-646079085526...) now 404s at the GFE level --
    // confirmed via direct curl. New URL's /health verified live:
    // {"status":"ok","phase":"C","cache":"ok"}.
    healthUrl: "https://agentic-travel-booking-api-prod-924018794868.asia-south1.run.app/health",
    // Production audit (2026-08-22): this pointed at the bare Vercel domain,
    // which is the site's marketing/waitlist splash ("Building in public",
    // no search box) — not the actual interactive demo. The real agent demo
    // lives at /demo (apps/web/app/demo/page.tsx, DemoClient.tsx), branded
    // "DealHunter" same as this portfolio. GG's launch review: "Try
    // DealHunter" led nowhere useful even before the retired-model bug.
    destinationUrl: "https://agentic-travel-booking-system.vercel.app/demo",
    repoUrl: "https://github.com/gaurav-gandhi-2411/agentic-travel-booking-system",
    expectedWakeSeconds: 20,
    gpuBacked: false,
    sourceNote:
      "Checked 2026-08-11 against the pre-migration URL: 19.4s cold (confirmed genuinely idle via Cloud Logging, no prior request in the preceding 16 hours), 0.12s warm repeat. URL updated 2026-08-25 after the GCP migration moved the service to a new project; not re-measured under the new URL.",
  },
};

export function getWarmupConfig(slug: string): WarmupConfig | undefined {
  return warmupConfigs[slug];
}
