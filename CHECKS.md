# Checks: the rule every check in this repo follows

**A check must report non-coverage as a distinct, visible state — never as silence.**

A check that cannot see part of its subject must say so. If "I looked and it was
fine" and "I never looked" produce the same output, the check is not a control;
it is a source of false confidence, and the more thorough it looks the worse
that is.

This is written down because the same failure was found **five times in one
day**, in five different disguises, by five unrelated routes. None of them was a
bug in the usual sense. Every one of them was green.

## The five

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

**5. A prose claim standing in for evidence.** Rule 70a's gate 5 requires a PR
touching UI paths to carry a screenshot, or an explicit evidenced substitute. On
#89 I argued the substitute applied: the `/ask` degraded state is unreachable in
a normal environment, so there was nothing to photograph, and a written
description of the intended behaviour would do. The gate disagreed.

Complying with it found a bug. Stubbing the 503 and actually looking at the page
showed **five suggested-question chips still on screen** in the state whose
entire purpose is to stop offering prompts that cannot be answered. A 503 adds
no conversation turn, so `isEmpty` stays true and the empty-state block renders
— and only the post-turn chip row had been gated.

The e2e test passed through it, because it asserted on `"Or ask about:"`, the
heading of the *other* chip block. A test scoped to one container's copy rather
than to the thing being asserted — the same shape as instance 1, one layer up.

The lesson is the general one: **an evidence requirement exists because a
description can assert a state the code does not produce.** The prose was an
accurate description of what the code was *meant* to do, which is exactly why it
could not have caught what the code actually did. When a gate asks for evidence
and the honest answer is "there's nothing to show", that is usually a sign the
state has never been looked at.

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

### What the optionalDependency fix covers — and what it deliberately does not

`@huggingface/transformers` moved to `optionalDependencies` in #89. **It
protects production and local dev. It does NOT protect CI, on purpose.**

`npm ci` installs optional dependencies by default, so CI still performs the
install-time fetch and a CDN outage can still fail a run. Covering CI would mean
`--omit=optional`, and that immediately breaks the "Verify chatbot index is up
to date" step: `check-index-fresh.mjs` shells out to `build-index.mjs`, which
needs the package to regenerate embeddings and compare them against the
committed index.

So the choice was explicit: **keep the index-freshness guarantee, or make CI
immune to the outage. The guarantee won.** A stale index has broken `main`
twice. A CDN outage cost one afternoon, is transient, and resolves itself.
Trading a permanent correctness guarantee for availability against a temporary
external failure is the wrong direction.

This is written down so nobody later "finishes the job" by adding
`--omit=optional` and quietly leaves the index check unable to run — which would
be this document's own failure class again: a check that still reports, while no
longer able to check anything.

`protobufjs` and `unrs-resolver` also run install scripts, but both do local
work only and make no network call. Nothing else in the tree runs one at all.

## The tell

Ask of any check: **if the thing it guards broke right now, would this produce
output?** If the honest answer is "it would go quiet", the check is decorative.
Silence must mean "nothing is wrong", and it can only mean that if every other
outcome is loud.
