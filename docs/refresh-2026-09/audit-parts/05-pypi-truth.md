## 5. PyPI truth

Scope: ground-truth version/release/download data for the three PyPI packages named in the
spec (`tracegauge`, `adk-tracegauge`, `agentgauge-harness`), sourced only from `pypi.org`'s
public JSON API and `pypistats.org`'s public JSON API — no auth, zero cost, per task
constraints. `ANTHROPIC_API_KEY` was not touched by any command in this section.

All three packages resolved with **HTTP 200** — none 404'd, so there is no "package not
found" case to report per instruction 2.

### 5.1 `tracegauge`

- Verified (command: `curl -s https://pypi.org/pypi/tracegauge/json`, fields `info.version`,
  `info.summary`, `info.requires_python`, `info.project_urls`, and `releases` object keys):

| Field | Value | Status |
|---|---|---|
| Current version | `0.13.0` | verified |
| Release count (`releases` keys) | **19** (all 19 have ≥1 file attached — none are metadata-only/yanked-empty entries) | verified |
| Summary | "Three-axis efficiency scoring for Claude Code sessions — token economy, trajectory quality, deterministic waste. Local by default; nothing transmitted unless you opt in to the content-free community baseline." | verified |
| `requires_python` | `>=3.10` | verified |
| `project_urls` | `{"Repository": "https://github.com/gaurav-gandhi-2411/token-efficiency-scorer"}` | verified |

- All release versions (sorted): `0.1.0, 0.10.0, 0.10.1, 0.10.2, 0.11.0, 0.11.1, 0.12.0,
  0.12.1, 0.12.2, 0.12.3, 0.12.4, 0.13.0, 0.3.0, 0.3.1, 0.5.0, 0.6.0, 0.7.0, 0.7.1, 0.8.0`.
- **F7 cross-check**: the site's claim that "tracegauge (PyPI) source links to repo
  `token-efficiency-scorer`" is **confirmed correct by PyPI's own `project_urls.Repository`
  field**, not a site error — the PyPI package literally named `tracegauge` declares its
  source repo as `github.com/gaurav-gandhi-2411/token-efficiency-scorer`. So the PyPI-package
  name and the GitHub-repo name have genuinely diverged (package renamed at some point,
  repo name never followed, or vice versa) — this is a real name/identity split on PyPI's
  own record, independent of anything issue #200 might separately claim about a rename. The
  README's omission of `tracegauge` entirely (F7's other half) is unaffected by this and
  remains a real gap: the package exists, is live, and is undocumented on the profile README.
- Downloads (verified, command: `curl -s https://pypistats.org/api/packages/tracegauge/recent`):
  `last_day: 3`, `last_week: 16`, `last_month: 307`.
- System breakdown (verified, command:
  `curl -s https://pypistats.org/api/packages/tracegauge/system`, data spans 2026-06-07 to
  2026-09-22 — this appears to be pypistats' full retained history for this package, not a
  fixed recent window, since it reaches back to a date consistent with the package's early
  releases):

| System category | Downloads (full history in response) | Share |
|---|---|---|
| `null` (no system reported — CI/mirror-heavy per pypistats' own docs) | 2,059 | 79.6% |
| Linux | 393 | 15.2% |
| Darwin | 68 | 2.6% |
| Windows | 68 | 2.6% |
| **Total (all categories)** | **2,588** | 100% |
| Total excluding `null` | 529 | 20.4% |

- Cross-check: summing only the last 7 calendar days present in the `system` response
  (2026-09-16 to 2026-09-22) gives 16 total downloads, of which 7 have a non-null system —
  this **matches** the `recent` endpoint's `last_week: 16` exactly, confirming both endpoints
  are internally consistent for this package.

### 5.2 `adk-tracegauge`

- Verified (command: `curl -s https://pypi.org/pypi/adk-tracegauge/json`):

| Field | Value | Status |
|---|---|---|
| Current version | `0.9.1` | verified |
| Release count (`releases` keys) | **17** (all 17 have ≥1 file attached) | verified |
| Summary | "See what your Google ADK agent costs: per-invocation token cost in USD, plus a CI cost-regression gate. A model it cannot price is reported as unknown, never guessed." | verified |
| `requires_python` | `>=3.10` | verified |
| `project_urls` | `Changelog`, `Documentation`, `Homepage`, `Issues`, `Repository` all point to `https://github.com/gaurav-gandhi-2411/adk-tracegauge` (repo name matches package name here — no split) | verified |

- All release versions (sorted): `0.1.0, 0.1.0rc1, 0.2.0, 0.3.0, 0.3.1, 0.3.2, 0.4.0, 0.4.1,
  0.5.0, 0.5.1, 0.6.0, 0.6.1, 0.7.0, 0.8.0, 0.8.1, 0.9.0, 0.9.1`. Note `0.1.0rc1` is a
  pre-release tag distinct from `0.1.0`, both counted in the 17.
- **F2 resolution**: PyPI ground truth is `v0.9.1` / **17 releases**, which matches the
  **site's** stated figure exactly ("v0.9.1 · 17 releases") and **contradicts the GH
  README's** "8 releases, v0.4.1" — the README is confirmed stale, the site is confirmed
  current. The README is more than half the actual release count and 5 minor versions
  behind.
- Downloads (verified, command:
  `curl -s https://pypistats.org/api/packages/adk-tracegauge/recent` — first attempt hit
  `HTTP 429 RATE LIMIT EXCEEDED` from pypistats, succeeded on retry after an 8-second pause,
  noted here for provenance): `last_day: 30`, `last_week: 589`, `last_month: 839`. The
  `last_week` figure (589) being most of `last_month` (839) indicates a download burst in the
  last 7 days rather than a steady rate — worth a caveat if this number is quoted anywhere as
  a steady-state signal.
- System breakdown (verified, command:
  `curl -s https://pypistats.org/api/packages/adk-tracegauge/system`, data spans 2026-08-13
  to 2026-09-22 — shorter window than `tracegauge`'s, consistent with `adk-tracegauge` having
  fewer/later releases in this history than `tracegauge`):

| System category | Downloads (full history in response) | Share |
|---|---|---|
| `null` | 1,747 | 81.4% |
| Linux | 249 | 11.6% |
| Windows | 78 | 3.6% |
| Darwin | 72 | 3.4% |
| **Total (all categories)** | **2,146** | 100% |
| Total excluding `null` | 399 | 18.6% |

- Cross-check: last-7-days sum from the `system` response (2026-09-16 to 2026-09-22) = 589
  total, matching `recent`'s `last_week: 589` exactly (104 of that 589 have a non-null
  system).

### 5.3 `agentgauge-harness`

- Verified (command: `curl -s https://pypi.org/pypi/agentgauge-harness/json`):

| Field | Value | Status |
|---|---|---|
| Current version | `0.5.3` | verified |
| Release count (`releases` keys) | **5** (all 5 have ≥1 file attached) | verified |
| Summary | "Statistical regression harness for MCP tool descriptions (measures whether a change actually moved agent task success) + a deterministic defect linter as a secondary utility" | verified |
| `requires_python` | `>=3.11` (note: stricter floor than the other two packages' `>=3.10`) | verified |
| `project_urls` | `Homepage`/`Issues`/`Repository` → `https://github.com/gaurav-gandhi-2411/agentgauge` (package distribution name `agentgauge-harness` vs. repo name `agentgauge` — a naming variant, though not the kind of full rename split seen in `tracegauge`/`token-efficiency-scorer`); `Changelog` → same repo's `README.md`, not a dedicated `CHANGELOG.md` | verified |

- All release versions (sorted): `0.4.0, 0.5.0, 0.5.1, 0.5.2, 0.5.3`.
- This package is not named in F2, but is included here for completeness per the task's
  three-package scope; flag for whichever section owns the consistency table: if
  `agentgauge-harness` version/release-count is stated anywhere on site or README, it must
  read `0.5.3` / `5 releases`, not any other value.
- Downloads (verified, command:
  `curl -s https://pypistats.org/api/packages/agentgauge-harness/recent`): `last_day: 3`,
  `last_week: 36`, `last_month: 137`.
- System breakdown (verified, command:
  `curl -s https://pypistats.org/api/packages/agentgauge-harness/system`, data spans
  2026-07-25 to 2026-09-22):

| System category | Downloads (full history in response) | Share |
|---|---|---|
| `null` | 600 | 74.0% |
| Linux | 170 | 21.0% |
| Windows | 21 | 2.6% |
| Darwin | 20 | 2.5% |
| **Total (all categories)** | **811** | 100% |
| Total excluding `null` | 211 | 26.0% |

- Cross-check: last-7-days sum from `system` (2026-09-16 to 2026-09-22) = 36, matching
  `recent`'s `last_week: 36` exactly (7 of that 36 have a non-null system).

### 5.4 Closing note on F14 (raw vs. mirror-adjusted downloads)

F14 asks whether "downloads last week" should be labelled as raw or presented as a
"without-mirrors" figure. What is and isn't actually knowable from the two free APIs used
here:

- **What's knowable**: `pypistats.org`'s `/recent` endpoint gives a single raw number per
  package (`last_day`/`last_week`/`last_month`) that **pypistats' own documentation states
  includes mirrors and CI systems** — this is the number the spec calls "raw." The `/system`
  endpoint gives the same underlying data broken out by reported client OS
  (`Linux`/`Darwin`/`Windows`), plus a `null` bucket for requests where the client didn't
  report (or pypistats couldn't classify) an OS. Across all three packages here, the `null`
  bucket is **74–82% of total downloads** — i.e. the large majority of recorded downloads
  carry no OS signal at all, which is the profile you'd expect from CI runners, PyPI mirror
  crawlers (bandersnatch/devpi), and automated dependency-resolution bots rather than a human
  on a laptop running `pip install`.
- **What's NOT knowable from these APIs**: pypistats has **no dedicated "exclude mirrors"
  filter or flag** — there is no query parameter or separate endpoint that returns a
  mirror-adjusted total. The `null`-system bucket is a reasonable *proxy* for "probably not a
  human install" but it is not a verified mirror/CI classification — some genuine human
  installs also report no OS (e.g. certain pip/proxy configurations), and pypistats itself
  does not claim the `null` bucket equals "mirror traffic." So "downloads excluding null-system"
  (the non-null total column in each table above: 529 / 399 / 211) is the closest
  free-tier proxy available for a "without mirrors" figure, but it must be labelled as an
  **approximation via OS-attribution, not an official mirror-exclusion metric** — stating it
  as a precise "real download count" would overclaim what the source data supports.
- **Recommendation for how the audit presents this**: show both numbers side by side with
  explicit labels, e.g. "589 downloads/week (pypistats, includes mirrors/CI) · 104
  downloads/week with an OS reported (Linux/Darwin/Windows only — not an official
  mirror-exclusion figure)" — never present either number unlabelled, and never round the
  proxy number up into language implying it is the verified "real" figure.

### 5.5 Summary (for quick reference)

| Package | PyPI version | Release count | Last-week downloads (raw, pypistats `/recent`) | Last-week downloads (OS-attributed only, proxy) |
|---|---|---|---|---|
| `tracegauge` | 0.13.0 | 19 | 16 | 7 |
| `adk-tracegauge` | 0.9.1 | 17 | 589 | 104 |
| `agentgauge-harness` | 0.5.3 | 5 | 36 | 7 |

All figures in this file are labelled verified with the exact `curl` command and JSON field
path used; none are estimated or carried over from the spec's baseline findings without
independent re-verification here.
