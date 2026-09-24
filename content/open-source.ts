import type { OpenSourceInReviewEntry, OpenSourceLandedItem, OpenSourcePackage } from "./types";

/** Mirrors researchPaperCount's pattern (content/research.ts): one function, one array, can't drift. */
export function landedUpstreamCount(list: OpenSourceLandedItem[]): number {
  return list.length;
}

/**
 * Every fix here is proven by a commit on the upstream repo's own default
 * branch, not by a merged-PR badge — see content/types.ts's OpenSourceLandedItem
 * doc comment for why that distinction matters for the two adk-python entries.
 * Sources: content/provenance.md, "Open source contributions" section.
 */
export const openSourceLanded: OpenSourceLandedItem[] = [
  {
    repo: "google/adk-python",
    repoUrl: "https://github.com/google/adk-python",
    title: "fix(cli): resolve NameError in legacy create-eval-set route",
    whatChanged: "Fixed a crash in the ADK CLI's legacy route for creating an eval set.",
    prNumber: 6681,
    prUrl: "https://github.com/google/adk-python/pull/6681",
    commitSha: "023f45c3e5846c3e72525b53f16ef018b5ecdaa6",
    commitUrl: "https://github.com/google/adk-python/commit/023f45c3e5846c3e72525b53f16ef018b5ecdaa6",
    viaCopybara: true,
    releasedIn: "v2.8.0",
    sourceRef: "oss:adk-python-6681",
  },
  {
    repo: "google/adk-python",
    repoUrl: "https://github.com/google/adk-python",
    title: "fix(evaluation): reject num_samples=0 in JudgeModelOptions at construction time",
    whatChanged:
      "Made the ADK evaluation harness reject an invalid zero sample count for a judge model as soon as it's set, instead of failing later mid-run.",
    prNumber: 6939,
    prUrl: "https://github.com/google/adk-python/pull/6939",
    commitSha: "85e08686f8310e00b2b031a042db86405920b4b2",
    commitUrl: "https://github.com/google/adk-python/commit/85e08686f8310e00b2b031a042db86405920b4b2",
    viaCopybara: true,
    sourceRef: "oss:adk-python-6939",
  },
  {
    repo: "keras-team/keras",
    repoUrl: "https://github.com/keras-team/keras",
    title: "fix: R2Score returns NaN instead of 1.0 for a perfect prediction on zero-variance data",
    whatChanged:
      "Fixed Keras's R2Score metric returning NaN instead of 1.0 when a prediction is perfect but the target data itself has zero variance.",
    prNumber: 23420,
    prUrl: "https://github.com/keras-team/keras/pull/23420",
    commitSha: "f3b31e4f4667849d98c1e230e142c9f445f2eed0",
    commitUrl: "https://github.com/keras-team/keras/commit/f3b31e4f4667849d98c1e230e142c9f445f2eed0",
    sourceRef: "oss:keras-23420",
  },
];

/** Open, not-yet-merged pull requests. Never folded into any "landed" count. */
export const openSourceInReview: OpenSourceInReviewEntry[] = [
  {
    repo: "google/adk-python",
    repoUrl: "https://github.com/google/adk-python",
    pulls: [
      {
        number: 6739,
        url: "https://github.com/google/adk-python/pull/6739",
        title: "fix(evaluation): honor each metric's own eval_status in AgentEvaluator.evaluate()",
      },
      {
        number: 6740,
        url: "https://github.com/google/adk-python/pull/6740",
        title: "fix(cli): adk eval process exit code now reflects PASSED/FAILED",
      },
    ],
    sourceRef: "oss:adk-python-in-review",
  },
];

export const openSourcePackages: OpenSourcePackage[] = [
  {
    name: "tracegauge",
    packageName: "tracegauge",
    pypiUrl: "https://pypi.org/project/tracegauge/",
    repoUrl: "https://github.com/gaurav-gandhi-2411/token-efficiency-scorer",
    sourceRef: "oss:tracegauge-repo",
  },
  {
    name: "adk-tracegauge",
    packageName: "adk-tracegauge",
    pypiUrl: "https://pypi.org/project/adk-tracegauge/",
    repoUrl: "https://github.com/gaurav-gandhi-2411/adk-tracegauge",
    sourceRef: "oss:adk-tracegauge-repo",
  },
  {
    name: "agentgauge-harness",
    packageName: "agentgauge-harness",
    pypiUrl: "https://pypi.org/project/agentgauge-harness/",
    repoUrl: "https://github.com/gaurav-gandhi-2411/agentgauge",
    sourceRef: "oss:agentgauge-harness-repo",
  },
];
