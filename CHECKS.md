# Checks: the rule every check in this repo follows

**A check must report non-coverage as a distinct, visible state — never as silence.**

A check that cannot see part of its subject must say so. If "I looked and it was
fine" and "I never looked" produce the same output, the check is not a control;
it is a source of false confidence, and the more thorough it looks the worse
that is.

This is written down because the same failure was found **fourteen times in three
days**, in fourteen different disguises, by fourteen unrelated routes. None was a
bug in the usual sense. Almost every one was green — one that was red had already
been explained away in advance, one was a `2>/dev/null` typed for tidiness, one was
a check that ran perfectly against an address the product had moved out of, one was
a monitoring stack installed after an outage it could not have detected, and one was
an alarm so confident about an outage that was not happening that its real warning
would have been ignored.

The last two are different in kind and belong at the end for that reason. In
instance 13 every control worked correctly and the defect was in **reading** one of
them — which is the failure with the fewest available defenses, since no gate
catches a wrong inference drawn from an accurate report.

## The fourteen

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

**8. A check whose true positives arrive pre-labelled as noise.** Every other
entry here is a check that went quiet. This one is the inverse, and it is worse,
because the check *did* fire — correctly, on the first try — and the repository
had already written down two reasons to ignore it.

`link-check.yml` failed on `https://review-iq-ajjrytb3na-el.a.run.app/docs`. The
first reading was rate limiting. It was not. **`review-iq-prod` has no billing
account linked**, so Cloud Run refuses to start a container and Google's frontend
returns 503 in ~0.09s.

**What that 503 meant took a second correction, and the distinction matters.**
The first diagnosis here read "a T2 product's backend is down". It is not.
review-iq had been *migrated* to `reviewiq-prod-260813`, where it serves genuine
Swagger today; the old project was decommissioned on purpose, and its billing was
removed deliberately rather than lost. The defect is a **stale citation** — the
portfolio pointing at an address the product has moved out of.

That is a different defect from a dead service, with a different fix, and
collapsing the two costs real money: the response to "backend down" is to relink
billing, which for review-iq would have resurrected a decommissioned duplicate
and billed for it. The response to "stale citation" is to edit a URL. Both were
found in the same sweep, and both are live in this estate right now:

| product | state | fix |
|---|---|---|
| review-iq | migrated; old project decommissioned | **stale citation** — repoint the URL |
| AetherArt | no replacement project exists; `aetherart-demo` returns 500 | **down** — needs billing |
| TriageIQ | `triageiq-prod-260812` created but not deployed to; `triageiq-api` returns 503 | **down** — finish the migration |

The general point: *a check reporting a URL is unreachable has told you about the
URL, not about the product.* Which of those two it means is a separate question
that the check cannot answer and a reader will answer by assumption if nobody
answers it deliberately. Diagnosing the billing correctly and then inferring an
outage from it was exactly that assumption — the mechanism was right and the
conclusion drawn from it was not checked against whether a replacement existed.

Two artefacts had prepared the dismissal in advance:

- `.lychee.toml` said generous timeouts "absorb [Cloud Run cold starts] instead
  of flagging it as broken every run."
- `link-check.yml` set `continue-on-error` on PRs, reasoning: "don't gate on link
  rot outside our control — e.g. Cloud Run cold starts."

Both name *Cloud Run 503* as the canonical example of a failure worth ignoring.
So the one failure mode most likely to represent a real outage of ours is
precisely the one the config taught every reader to discount. The check was
non-blocking, its failure was expected, and its explanation was pre-written.

**The fix is not more retries.** Retries were already correct, and were the
strongest evidence available — lychee's `should_retry()` covers
`is_server_error()` (all 5xx), `TOO_MANY_REQUESTS` and `REQUEST_TIMEOUT`, and
`retry_wait_time` doubles per attempt. At `retry_wait_time = 15,
max_retries = 3` that 503 had already survived **four attempts across ~105
seconds** before it was ever reported. No cold start and no rate limit does
that.

That proof is unrecoverable, and not by our misconfiguration. In
`retry_request()`, `retries` is a local counter: incremented, compared against
`max_retries`, and dropped when the function returns. There is no log line in
the loop and no verbosity flag that reveals it — a failure that survived four
attempts and one that failed instantly produce *byte-identical* output. So the
reader was left holding the config's prior with nothing available to overturn
it. The retries did their job and the tool destroyed the evidence that they had.

Since the count cannot be surfaced, `.lychee.toml` now carries the arithmetic
itself — the retry budget written out in seconds, next to the settings that
produce it — so a reader can derive from the config what the report will never
tell them. That is a compensating control, not a fix, and it is worth naming as
such: it depends on someone reading the config, which is exactly the kind of
assumption the rest of this document distrusts.

The general shape: **a check earns its retries in order to make its failures
trustworthy — and then must say so, or it has bought the credibility and thrown
away the receipt.** A failure report that cannot distinguish "503 once" from
"503 after four attempts over 105 seconds" hands the reader the same ambiguity
the retries were supposed to resolve. Comments that pre-classify a whole status
code as environmental complete the job: they convert a signal into a known
false alarm before it has been read.

Also worth noting what did *not* catch this. Every GCP-side check looked
healthy: `gcloud run services describe` reports `Ready: True`,
`RoutesReady: True`, and 100% of traffic on `review-iq-00038-nt2`, the latest
ready revision. All of that is control-plane configuration, which billing does
not touch — the service is perfectly configured and cannot run. Confirming the
failure required either a request to the URL, or
`gcloud billing projects describe`, which no check ran. This is instance 6's
lesson in a different costume: state that looks like health, measured on the
wrong plane.

Note that even those signals could not have told the two defects apart. A
decommissioned project and a broken one report identically — `Ready: True` and
an unpaid bill look the same either way. What distinguished them was finding
`reviewiq-prod-260813` on the open billing account and getting real Swagger from
it. **The evidence that a service moved lives outside the service**, so no check
scoped to one project can produce it.

**9. `2>/dev/null` made "nothing exists" and "I could not look" identical.**
Sweeping five GCP projects for billable resources, every `gcloud sql instances
list`, `gcloud compute instances list` and `gcloud container clusters list`
returned empty. The obvious reading — no Cloud SQL, no VMs, no clusters, so
relinking billing is cheap — was one sentence away from being reported as a
cost estimate.

Every one of those commands was **failing**. Re-running without `2>/dev/null`
showed `PERMISSION_DENIED`, disabled APIs, and from Compute Engine the exact
message *"This API method requires billing to be enabled."* The inventory needed
to price a billing decision is itself gated on billing — a genuine catch-22, and
invisible while stderr was discarded.

This is the document's own thesis committed by its own author, in a shell
one-liner, on the same day instance 8 was written. It did not even need a subtle
bug: `2>/dev/null` is a deliberate instruction to make failure look like
success, and it was typed to keep the output tidy.

Two things generalise:

- **Silencing a channel silences a status.** `2>/dev/null` and `|| true` and
  `.catch(() => [])` all convert "could not check" into whatever the empty
  result means — and the empty result almost always means "fine". An empty list
  is the most dangerous possible default because it is indistinguishable from
  the healthy case at a glance.
- **The correct check reports three outcomes, not two.** The re-run
  distinguished `none (API reachable, empty result)` from `UNVERIFIED (API
  disabled/denied)` precisely because it stopped throwing the error away. That
  is the same `UNVERIFIABLE`/`SKIPPED` discipline the rest of this file argues
  for, applied to a shell loop rather than a checker script — the principle does
  not care how small the tool is.

What actually caught it was re-running the sweep to quote exact output, not
suspicion. Had the numbers been quoted from the first run, "no Cloud SQL, no
VMs" would have gone into a cost report as a verified zero, and the only
evidence against it would have been a bill.

**10. The check ran correctly, against the wrong target.** Twice in two days I
probed a decommissioned address and reported the product as down.

review-iq: `review-iq-ajjrytb3na-el.a.run.app` returned 503, and I reported a T2
backend outage. The service had moved to `reviewiq-prod-260813` and was serving
Swagger the whole time. TriageIQ, the next day, identically: `triageiq-api` in
`expense-tracker-498014` returned 503, reported down — while production had long
since moved to `triageiq-api-1014562031321`, which answers in 0.58s. In both
cases the probe was accurate, the diagnosis of *why* it failed (no billing
account) was accurate, and the conclusion was wrong, because the address came
from a citation rather than from the deployment.

**A stale citation and a dead service produce identical symptoms.** Nothing in a
503 distinguishes "this product is broken" from "this product moved and your
notes did not." The difference is not observable at the address being probed —
it is only observable somewhere the probe never looks: the deploy config, the
frontend's environment, the billing account's project list. Instance 8 already
recorded that *the evidence that a service moved lives outside the service*.
Doing it a second time, a day later, is the evidence that knowing this does not
prevent it. **When a service reports unhealthy, verify you are testing the
address the product currently uses — not the one your notes cite — before
concluding anything about the product.** For this estate that means reading
`.env.production` or the deploy workflow's target, not the case-study link.

A third variant of the same error, same week, on a question about scope rather
than health: I read `killswitch-sa` holding `roles/billing.admin` **on the
billing account** and concluded the killswitch could disable billing
account-wide, then warned that linking one project risked taking down five. The
permission is account-level because `updateBillingInfo` requires it; the blast
radius is set somewhere else entirely — `budget_filter.projects` names exactly
one project, and the function's `GCP_PROJECT_ID` names the same one. **A
capability's scope is not its configured scope.** Reading the grant and inferring
the behaviour is the same shortcut as reading a citation and inferring the
deployment: in both cases the artifact that actually decides was one file away
and unread.

**A footnote on timeouts, because it nearly caused a third false "down".** The
first probe of TriageIQ's production API timed out at 60s and I read the timeout
as death. It was a cold start — the service pulls model artifacts from GCS on
boot, and answered in 0.58s once warm. `triage-iq`'s own `health-monitor.yml`
carries this bug's fossil: **99 of 100 runs failed** with curl error 28 because
`--max-time` was 20s against a cold start measured at 36s, and its header now
says *"a monitor that constantly false-fires is worse than no monitor — it trains
the owner to ignore its alerts."* That is instance 8's lesson, discovered
independently in another repo, by the same author, about the same class of
service. **A timeout is not a result.** It is the absence of one, and on a
scale-to-zero service the budget has to exceed a cold start before absence means
anything at all.

**An addendum to instance 9, which its own fix did not cover.** Showing stderr
was necessary and *not sufficient*. Re-running the sweep visibly,
`gcloud compute instances list` printed a warning — *"This API method requires
billing to be enabled"* — and then, on the last line, **`Listed 0 items.`** The
final line of a fully-visible, unsuppressed output still reads as a clean zero.
Anyone skimming for the answer sees the answer, and it is wrong.

So the rule from instance 9 needs sharpening: **it is the exit status that
distinguishes empty from failed, not the visibility of stderr.** A human reading
output classifies by the part that looks like a result; only checking the exit
code, or matching the error text explicitly, separates the two. The sweep that
finally reported honestly did the latter — it branched on whether the output
matched a known error signature and printed `UNVERIFIED` instead of a count —
and that branch, not the removal of `2>/dev/null`, is what made it correct.

**11. Traffic-derived alerting cannot see a service that never starts.** TriageIQ
runs scale-to-zero. Its Cloud Monitoring setup — `scripts/setup_monitoring.sh` —
creates an email notification channel, a log-based metric for Groq token usage, a
dashboard, and three alert policies: 5xx rate above 5% over 10 minutes, p95
latency above 5s over 10 minutes, and daily tokens above 70K.

Every one of those is computed **from requests the service served**. A
scale-to-zero instance that cannot cold-start — because billing was disabled —
serves nothing. Zero requests produce zero log lines, which produce zero metric
points, which produce zero alerts. The error-rate condition is not evaluated and
found acceptable; it is evaluated against **no data at all**, and absence of data
is not a breach. Total failure and a quiet night have the same signature.

This monitoring was installed *after* the 2026-08-05 billing outage, which went
undetected for up to 12 days. It looked comprehensive — a dashboard, three
policies, a custom metric, a notification channel — and it was structurally blind
to the exact failure that motivated it. Not misconfigured. **Correctly
configured, measuring the wrong plane**: it watches the quality of traffic that
exists, and the failure mode is that no traffic can exist.

The trap is what "fixing" it would have felt like. `health-monitor.yml`'s header
records that the GCP uptime check "described as primary as of 2026-08-10" lived
in the decommissioned project and that `setup_monitoring.sh` "is updated to point
at the new project but has not been re-run". The obvious remedy is to re-run it.
**That script creates no uptime check** — grep it — so re-running would have
restored the dashboard and the three blind policies, produced a satisfying wall
of green, and closed nothing. A remediation that feels complete and changes
nothing is worse than a known gap, because the gap stops being tracked.

The distinction worth keeping: **a passive check consumes signals the system
happens to emit; an active check generates its own.** Only the second can
distinguish "healthy and idle" from "cannot start", because only the second still
produces a data point when the system produces none. Every alert that reads a
metric derived from real traffic inherits this blindness, no matter how many
policies are stacked on it. The remedy is an uptime check or synthetic monitor —
something that manufactures a request on a schedule — not more conditions over
the same starved metric.

A smaller sibling in the same setup, same shape: a Cloud Monitoring email channel
stays **pending until the emailed confirmation link is clicked**, and an
unconfirmed channel accepts alerts and delivers nothing. The policies list looks
identical either way. Creating a notification path and verifying a notification
path are separate acts, and only one of them was ever performed here.

**12. A guard that reports "could not verify" as "catastrophic outage".** Every
other entry here describes a check that was too quiet. This one was too loud, and
it is the worst of the set, because of *which* alarm it discredits.

TriageIQ's `health-monitor.yml` asserts billing directly — deliberately, because
a warm Cloud Run revision keeps returning 200 for hours after billing dies, so
`/health` alone cannot catch the failure promptly. It read:

```bash
ENABLED=$(gcloud billing projects describe "$P" --format='value(billingEnabled)')
if [ "$ENABLED" != "True" ]; then   # empty string is also != "True"
```

When that `gcloud` call *fails* — the monitor service account losing
`roles/browser`, the Cloud Billing API being disabled, WIF auth expiring — the
variable holds the empty string, and the guard announces a **confirmed billing
outage**, citing two real incidents by ADR number and linking a recovery runbook.

It did this on 2026-08-13/14, on `main`, while the service was healthy: `/health`
returned 200 on a **61-second cold start**, and a cold start cannot happen without
billing. The guard's own comment depends on that asymmetry — it exists precisely
because *warm* serving proves nothing — so the evidence disproving its alarm was
the mechanism it was built around.

**Fail-closed was never the issue.** Both branches exit non-zero; the job goes red
either way. What differs is what the operator does next: `UNVERIFIED` means fix
the monitor's IAM, `DISABLED` means relink billing. Collapsing them doesn't just
lose information — it dispatches you, with maximum confidence and two incident
citations, to the wrong runbook. *Failing closed is about the exit code; being
useful is about the message, and they are not the same property.*

The asymmetry that makes this the worst variant: a check that goes silent fails
**openly** and is found late, as instances 1–5 were. A check that fires falsely
fails **credibly**, and is found never — because the first response to a familiar
alarm that turned out to be nothing is to trust it less, and the second is to stop
reading it. This is the alarm for a failure mode that already went undetected for
**twelve days**. Teaching its owner that it cries wolf disarms the single signal
that most needs to be believed, and does so quietly, in the operator's head, where
no gate can catch it.

It is instance 9's shape — empty is not absent — relocated from a shell one-liner
in an ad-hoc sweep into a standing production guard, where the blast radius is not
a wrong sentence in a report but a wrong emergency response. The same three-line
mistake costs more the closer it sits to something that pages you.

Fixed in `triage-iq` by separating the read's *failure* from its *answer*: a
non-zero exit reports `UNVERIFIED` with gcloud's own stderr attached, `False`
reports `DISABLED` with the original message intact, and an unexpected value on a
zero exit also reports `UNVERIFIED` — because an unrecognised answer is not an
answer, and a future change to gcloud's output format should not silently become
an outage report.

**13. A synthetic test value read as production fact.** Every previous entry
records a defect in a check. This one is a defect in *reading* — the checks all
worked, reported accurately, and I drew an urgent, wrong conclusion from them and
acted on it in production.

Investigating why review-iq's old project lost its billing link, I found the
budget kill-switch's fire log:

```
AUTOMATED_KILLSWITCH_FIRED {"project": "reviewiq-prod-260813",
  "cost_amount": 2600.0, "budget_amount": 2500.0, "currency": "INR",
  "threshold": 1.04, "dry_run": true, "action": "would_disable_billing"}
```

I read `cost_amount: 2600.0` as spend, concluded the project was 104% over budget
with a kill-switch newly armed against it, escalated it as an urgent live hazard,
and disarmed a working production safety control.

**Actual spend was ₹0.00.** The same log stream carried a `cost=0.00 INR /
2500.00 INR` line every twenty to forty minutes, before and after, which I had
not read. `ops/runbooks/killswitch-test.md` explains the payload: *"Prove the
kill switch fires correctly… re-run after any changes to
`ops/budget-killswitch/`."* The 08-13 migration was such a change. Both fires
were that verification, one per project, with synthetic costs sitting exactly at
the cap (2500.00/2500.00 = threshold 1.0) and just over it (2600/2500 = 1.04).
Setting `DRY_RUN=false` two minutes later was the runbook's intended final step.

**The disproof was arithmetic and available immediately.** Month-to-date cost is
monotonically non-decreasing inside a calendar month, so ₹2600 on the 13th and
₹0.00 on the 14th cannot both be spend. One subtraction would have killed the
conclusion before it reached a recommendation.

Two things generalise:

- **A test that emits production-shaped telemetry must mark itself
  unmistakably.** This payload is byte-identical in structure to a real breach;
  the only tell is `"dry_run": true`, one field among nine, and the human-readable
  half of the marker (`AUTOMATED_KILLSWITCH_FIRED`, `would_disable_billing`) reads
  as an incident either way. A synthetic event should be as loud about being
  synthetic as a real one is about being real — a distinct marker string, not a
  boolean buried mid-object.
- **A single data point must never outrank the series available beside it.** The
  contradicting evidence was not hidden, not in another system, not expensive to
  fetch: same project, same log, same query shape, seconds away. I did not look,
  because the first reading was alarming and alarm shortens the search.

The reason this belongs in a file about checks: **every control here was working.**
The kill-switch fired correctly. The logs recorded honestly. The runbook documented
the procedure. Reading one payload out of its series defeated all of it, and no
gate in this repository or any other can catch that — which makes it the failure
mode with the fewest defenses, not the most.

Recorded with the outcome, not just the lesson: I disarmed the control at 10:14Z
and re-armed it at 10:28Z after being corrected. For fourteen minutes a production
billing guard was off because of a misread number.

**14. Config and reality diverged, and nothing was watching.** Found in the same
hour, and it is what let instance 13 be discoverable at all.

`terraform.tfstate` recorded `DRY_RUN = "false"` for the kill-switch. The running
function had been redeployed since, and only `gcloud functions describe` could say
what it actually held. The two agreed at the moment I checked — but the divergence
was real minutes later, when a `gcloud functions deploy` changed the live value and
left the state file behind, and `terraform plan` then reported:

```
~ "DRY_RUN" = "true" -> "false"
Plan: 0 to add, 1 to change, 0 to destroy.
```

That plan is the whole finding: **`terraform plan -detailed-exitcode` detects
config-vs-live divergence in either direction, it already exists, and nothing runs
it.** `killswitch-test.md` even cites it — *"terraform plan -detailed-exitcode exit
0, zero drift"* — as a manual step performed once, on 2026-05-11.

The failure shape is familiar by now: a source of truth that is only true until
someone touches the live resource, with no scheduled comparison to notice. It is
worse here than for most infrastructure, because the drifting field decides whether
a control that can disable production billing is armed. Either direction is a
silent hazard — drifting to `true` disarms the guard, drifting to `false` arms it
where it was deliberately disabled — and neither produces any output at all today.

Note also which artifact was authoritative. Reading tfstate is reading *what
Terraform last believed*; reading the function is reading *what will execute*. For
anything whose value changes behaviour under load, only the second counts, and the
habit of checking the config file because it is closer to hand is exactly how the
divergence survives.

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
- **Never let one data point outrank the series beside it.** Instance 13 escalated
  a synthetic test value to an urgent production recommendation while the same log
  stream carried the contradicting series, seconds away. Alarm shortens the search;
  that is precisely when to widen it and check the trend, the units, and the
  arithmetic before acting.
- **Make synthetic events unmistakably synthetic.** A test that emits
  production-shaped telemetry needs a distinct marker, not a boolean field inside
  an otherwise identical payload.
- **Read the running thing, not the config that describes it.** tfstate is what
  Terraform last believed; `describe` is what will execute. Where the value
  changes behaviour, only the second counts — and schedule the comparison
  (`terraform plan -detailed-exitcode`) rather than trusting they still agree.
- **Failing closed is the exit code; being useful is the message.** Two failures
  that need different responses must not share one alarm. A guard that reports a
  broken check as a confirmed outage sends you to the wrong runbook with full
  confidence (instance 12) — say `UNVERIFIED`, and say what actually failed.
- **Never discard an error channel to tidy output.** `2>/dev/null`, `|| true`
  and `.catch(() => [])` convert "could not check" into an empty result, and an
  empty result reads as healthy. If output needs tidying, classify the error and
  print a status for it — instance 9 is this rule being broken in a one-line
  shell loop, which is where it is easiest to break and hardest to notice.
- **Ask what a failure is evidence *of*.** A check reports on the thing it
  touched, not the thing you care about. An unreachable URL means the URL is
  unreachable; whether the product is broken, moved, or retired is a separate
  question, and instance 8 cost real money by answering it from the check alone.
- **Confirm the target before trusting the verdict.** Probe the address the
  deployment uses (`.env.production`, the deploy workflow), not the one a
  citation names — instance 10 called two live products dead by testing
  addresses they had moved out of. The same applies to scope: read the config
  that sets the blast radius, never infer it from a permission grant.
- **Classify the exit, don't read the output.** Unsuppressing stderr is not
  enough: `gcloud compute instances list` prints its error and then
  `Listed 0 items.` Branch on exit status or on a matched error signature and
  print an explicit `UNVERIFIED`, or the failure still reads as a zero.
- **A timeout is not a result.** On a scale-to-zero service the probe budget
  must exceed a cold start before absence of a response means anything.
- **For liveness, probe actively — never infer it from traffic metrics.** An
  alert computed from served requests goes silent exactly when the service stops
  serving (instance 11). Ask of any monitor: *if this system emitted nothing at
  all, would this still produce a data point?* If not, it measures quality, not
  existence, and something must manufacture the request instead.
- **Creating a notification path is not verifying one.** An unconfirmed
  Cloud Monitoring channel accepts alerts and delivers nothing, and the policy
  list looks the same either way. Send a test through every channel end to end.
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
