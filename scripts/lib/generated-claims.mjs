// Freshness verdict for a case-study claim whose number is GENERATED into a committed snapshot
// (e.g. content/generated/hf-downloads.json) rather than typed by hand. Extracted from
// scripts/check-metric-freshness.mjs so it can be unit-tested without that script's network
// side effects. Fails closed: an unreadable snapshot, or displayed text that does not carry the
// snapshot's figures, is reported as GENERATED_UNREADABLE, never as current.

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {string} root repo root the snapshot path is relative to
 * @param {string} rel snapshot path relative to root
 * @param {string} displayedText the exact text the site shows for the claim (value + detail)
 * @param {number} overdueDays snapshot age beyond which the weekly refresh is deemed not landing
 * @param {number} [nowMs] injectable clock for tests
 * @returns {{status: "GENERATED" | "GENERATED_OVERDUE" | "GENERATED_UNREADABLE", detail: string}}
 */
export function checkGeneratedClaim(root, rel, displayedText, overdueDays, nowMs = Date.now()) {
  let snap;
  try {
    snap = JSON.parse(readFileSync(join(root, rel), "utf8"));
  } catch (err) {
    return { status: "GENERATED_UNREADABLE", detail: `${rel}: ${err.message}` };
  }
  const shown = (snap.models ?? []).map((m) => m.downloads).join(" · ");
  if (!snap.fetchedAt || !shown || !displayedText.includes(shown)) {
    return {
      status: "GENERATED_UNREADABLE",
      detail: `${rel}: displayed text does not carry the snapshot's figures ("${shown}") or fetchedAt is missing`,
    };
  }
  const ageDays = Math.floor((nowMs - new Date(snap.fetchedAt).getTime()) / 86_400_000);
  if (ageDays > overdueDays) {
    return {
      status: "GENERATED_OVERDUE",
      detail: `${rel} fetched ${snap.fetchedAt}, ${ageDays} days ago (> ${overdueDays}): the weekly refresh PR has not landed`,
    };
  }
  return { status: "GENERATED", detail: `${rel} fetched ${snap.fetchedAt} (${ageDays}d ago)` };
}
