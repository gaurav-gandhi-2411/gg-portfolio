import type { CaseStudy } from "../types";
import { aetherart } from "./aetherart";
import { agentgauge } from "./agentgauge";
import { dealhunter } from "./dealhunter";
import { expenseTracker } from "./expense-tracker";
import { goldRateTracker } from "./gold-rate-tracker";
import { mmfr } from "./multimodal-fashion-recommender";
import { reviewiq } from "./reviewiq";
import { shelfsense } from "./shelfsense";
import { styleMaitri } from "./style-maitri";
import { tracegauge } from "./tracegauge";
import { triageiq } from "./triageiq";
import { warmer } from "./warmer";

/**
 * Registry for /work/[slug] (wave 12). Keys match content/products.ts
 * slugs exactly — the routes, the cards, and the case studies share one
 * slug vocabulary.
 */
export const caseStudies: Record<string, CaseStudy> = {
  [warmer.slug]: warmer,
  [styleMaitri.slug]: styleMaitri,
  [triageiq.slug]: triageiq,
  [dealhunter.slug]: dealhunter,
  [shelfsense.slug]: shelfsense,
  [reviewiq.slug]: reviewiq,
  [mmfr.slug]: mmfr,
  [goldRateTracker.slug]: goldRateTracker,
  [aetherart.slug]: aetherart,
  [agentgauge.slug]: agentgauge,
  [tracegauge.slug]: tracegauge,
  [expenseTracker.slug]: expenseTracker,
};
