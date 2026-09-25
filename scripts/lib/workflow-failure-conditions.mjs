// Pure detection logic for scripts/check-workflow-failure-conditions.mjs,
// extracted so it can be unit-tested directly against fixture strings
// instead of only ever running against whatever the live .github/workflows/
// files currently contain.
//
// WHY THIS EXISTS. chat-canary.yml's two "open the failure issue" steps used
// `if: steps.tooling.outcome == 'failure'` and
// `if: steps.tooling.outcome == 'success' && steps.probe.outcome == 'failure'`
// with no failure()/always()/cancelled() call anywhere in the expression.
// GitHub Actions implicitly prepends `success() &&` to any `if:` that does
// not itself reference a status-check function — so both conditions actually
// meant "…and the job hasn't failed yet", which is never true once the step
// they're inspecting for a *failure* has, in fact, failed. The result: every
// probe failure since 2026-09-23 (production returning 503) skipped both
// issue-opening steps and the canary went from "always green" straight to
// "silently green," the exact shape it exists to prevent (PR #196, 2026-08-23,
// replaced a working `if: failure()` with this).
//
// This checks for the same bug class anywhere in .github/workflows/: an `if:`
// that compares a step's `.outcome`/`.conclusion` (or a job's `.result`, same
// underlying trap for `needs.<job>.result == 'failure'`) against 'failure',
// with no failure()/always()/cancelled() call to keep the step reachable
// after something upstream has already failed.

/**
 * @param {string} content - raw YAML text of a workflow file
 * @returns {Array<{ line: number, expr: string }>}
 */
export function findRawIfExpressions(content) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const results = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(\s*)if:\s*(.*)$/);
    if (!match) continue;

    const [, indentStr, rest] = match;
    const indent = indentStr.length;
    const startLine = i + 1; // 1-indexed, for human-readable reporting

    const blockScalar = rest.match(/^[|>][+-]?\s*$/);
    if (blockScalar) {
      // Folded/literal block scalar (`if: >` / `if: |`): the expression is
      // every following line indented further than `if:` itself, joined back
      // into one string. Seen in this repo's dependabot-auto-merge.yml.
      const parts = [];
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        if (next.trim() === "") {
          j++;
          continue;
        }
        const nextIndent = next.length - next.trimStart().length;
        if (nextIndent <= indent) break;
        parts.push(next.trim());
        j++;
      }
      results.push({ line: startLine, expr: parts.join(" ") });
      i = j - 1;
      continue;
    }

    results.push({ line: startLine, expr: rest.trim() });
  }

  return results;
}

const OUTCOME_COMPARISON =
  /\.(outcome|conclusion)\s*==\s*['"]failure['"]|\.result\s*==\s*['"]failure['"]/;
const STATUS_FUNCTION = /\b(failure|always|cancelled)\s*\(/;

/**
 * @param {string} content - raw YAML text of a workflow file
 * @param {string} filePath - repo-relative path, for reporting only
 * @returns {Array<{ file: string, line: number, expr: string }>}
 */
export function findViolations(content, filePath) {
  const violations = [];
  for (const { line, expr } of findRawIfExpressions(content)) {
    if (OUTCOME_COMPARISON.test(expr) && !STATUS_FUNCTION.test(expr)) {
      violations.push({ file: filePath, line, expr });
    }
  }
  return violations;
}
