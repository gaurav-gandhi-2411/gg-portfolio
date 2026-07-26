import "server-only";

import { execFileSync } from "node:child_process";

/**
 * Wave 15 — "last updated" per case study, derived from real git history
 * (the source file's own last commit date) rather than a hand-typed date
 * that would go stale the moment someone edits the file and forgets to
 * bump it. Runs at build time only. Fails soft to null (component renders
 * nothing) if git isn't available or the file has no history yet in a
 * shallow clone — never a build failure, never a fabricated date.
 */
export function getCaseStudyLastUpdated(slug: string): string | null {
  try {
    const out = execFileSync(
      "git",
      ["log", "-1", "--format=%cs", "--", `content/case-studies/${slug}.ts`],
      { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}
