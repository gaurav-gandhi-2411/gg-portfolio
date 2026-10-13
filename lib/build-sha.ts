import { execFileSync } from "node:child_process";

// Resolved once, while `next build` evaluates app/layout.tsx, so the SHA is baked into the static
// HTML of every route. The point is that "production serves main's HEAD" can be checked from the
// live page (scripts/check-prod-build-sha.mjs).
const SHA_RE = /^[0-9a-f]{40}$/;

const gitHead = (): string =>
  execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 5000,
  });

/**
 * VERCEL_GIT_COMMIT_SHA (set by Vercel at build) wins; else `git rev-parse HEAD`; else "dev".
 * Never throws: a missing git binary or a non-git checkout must not fail a build. Anything that
 * is not a 40-hex SHA is discarded rather than emitted into the page.
 */
export function resolveBuildSha(
  env: Record<string, string | undefined> = process.env,
  runGit: () => string = gitHead,
): string {
  const fromEnv = env.VERCEL_GIT_COMMIT_SHA?.trim().toLowerCase();
  if (fromEnv && SHA_RE.test(fromEnv)) return fromEnv;
  try {
    const fromGit = runGit().trim().toLowerCase();
    if (SHA_RE.test(fromGit)) return fromGit;
  } catch {
    // git missing or not a repository: fall through to the literal.
  }
  return "dev";
}
