/**
 * Lab 4 sample corpus — real, currently-public issue titles from the same
 * two repos TriageIQ's published metric cites (content/products.ts:
 * "Component classifier top-3 accuracy: 82.5% (k8s) / 90.4% (vscode)").
 * Fetched 2026-07-17 via GitHub's public search API (unauthenticated,
 * same fail-soft-friendly pattern as lib/live-data.ts), sorted by comment
 * count so titles are real, substantive bug reports, not placeholders.
 * Sourced per-item (repo + issue number + URL) so every classification
 * this lab produces traces to a real, checkable GitHub issue.
 */
export interface SampleIssue {
  repo: "k8s" | "vscode";
  number: number;
  title: string;
  url: string;
}

export const sampleIssues: SampleIssue[] = [
  { repo: "k8s", number: 56876, title: "kubernetes publishing bot is broken", url: "https://github.com/kubernetes/kubernetes/issues/56876" },
  { repo: "k8s", number: 56903, title: "DNS intermittent delays of 5s", url: "https://github.com/kubernetes/kubernetes/issues/56903" },
  { repo: "k8s", number: 45419, title: "Node flapping between Ready/NotReady with PLEG issues", url: "https://github.com/kubernetes/kubernetes/issues/45419" },
  { repo: "k8s", number: 60140, title: "kubectl cp fails on large files", url: "https://github.com/kubernetes/kubernetes/issues/60140" },
  { repo: "k8s", number: 51835, title: "Pods stuck on terminating", url: "https://github.com/kubernetes/kubernetes/issues/51835" },
  { repo: "k8s", number: 60807, title: 'deleting namespace stuck at "Terminating" state', url: "https://github.com/kubernetes/kubernetes/issues/60807" },
  { repo: "vscode", number: 508, title: "Crash when running overnight", url: "https://github.com/microsoft/vscode/issues/508" },
  { repo: "vscode", number: 184124, title: "Crash when rebuilding application menu on wayland", url: "https://github.com/microsoft/vscode/issues/184124" },
  { repo: "vscode", number: 212494, title: "1.90 snap package crash on startup", url: "https://github.com/microsoft/vscode/issues/212494" },
  { repo: "vscode", number: 301011, title: "All Extensions fails to install - End of central directory record signature not found", url: "https://github.com/microsoft/vscode/issues/301011" },
  { repo: "vscode", number: 24961, title: 'Code Insider complains "Could not install typings files for JS/TS language features"', url: "https://github.com/microsoft/vscode/issues/24961" },
  { repo: "vscode", number: 69665, title: "Terminal shows corrupt texture sometimes when resuming the OS from a sleep state", url: "https://github.com/microsoft/vscode/issues/69665" },
];
