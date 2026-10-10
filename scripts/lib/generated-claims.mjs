// Freshness verdict for a case-study claim whose number is GENERATED into a committed snapshot
// (content/generated/hf-downloads.json) rather than typed by hand. Lives here, not inline in
// scripts/check-metric-freshness.mjs, so it can be unit-tested without that script's network calls.
// Fails closed: an unreadable snapshot, or displayed text that does not carry the snapshot's
// figures, is GENERATED_UNREADABLE, never current.

import { readFileSync } from "node:fs";
import { join } from "node:path";

/** @returns {{status: "GENERATED" | "GENERATED_OVERDUE" | "GENERATED_UNREADABLE", detail: string}} */
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
      detail: `${rel}: displayed text lacks the snapshot's figures ("${shown}") or fetchedAt is missing`,
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
