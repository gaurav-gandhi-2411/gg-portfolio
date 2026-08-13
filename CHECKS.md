# Checks: the rule every check in this repo follows

**A check must report non-coverage as a distinct, visible state — never as silence.**

A check that cannot see part of its subject must say so. If "I looked and it was
fine" and "I never looked" produce the same output, the check is not a control;
it is a source of false confidence, and the more thorough it looks the worse
that is.

This is written down because the same failure was found **four times in one
day**, in four different disguises, by four unrelated routes. None of them was a
bug in the usual sense. Every one of them was green.

## The four

**1. `source_line` was read by nothing.** Every layer of
`check-metric-freshness.mjs` fetched the whole source file and searched it for
the value's numbers. An entry whose cited line pointed at a completely different
row still passed, because the number was *somewhere* in the file. That is how
`triageiq:classifier-top3` survived multiple audits with its line on the vscode
row while its value led with the kubernetes figure — `"87.1 appears in
README.md"` was true the entire time. The field looked like provenance and
functioned as decoration.

**2. `SKIPPED` printed nowhere.** `check-card-consistency.mjs` excluded it from
the drift list *and* from the config-issues list. `SKIPPED` means Check A
compared **nothing** for that metric. Four metrics were invisible this way, two
of them introduced the same day and unnoticed precisely because the output
looked clean.

**3. The `<id>-baseline` inference.** A baseline sibling was located by
guessing the key `` `${id}-baseline` ``. It silently failed for
`warmer:hinglish-fix`, whose baseline is `warmer:hinglish-baseline`, not
`warmer:hinglish-fix-baseline` — surfacing as a confusing false positive
somewhere else entirely rather than as "link not found". Fixed by declaring the
link in a `baseline_ref` field. **Derive relationships from declarations, not
from the shape of a key.**

**4. `.find()` on the first matching row.** Check A locates a case-study row by
`claims.find(c => c.sourceRef === id)`, so when two rows cite the same ID only
the first is ever compared. The second is uncovered, silently.

**6. A local build measured as evidence about production.** The hero's WebGL
layer was measured at **93.17** against a local `next start` build, reported as
"no regression", and shipped. Deployed, the same page measured **88.17** — a
4.83-point drop that blew the −3 gate, with Speed Index nearly tripling
(1389ms → 3929ms).

The measurement was real, repeated, n=6, and honest. It was also about the
wrong machine. localhost has no CDN, no real TLS handshake, no cold start, and
different CPU contention — so the run answered a question about a laptop and
was presented as an answer about visitors. **Same class: the check ran, but
against a narrower surface than the claim it supported.**

Worse, nothing in the artifact said so. A local summary and a production
summary were identical in every field, so the file could not be used to tell
which target it described. `scripts/lighthouse.mjs` now records
`origin: "local" | "deployed"` and its docblock states the rule outright:
**performance gates are measured against the deployed target, never a local
build.**

Related, same family, found the same week: CI could not reach the WebGL layer
because GitHub runners report ≤4 cores and the capability gate correctly
declined; every axe scan forced `prefers-reduced-motion`, which is exactly a
condition under which that layer does not mount; and a behaviour test asserted
one exact sentence, so it broke when the sentence was corrected for accuracy.

## What follows from it

- **Name the surface.** For every check, state which paths, which entries, which
  identities it actually reaches. If you cannot state it, you do not know it.
- **Give non-coverage its own status,** distinct from pass and from fail. This
  repo uses `UNVERIFIABLE` (tried, could not), `NO_LINE` / `SKIPPED` (nothing to
  compare), `QUALITATIVE` (correct forever, no anchor possible, not a backlog
  item) and `TOKEN_TOO_SHORT` (a checker limitation, not a metric property).
  The last two exist specifically so a reader can tell "will never be checkable"
  from "not yet checked".
- **Print every one of them.** A status computed and not shown is the same bug
  as a status never computed.
- **Fail closed.** "Could not verify" is a deny, never a silent pass.
- **Test the check against a known-bad input,** not only a passing one. A check
  verified only on data that passes has never demonstrated it can fail. The
  determinism check in `gaurav-gandhi-2411` was run with its
  `SOURCE_DATE_EPOCH` pin removed for exactly this reason.
- **Prefer declared links to inferred ones.** `baseline_ref` over
  `` `${id}-baseline` ``; `Object.hasOwn(MAP, k) ? MAP[k] : undefined` over
  `MAP[k] ?? k`. An inference that *is* immediately validated is acceptable —
  `resolveSlug`'s prefix convention is checked against the loaded case-study
  modules and reports `NO_SLUG_MAPPING` when it fails — but an inference whose
  failure has no reporting path is not.

## The same asymmetry in the dependency tree

Not a check, but the identical shape: something that matters to *one feature*
holding veto power over *every* job, with nothing surfacing the mismatch until
it failed.

`onnxruntime-node` runs a `postinstall` that downloads a native binary from a
CDN. It arrives transitively via `@huggingface/transformers`, which exists for
exactly one feature — the `/ask` chatbot's local embedding pipeline. On
2026-08-13 that CDN timed out and `npm ci` exited non-zero, so **`build` and
`e2e` both died before compiling a line of application code**, on a PR that
touched only markdown, JSON and content. One feature's dependency blocked every
merge in the repo.

**`sharp` has the same shape and has not bitten yet.** Its `install` script
(`install/build.js`) fetches prebuilt libvips binaries when no local build
matches. It is pulled in for Next.js image optimisation.

The difference is what the fix looks like. `@huggingface/transformers` can move
to `optionalDependencies`, because `/ask` degrading to "search is temporarily
unavailable" is an acceptable, visible failure. **`sharp` cannot** — it is close
to core, and a site whose images silently stop being optimised is a slow,
invisible regression rather than a loud one, which is the wrong trade in exactly
the direction this document argues against. For `sharp` the options are pinning
a platform-matched prebuilt binary, vendoring it, or caching the extracted
artifact in CI keyed on the lockfile — mitigations of the fetch, not removals of
the dependency.

Recorded here because the point is not the outage. It is that a dependency's
blast radius should match its importance, and nothing in this repo measured that
until the day it was measured for us.

`protobufjs` and `unrs-resolver` also run install scripts, but both do local
work only and make no network call. Nothing else in the tree runs one at all.

## The tell

Ask of any check: **if the thing it guards broke right now, would this produce
output?** If the honest answer is "it would go quiet", the check is decorative.
Silence must mean "nothing is wrong", and it can only mean that if every other
outcome is loud.
