# Checks: the rule every check in this repo follows

**A check must report non-coverage as a distinct, visible state — never as silence.**

A check that cannot see part of its subject must say so. If "I looked and it was
fine" and "I never looked" produce the same output, the check is not a control;
it is a source of false confidence, and the more thorough it looks the worse
that is.

This is written down because the same failure was found **fifteen times in three
days**, in fifteen different disguises, by fifteen unrelated routes, thirteen
times more in the design rebuild that followed, and five times more in the wave
after that. None was a bug in the usual sense. Almost every one was green — one that was red had already
been explained away in advance, one was a `2>/dev/null` typed for tidiness, one was
a check that ran perfectly against an address the product had moved out of, one was
a monitoring stack installed after an outage it could not have detected, and one was
an alarm so confident about an outage that was not happening that its real warning
would have been ignored.

The last three are different in kind and belong at the end for that reason. In
instance 13 every control worked correctly and the defect was in **reading** one of
them; instance 14 is config and reality drifting with nothing scheduled to compare
them; instance 15 is the identity running the commands changing underneath the
session. These are the failures with the fewest available defenses, because no gate
catches a wrong inference drawn from an accurate report, and none of them announces
itself as anything other than an ordinary error.

Instances 29 through 33 came last, and three of them are about the boundary of a
control rather than its logic: a copy rule that reaches where copy is written and
not where it is assembled, one alarm serving three failures that need three
different responses, and a docblock claiming more reach than its assertions
deliver. Instance 32 is this document's own method turned on itself, a negative
control run against a build that was being rewritten while it ran. Instance 33 is
the only entry here that ends well, and is included for that reason: a gate that
knew the order of magnitude of its own correct answer refused an implausible one
and caught a failure nobody had written it for.

Instances 16 through 28 came earlier, from a design rebuild rather than an audit,
and they extend the pattern rather than repeat it. Every earlier entry is a
check that could not see its subject. Instance 16 is a check that saw its
subject perfectly and had been told to look for the wrong thing. Instance 17 is
a defect no check was looking for at all, which announced itself only as a slow
test. Instance 18 is four checks that saw their subjects correctly and simply
saw less of them than their names implied, because how much they covered was
decided by a separator, an indent, a filename and an import spelling. It
carries the one-line rule the rest of this document had been circling: a check
is safe when it compares two independently-derived sets, or prints a
denominator it would notice moving. Instance 19 is the same idea with timing
in place of formatting: an assertion that passed only because it resolved
before the thing it would have collided with. Instance 20 is the measuring
tool itself: a Lighthouse runner that leaked a Chrome profile per run until the
debris changed what it measured. Instance 21 is a style write whose cost had
nothing to do with what read it, paired with a confident wrong explanation that
only fell when the variable was removed rather than argued about. Instance 22
is the one that produced no output at all: a gate that never fired on the branch
it existed to guard, which is the opening rule turned on a control rather than on
the code. Instance 23 is a new shape and the one to watch for: an exemption that
was correct when written and became wrong by outliving its reason, without
anything about it ever changing. Instance 24 is instance 18 pointing the other
way, two checks that rejected a correct disclosure because their scope was set by
word spacing. Instance 25 is the smallest and the most repeated: a rule's prose
and its implementation drift, and only the committed implementation is the
authority. Instance 26 is that same authority question while enforcing rather than
while reading: a hook resolves its gate by filesystem adjacency, so a shared
checkout's uncommitted edits are the live policy and a merged fix never reaches
it. Instance 27 is the first one where the check was working and the *metric*
moved for the wrong reason: work deferred past the point the measurement stops
looking improves the number without improving what it stands for. Instance 28
closes the set where instance 26 opened it, on addressing rather than coverage:
a suite that named its target by a port shared with every other checkout, and
so spent a full green run grading a different branch's build.

## The twenty-eight

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

**15. Two agents, one credential file, and an identity that changed mid-task.**
`~/.config/gcloud` is machine-global. Every concurrent session shares it, so
`gcloud config set account` in one repoints *every other session's* identity
between one command and the next — including in the middle of a Terraform state
migration.

It never once looked like what it was. Three symptoms, one cause:

| what happened | what I concluded | what it was |
|---|---|---|
| `403 cloudfunctions.functions.get denied` on a function I had just deployed | an IAM role was revoked | account had flipped to the one without access |
| the identical retry succeeded seconds later | transient consistency lag after deploy | it had flipped back |
| `storage: bucket doesn't exist` for a bucket created two minutes earlier | wrong project, or propagation | flipped again; the other account cannot read it |

**Every one of those diagnoses blamed the environment — IAM, eventual
consistency, propagation — and none asked whether the thing running the command
was still the same principal.** The second is the worst of them: a failure that
disappears on retry is the canonical signature of a transient fault, so the retry
*succeeding* was read as confirmation. It was the account flipping back. I wrote
"transient IAM/consistency lag" into a report on that basis.

The rule is narrow and mechanical, because in the moment the reasoning is not
available: **when an operation fails on permissions, confirm which identity
actually ran it before diagnosing anything else.** `gcloud config get-value
account` costs nothing and comes before IAM, before propagation, before API
enablement. A changing principal is indistinguishable from a changing permission
if you only ever look at the permission.

Two aggravating details worth carrying:

- **The workaround is not a fix.** Passing `--account=` on every invocation stops
  a session inheriting someone else's switch, but the config is still shared and
  still mutable by anyone. It is a seatbelt, not a lock — and a command that
  omits the flag silently rejoins the hazard.
- **Terraform does not use the gcloud CLI account at all.** It reads Application
  Default Credentials, configured separately, carrying their own
  `quota_project` — which here pointed at `iconic-reactor-496423-m4`, a project
  unrelated to any of this work. So a single operation had *two* identities in
  play, only one of which `gcloud config get-value account` reports. Checking the
  obvious one would have told a true story about the wrong principal.

Related in kind to instance 10 — a check running correctly against the wrong
target — but the target here is not a URL or a project. It is *who you are*, and
nothing in the output of a failing command mentions it.

**16. A test that was green, specific, and defending the defect.** The header
was rebuilt as a pill that contracts on scroll, and a test asserted the
contraction: `expect(scrolled.height).toBeLessThan(atTop.height)`. It passed
every run. It was also wrong, because the band is sticky *and still in flow*, so
a band that changes height moves every element on the page below it — the whole
document slid 16px as you scrolled through the contraction. The test had been
written by reading the implementation and asserting what it did, so it locked in
the behaviour instead of the intent. The intent was "the pill contracts"; what
got written down was "the header gets shorter", and those are the same sentence
right up until you ask what the header is sitting in. It now asserts both halves:
the pill shrinks **and** the band does not.

This is the failure mode this document keeps finding, moved one layer out. A
check that cannot see part of its subject is instance 1 through 15. A check that
sees its subject perfectly and was told to look for the wrong thing produces the
same output — green, confident, specific — and is harder to catch, because
nothing about it is broken. The tell is provenance: a test written *from* the
implementation can only ever agree with it.

**17. A negative margin that was invisible until the row wrapped.** The project
filter pills carry `-my-[5px]` so a 44px tap target does not bulk out the row.
On a single line that is correct and invisible. The moment the row wraps —
which it does at every phone width — 10px of negative margin against an 8px row
gap left pills in adjacent rows **overlapping by 2px**, and Chromium hit-tests an
overlap to whichever element paints last. Seven overlapping pairs on a Pixel 7.
A tap near the edge of one pill could apply a different filter, silently and
correctly as far as any code was concerned.

Nothing was watching for it. Every a11y check passed: the targets are 44px, the
contrast is fine, the roles and `aria-pressed` are right. Tap-target *size* is a
standard audit; tap-target *overlap* is not, and a wrapped flex row is exactly
where the two diverge.

The only reason it surfaced is that a Playwright click took 3.7 seconds and the
test suite got slow. The log said `intercepts pointer events` on every retry —
the harness describing the bug accurately, in plain words, for weeks. The
available reading was "flaky test, raise the timeout", and that reading would
have been comfortable, fast, and would have kept a real mobile defect in
production. **Slowness is a symptom with a cause.** Before treating a test as
flaky, get it to say what it is waiting for.

Two rules fall out, both cheap:

- A negative margin on a `flex-wrap` row is only safe while the row does not
  wrap. If the gap is smaller than the margin it cancels, the boxes overlap the
  moment it does. Set the cross-axis gap larger than the negative margin, or do
  not use one.
- Assert that interactive siblings do not overlap, and that each receives the
  hit at its own centre. Both are two lines of `getBoundingClientRect` and
  `elementFromPoint` (`e2e/project-grid.spec.ts`), and neither is covered by any
  standard accessibility audit.

**18. Four checks whose coverage was computed from a formatting convention.**
A separator, an indent, a filename, an import spelling. Each decided how much
the check looked at, and each is the kind of thing an ordinary edit removes
without anyone thinking about the gate at all. Every one of the four then
reported success over the smaller set.

The chatbot eval was the expensive one, because it stands behind a quality
claim rather than a formatting one. `run-eval.mjs` collects fixtures with a
`.json` filename filter and every threshold is a rate, so the question set is
as much a part of the gate as the numbers. Recall@5 misses exactly one fixture.
Rename that one file to `.json.bak` and the eval reports 100.0% instead of
95.0%, and `check-thresholds.mjs` prints *All chatbot eval thresholds pass* and
exits 0. The only n-related failure it had was n of zero, so a report claiming
a perfect score on a single case passed all four checks. **A recall number that
improves when you delete the questions is worse than no number**, because it
looks like the good kind.

The other three were quieter. `check-card-consistency.mjs` splits
`content/products.ts` on a literal newline-brace-newline: move one product's
brace onto its first field's line and it drops from 13 products to 12, prints
`12 products`, exits 0. Its own comment claimed a structural rewrite would make
every product report `PARSE_ERROR`, loudly, not silently skip. True of a total
rewrite, false of the partial one a formatter actually produces, which is the
only kind that happens. Its case-study loader had the same shape one function
over, matching exactly one spelling of an import statement. And
`check-resume-pdf-consistency.mjs` derives each project's anchor by splitting a
heading on `" — "`; rewriting four entries in site style took coverage from
five projects to one and turned the gate green **by making it stop looking**,
which is the sentence worth remembering.

In gh-profile the convention was a join nobody wrote. `check-svgs.mjs` walks
`assets/` and validates what it finds, `check-readme-image-hosts.mjs` walks
`README.md` and validates what it finds, and nothing compared the two sets.
Renaming one asset left a broken image on the live profile with all three CI
gates green.

The general rule, and the one to apply while writing a check rather than while
auditing one:

> **A check is safe when it compares two independently-derived sets, or prints
> a denominator it would notice moving.** Anything else is scoped by a
> convention, and a convention is not a guarantee.

"Independently derived" is the load-bearing half. Two readings that share an
assumption both shrink together and agree with each other all the way down. The
pairs that work here share nothing: a block split against a flat scan of the
same file, an import regex against a directory listing, README references
against files on disk, a computed set against a hand-maintained list. The
hand-maintained list is not a lesser option: pinning the expected set is what
makes shrinking it a deliberate act with a visible diff, which is the whole
difference between updating a gate and quietly disabling it.

The denominator half only counts if something reads it. All four of these
printed one. `13 products`, `5 covered`, `n=20`, the numbers were right there
in CI output the entire time, in a passing run nobody re-reads. **Printing a
number is not the same as checking it.**

This is a different failure from instance 16, and worth keeping separate. There
the test agreed with the implementation because it was written from it. Here
the check is correct about everything it examines and simply examines less than
its name implies, so reading the code closely tells you nothing. The scope
lives in the data's shape, not in the check. The only thing that finds it is
breaking the convention on purpose and watching whether the gate notices.

**19. A test that passed because it was faster than the thing it raced.**
`e2e/heat-toy.spec.ts` asserted `getByText(word, { exact: true })` with no
scope. The Warmer demo renders the guessed word twice: once in the aria-live
history row, and once as an SVG `<text>` label in the embedding plot, a beat
later. Two matches is a strict-mode violation, so the assertion only ever
passed by resolving before the plot caught up. It had been winning that race
since the toy landed. It lost it the first time the machine was busy, and the
failure arrived wearing the costume of a flake, in a batch of genuine
contention failures, which is the worst possible company for a real defect.

This is a fifth shape, and worth separating from the four in instance 18.
Those checks were scoped by a formatting convention: a separator, an indent, a
filename, an import spelling. This one is scoped by **timing**, which is worse
in one specific way. A convention is at least visible in the file, so breaking
it on purpose is a thing you can do deliberately. A race is visible nowhere at
all, and the machine that would expose it is the machine you are least likely
to be developing on. **A green test does not distinguish "the assertion was
right" from "the assertion got there first."**

The measurement lesson came with it, and it is the one from instance 13 again.
Counting the matches right after the history row appeared returned one, which
contradicted the strict-mode violation the failing run had reported. One of
those two was wrong, and the tempting reading is that the failure was noise.
Waiting for the plot to name the word first returns **two unscoped, one
scoped**. The first count was not evidence of anything except that it was
taken too early. *When a fresh measurement disagrees with a recorded failure,
suspect the measurement before the failure* -- the failure at least happened.

The fix is scope, not a wait: the assertion now runs against the aria-live
region, which the plot sits outside, so there is no ordering left to depend on.
Adding a wait would have made it pass reliably while leaving it ambiguous,
which is the same bargain the original locator made.

Two things fall out, and both were applied rather than just written down:

- Worker count is a correctness setting, not a speed setting. The same 386
  tests ran 6.9 minutes at 8 workers with 15 failures, and 4.3 minutes at 4
  with none, on a machine that routinely has several worktrees live. Eight was
  slower *and* wrong. `playwright.config.ts` pins 4, with the numbers in a
  comment, because a worker count derived from core count assumes a machine
  nobody here actually has.
- A suite's exit code has to survive being read carelessly. That 15-failure
  run was recorded as green because the shell chain around it ended in `tail`
  and returned tail's status. `scripts/run-e2e.mjs` now prints the counts and
  the real exit code as the **last** line, in a banner that says FAILED, and
  fails closed on a run it cannot summarise or one that stopped early. It
  cannot change what a pipeline returns, and does not pretend to. It makes the
  status the thing you cannot help seeing.

**20. A tool that leaked into the machine it was measuring.**
`scripts/lighthouse.mjs` creates a throwaway Chrome profile per run and removes
it in a `finally`. The removal fails on Windows, because `chrome.kill()` resolves
when the process is signalled rather than when the OS has released its handles,
so `rmSync` hits a locked directory. The script caught that, printed *temp
profile cleanup failed, ignoring*, and carried on. The comment beside it said a
leftover profile under tmpdir is cosmetic and the OS reclaims it eventually.

It does not. **265 directories holding 3.2 GB**, one per run since the script
was written, each one announced by a warning that said ignoring. They are the
most plausible explanation for the near-full-disk event this repo saw twice and
dismissed twice.

Then they corrupted a measurement, which is the part that makes this an entry
rather than a chore. A Lighthouse run on the wave preview returned 73, 69, 66,
59, 60, declining monotonically while TBT nearly tripled, on a machine carrying
that debris plus nine orphaned Chrome processes the same script had left behind.
The recorded baseline's own values scatter around a mean with no trend, and that
shape difference is the only reason the run was thrown away rather than reported.
**A measuring tool with a side effect on the thing it measures will eventually
measure its own side effect.**

Three things fall out, all applied:

- The dismissal was the defect, not the EPERM. *Cosmetic* and *the OS will
  handle it* are both claims about the future, and neither was ever checked.
  Backoff to about 7.8s clears the lock; what still cannot be removed is
  recorded and reported by count at the end of the run, so the first leak is as
  visible as the 265th.
- A control that only cleans up after itself cannot heal a past leak. The runner
  now sweeps profiles older than 15 minutes at startup, so the debris of every
  previous run goes with the next one. The grace period is what keeps a
  concurrent session's live Chrome safe, which matters here because several
  worktrees run at once by design.
- **Before trusting a measurement, ask what the measuring ran on.** The machine
  is part of the apparatus. This session also found nine orphaned Chrome
  processes from earlier runs, killed by PID rather than by name, and re-measured
  production first in the same session as a control precisely because the
  absolute numbers had drifted: 91, then 88.4, then 83, then 89.8 for the same
  unchanged production page across one evening. Without that control the wave
  would have looked five points worse than it was on one round and five points
  better on another.

**21. A one-line style write that restyled the whole document, and a wrong
explanation that survived because it was never tested.** Two findings from the
same investigation, kept together because the second is what nearly buried the
first.

**Custom properties inherit, so writing one on the root invalidates everything
under it.** `PointerField` set five of them on `<html>` once a frame. Measured on
the deployed page, same element and same frame:

| write | cost |
|---|---|
| one custom property on `<html>` | 17.3ms |
| five custom properties on `<html>` | 19.8ms |
| a regular property on `<html>` | 0.2ms |
| one custom property on a leaf | 0.0ms |

Eighty-six times the cost of a normal property on the same node, for the
property *type* alone. The trap is that it reads as a cheap write: one string
onto one element, no DOM change, no layout thrash. What it actually triggers is
a re-resolve of every element that could inherit it, and an unregistered custom
property gives the engine nothing to narrow that down with. **The cost scales
with the element count of the subtree, not with the number of things that read
the property.** There was exactly one consumer here, `.hero-spotlight`, with no
descendants, and the write was costing a full-document restyle on its behalf:
2918ms of style recalculation across 72,422 styled elements in a 6.3s trace,
which is the main thread roughly 88 percent occupied for over three seconds.
Moving the write to the one element that reads it took it to zero.

Worth knowing before reaching for `@property`: registering with `inherits: false`
would also fix the invalidation, but then descendants cannot read the value at
all, which is usually the reason it was on the root. Scoping the write to the
consumer keeps both.

**The retraction.** Asked whether measuring a preview against production was a
fair comparison, this session argued it could not explain a main-thread number,
on the reasoning that "the same JavaScript blocks the same thread whichever host
served it." That is wrong, and it is wrong in a way that sounds airtight.
**Preview deployments serve extra JavaScript**: Vercel's Live toolbar is injected
on previews and absent on production. A CPU profile put it at 1319ms of self
time, the largest single entry on the page, well ahead of react-dom, GSAP or the
WebGL field.

The claim survived several rounds of measurement because every one of them
compared the two hosts and none of them removed the difference. It only fell
when the script was actually blocked. And the outcome is the uncomfortable part:
**blocking it moved both sides about five points and left the gap where it was,
so the conclusion was right and the argument for it was rubbish.** A correct
conclusion reached by bad reasoning is the hardest kind of error to find, because
nothing downstream of it looks wrong.

The rule that falls out is the one this document keeps arriving at from new
directions: *an argument that a variable cannot matter is not a measurement that
it does not.* Neutralise the variable and look. It cost one flag,
`BLOCKED_URL_PATTERNS_OVERRIDE`, and the runner records it in the artifact so a
comparison can never quietly exclude something without saying so.

**22. A gate that was correct, complete, and never ran.** Every other entry in
this document is about a control that produced output nobody could rely on.
This one produced no output at all, and that is worse in a way worth being
precise about.

`ci.yml` fired on `pull_request` and on pushes to `main`. A long-lived feature
branch with no PR open matched neither trigger. `feat/hero-rebuild` grew to 31
commits that way, and the bundle-size gate, which exists specifically to stop
exactly this, was structurally unable to see a single one of them. The wave
carried **52,795 bytes of eager gzip JS** past a ceiling of 220,160, and it was
discovered only because the branch was later split into PRs, which is to say by
accident of process rather than by any control.

Compare the two nearest shapes. Instance 16 is a check asserting the wrong
thing: it ran, it reported, and its report was misleading. Instance 18 is four
checks whose coverage narrowed silently: they ran, they reported, and the
denominator quietly shrank. **Both were at least running, so both leave
evidence.** A green run with a wrong assertion is a lead; a shrinking
denominator is a number in a log. This left nothing. There is no run to
re-read, no output to check, no denominator to compare, and the absence looks
exactly like a branch that has not been pushed yet.

> **A gate that does not run is not a weak gate. It is no gate, and nothing in
> the output distinguishes the two, because there is no output.**

Which is a special case of this document's opening rule turned on the gate
itself. "I looked and it was fine" and "I never looked" must not produce the
same output, and here they produced the same nothing.

Four gates shared the trigger and were equally blind: `ci.yml` (build, e2e,
bundle size, card consistency, resume consistency, index freshness),
`eval.yml`, `link-check.yml` and `live-link-markers.yml`. The three that run
only on a schedule (`chat-canary.yml`, `live-link-latency.yml`,
`metrics-refresh.yml`) target production rather than a branch and were never in
scope. `ci.yml` and `eval.yml` now fire on pushes to rule 35's branch
vocabulary. The other two are deliberately left as they were, because both make
external network requests and neither gates code; that is a stated choice, and
naming it here is the point, since an unstated exemption is how the next version
of this entry gets written.

What would have failed inside that window, kept separate from what is merely
suspected:

- **The bundle gate, from the third commit of thirty-one.** Measured: 244,075
  bytes at `4566285`, the commit that first imports GSAP and Lenis, and 245,355
  at the branch head. So 29 commits sat over ceiling, unseen.
- **The chatbot index was never stale.** A coarse heuristic flagged one commit
  that touched `content/site.ts` without rebuilding the index; running
  `check-index-fresh` at that commit reports it up to date, because the field
  added there does not feed the index. Recorded as a false positive rather than
  left as an insinuation.
- **Everything else is unaudited, not clean.** Establishing whether e2e or the
  content gates were red at any point across 31 commits means building and
  running each commit, which has not been done. Two near-misses in that window
  were caught locally before landing, which is evidence that the window
  contained real breakage, not evidence that it contained none.

The habit that falls out is cheap and general: **for any gate, ask not only what
it checks but when it fires, and whether the code you care about is inside that
window.** A trigger is part of a control's surface, and it is the part least
likely to be read, because it sits in a file nobody opens once it works.

**23. An exemption that was correct when written and became wrong by outliving
its reason.** A new shape, and the one worth watching for, because nothing about
it ever changes. Every other entry here is a control that was wrong from the
start, or that quietly narrowed. This one was right, stayed exactly as written,
and became wrong because the world moved past it.

Rule 70a's gate 3 lets a PR record an override for a file that genuinely cannot
be split: name the file, record the line count, write the rationale, link the
review that accepted it. That is a good mechanism. The entry was keyed on the
**bare path**.

So gg-portfolio PR #119, a P0 crash fix, recorded overrides for the twenty files
it touched, with a rationale and a verifier link. #119 merged on 2026-08-16.
Months later, an unrelated motion PR touched `app/layout.tsx` for twelve lines,
and the gate applied #119's exemption to it: **twelve lines silently discounted
from a diff, on the strength of a review of a different change.** The rationale
in the entry describes a crash fix. The verifier link points at a closed PR. Both
were still being cited as authority for a diff neither had ever seen.

An audit found that on `main` **2 of 2 entries were live on a justification that
had already merged**, and a further 20 in another workstream's uncommitted work
were in the same state. Not one had expired, because nothing in the design could
expire.

The fix is not a cleanup sweep, and that distinction is the useful part.
**Scoping beats scheduling.** An entry now records the PR whose review justified
it and applies only when that PR is the one being evaluated, so it is inert the
moment it is no longer relevant. There is no cron, no audit job, no list to
prune, and no way for a stale entry to be applied by accident, because staleness
and inapplicability are now the same condition. An unscoped entry is refused
rather than applied, and a caller that does not say which PR it is evaluating
gets no overrides at all, because granting an exemption is the permissive branch.

The general form, which applies well beyond this gate:

> **An exemption needs an expiry condition built into how it is looked up, not a
> promise that someone will remove it.** Anything granted "for this case" and
> stored keyed on something more durable than the case will be applied to cases
> nobody reviewed.

Worth asking of every allowlist, ignore file, `eslint-disable`, suppression, and
carve-out in this repository: what is it keyed on, and is that narrower or wider
than the thing that justified it? A `// eslint-disable-next-line` is scoped to
the line and is fine. A path in an ignore list is scoped to the path and is not.

**24. Two disclosure checks that could not match their own subject.**
Found while writing the disclosure instance 23's fix required, which is the only
reason it was found at all. Gate 3c asks whether a PR body discloses a gate
override, and matched on `gate.?override`. Gate 4b asks the same about the
sensitive-path allowlist, and matched on `gate.?4.?allowlist`.

`.?` is one optional character. So a heading written the way anyone would write
it, **`## Gate 3 override disclosure`**, failed a check asking about gate 3's
override, because `" 3 "` is three characters and not one. `gate 4 allowlist`
failed gate 4b for the same reason. The only phrasings that satisfied these
checks were ones nobody writes: `gate override`, `gate4allowlist`.

Same family as instance 18, a control scoped by an incidental formatting
convention, with the failure pointing the other way. Instance 18's checks passed
while covering too little. These **failed while their subject was correctly
disclosed**, which is the safe direction to be wrong in, and still wrong: a gate
that rejects compliance teaches people to write for the regex instead of for the
reader, and the next author's fix is a worse disclosure that happens to match.

Both are named compiled patterns now, accepting either word order and an
optional gate number, with cases for the phrasings that used to fail and for a
body that discloses nothing. The lesson is small and repeats often: **when a
check reads prose, test it against how the sentence is actually written**, not
against the shortest string that satisfies the author of the regex.

**25. A rule's prose and its implementation drift, and only one of them is the
authority.** Small, and it happened three times in one wave, which is what makes
it worth its own entry rather than a footnote on the others.

Each time the shape was identical: read a rule's description, report a
conclusion from it, and be wrong because the code had moved.

- Rule 70a's gate-3 text lists four designated globs, so `package-lock.json`
  was reported as counting against the 400-line ceiling. The implementation had
  matched it explicitly since 2026-08-11. The gate was already correct and the
  sentence describing it was not.
- The override allowlist was reported as 22 entries with 20 citing PR #119. On
  `main` there are two. The other twenty were **uncommitted working-copy
  changes** in a shared checkout sitting on another workstream's branch, read as
  though they were the live mechanism.
- The multi-file `gg_approval` requirement was cited as an existing constraint
  while designing around it. It is on that same unlanded branch. The incident
  behind it is real; the code enforcing it is not on `main`.

Three wrong reports, none of which a careful reading of the prose would have
prevented, because the prose was the problem. And the third is the sharpest,
because a working copy looks exactly like the truth: same path, same file,
opens in the same editor.

> **A rule's description, a comment, and a working copy are all secondary. The
> committed implementation on the default branch is the only authority, and the
> cost of checking it is one command.**

The practical form: before reporting what a gate does, run it or read it at
`origin/main`, not at `HEAD`, and never from a checkout someone else may be
editing. `git show origin/main:path` is the whole discipline. This is also why
the local approval check in the whole-PR waiver is deliberately self-contained
rather than calling a shared helper: a validator that depends on code which may
or may not be present is a validator that can silently stop validating.

**26. A guard that can only ever read the copy of itself sitting next to it.**
A design constraint rather than a defect, worth writing down because it is
invisible until it bites and it has now bitten twice in one day.

`hook_guard_merge.py` locates the gate it runs with one line:

```python
MERGE_GATE = str(Path(__file__).with_name("merge_gate.py"))
```

A hard-coded sibling. **No environment variable, no config key, and nothing in
`settings.json` parameterises it** beyond the absolute path to the hook itself.
So the gate that decides whether a merge may proceed is always the copy in
whatever checkout the hook happens to live in, including that checkout's
*uncommitted working-tree edits*.

Which means a fix landing on `main` does not reach the hook. Two merges were
blocked by this on the same afternoon, both by a gate whose fix was already
merged: one on a line-count rule that a whole-PR waiver had been built and landed
specifically to satisfy, and one on a sensitive-path false positive whose
allowlist entry was sitting on `main` at the time. Neither gate was wrong about
the code it was reading. Both were reading code from before the fix.

The trap has three edges, and the third is the one to remember:

- **A merged fix is not a deployed fix** when the consumer resolves its
  dependency by filesystem adjacency rather than by version.
- **The hook cannot be redirected without writing into that checkout**, which
  makes "just point it at main" unavailable exactly when the checkout belongs to
  another session with work in progress.
- **The working tree wins over the committed tree.** The hook reads the file, not
  the ref, so uncommitted edits in a shared checkout silently become the live
  policy for every session on the machine. This is instance 25's contaminated
  authority one layer up: there, a working copy was mistaken for the truth while
  reading; here, a working copy *is* the truth while enforcing.

No fix attempted, on purpose. Every available route writes into a checkout that
another session has uncommitted work in, and the merge itself can be done through
the GitHub web UI where no hook fires at all, so the hazard buys nothing. Recorded
so the next person who wonders why a landed gate fix changed nothing does not have
to rediscover the one line that explains it.

**27. A metric that improved because the measurement window closed early.** The
hero's WebGL field was the largest contributor to a Total Blocking Time
regression, so its work was deferred until after first paint. Lighthouse then
reported home's TBT at 118ms against roughly 870ms before. The number was real
and the conclusion drawn from it was not.

Home's score turned out to be bimodal across runs: 63, 89, 90, 90, 90, with TBT
of 907, 180, 118, 143, 118. The first instinct, a cold first run, was wrong.
`/ask` measured alone shows no such spike, every run gets its own fresh Chrome
and profile, and the pattern reproduced on a fully warm server.

The raw traces gave it up. On the 907ms run: 20 long tasks reaching 5150ms, TTI
6046ms, and the GSAP and ScrollTrigger chunk at 2739ms of bootup. On the 118ms
run: 2 long tasks, TTI 3462ms, that same chunk at 264ms. The field arrives about
3.4 seconds in, so it lands inside the trace only when the trace happens to run
long enough. The fast runs were not observing cheaper work. They were stopping
before the work happened.

So the deferral relocated the cost rather than removing it. Observed TBT is
907ms against roughly 870ms before, which is no material improvement on the
runs that actually watch. What did improve is real but narrower than the
headline: the first three seconds are clear, and TTI is 3462ms instead of
6046ms when the field does not intrude.

The shape to remember is not "Lighthouse is noisy". It is that **an
optimisation which moves work later, past the point a measurement stops
looking, produces a genuine improvement in the metric and no improvement in the
thing the metric stands for.** Deferral and removal are indistinguishable to any
instrument with a closing window, and deferral is the far easier of the two to
achieve by accident. Before believing a large improvement from a change that
moved when work happens, find the run where the work is still in frame and read
that one. A mean with a wide spread is the tell: it is two populations, not one
noisy measurement, and averaging them hides the case you needed to see.

**28. A suite that graded a different worktree's build for a full run.**
`playwright.config.ts` pinned `baseURL` to `http://localhost:3000` with
`reuseExistingServer: !process.env.CI`. Port 3000 was already held by a
`next start` belonging to `gg-portfolio-wt-verify-119`, running since the
previous day. Playwright adopted it. Every test then reported on a different
branch's build while naming this one.

It passed. 381 passed, 5 skipped, exit 0, and that result was reported as a
merge gate. Nothing in the run was wrong-looking, because a green suite against
the wrong target looks exactly like a green suite.

It only surfaced hours later, and by luck: the foreign server had gone stale and
begun answering 500, so axe scanned an error page and reported 24 accessibility
violations of the `document-title` and `html-has-lang` kind. Those were absurd
enough to chase. Had that server stayed healthy, the mistake would have merged
with a full gate set behind it.

The config even carried a comment noting that GG runs several worktrees at once,
as justification for its worker count. The same fact makes a fixed port unsafe,
and that connection went unmade for as long as the file existed.

Fixed by deriving the port from the checkout's own path, so anything listening
on it can only be this worktree's server. The general form: **a control that
addresses its subject by a name shared with other subjects is not addressing its
subject.** A fixed port, a bare `git status` with no directory, a hard-coded
sibling path (instance 26) are all the same error, and all of them answer
confidently about the wrong thing rather than failing.

**29. A copy rule with a build script inside its blind spot.** `check-no-em-dash.mjs`
names its own scope, which is the thing this document keeps asking for: string
literals and JSX in `components/**` and `app/**`, string literals in
`content/**`, and named fields of two `content/*.json` files. Everything about
that is honest. It is also a description of where the copy is *written*, and
some of the copy is *assembled*.

Every citation under an `/ask` answer renders a `sourceLabel`, and every one of
them is built in `scripts/chatbot/build-index.mjs` from a template like
`` `${cs.title} case study — Results: ${r.label}` ``. **All 565 of them carried
an em dash.** They render as the visible text of a link, directly under an
answer, on the page the site invites a reader to interrogate. The check was
green every run for months.

Three things make this worth its own entry rather than a footnote on 18:

- **The blind spot is a directory, and directories are how people reason about
  scope.** `scripts/` is obviously not site copy, right up until a script
  concatenates two strings a visitor reads. Nothing about the rule was wrong;
  its surface was drawn around authorship rather than around destination, and
  those two came apart at exactly one file.
- **It was found by counting, not by reading.** Reading the check confirms it
  does what it says. Reading the indexer confirms it builds labels. Only
  counting em dashes in the built artifact puts the two together. This is the
  same method that found the earlier `content/*.json` gap the check's own
  header describes, which means the method worked twice and the lesson from
  the first time was applied to the file rather than to the class.
- **The fix needed an exemption, and the exemption needed a denominator.** 115
  of the labels quote a `provenance.md` heading verbatim, and that file is
  already a documented exclusion because rewriting a quoted heading falsifies a
  citation. So the exemption follows the text into the label. It is printed,
  not skipped: `783 rendered JSON field(s) ... plus 301 exempt as quoted
  provenance headings`. A field a check declined to judge still has to reach
  the denominator, or "I looked and it was fine" and "I did not look" are the
  same number again.

The question that generalises, and it is not "what does this check scan": **for
every string a visitor reads, which check reaches the place it is assembled,
as opposed to the place it is written?**

**30. The same alarm for a dead vendor and an off-topic question.** Instance 12
recorded a guard that reported "could not verify" as "confirmed outage". This is
the same defect with the sign flipped, in this repo, on the surface the site is
proudest of.

Groq retired `llama-3.3-70b-versatile` on 2026-08-16. `/ask` refuses every
question in production from that moment. `groqProvider.complete()` fails soft to
`null`, exactly as designed, and `route.ts` turns that `null` into
`refusalAnswer()` — the same bytes it returns when retrieval scores below
threshold, which is what an off-topic question produces. Three unrelated
failures, one response.

`chat-canary.yml` did everything right. It fires every six hours, asks a real
answerable question, treats `refused: true` as a failure, opens an issue, and
comments on it. It went red on schedule and reported: **"pipeline did not
produce a grounded answer"**. That sentence is true on a healthy day for an
out-of-scope question, so it named nothing, and the failure sat for two days.

What is uncomfortable is how close the canary came. Its own comment lists the
candidate causes in the right order: *"e.g. GROQ_API_KEY missing/revoked, or the
retrieval index broken"*. The author knew there were several. The response body
could not say which, so the check could only report the union.

The route *did* know: it logs `provider: "none"` for the retrieval gate and
`provider: "groq"` for a failed completion. The information existed, one process
boundary away from the only reader who needed it. **A diagnosis available in a
log the alarm cannot read is not available to the alarm.**

Fixed by putting the reason in the response — `no_grounding`,
`provider_unavailable`, `unvalidated_citations`, `server_error`,
`embeddings_unavailable` — and having the canary print the matching runbook
line. The reader still sees one sentence, because a visitor cannot act on "the
vendor retired a model" differently than on "ask something else". The
distinction was never for them.

The durable half is not the model swap. **A pinned model id is a dependency
with an expiry date that nothing in the repo watches**, and the next one expires
too. What changed is that the next expiry is named on its first firing rather
than on its third day.

**31. A test whose comment overstated what the test reached.** Small, and a new
shape: every other entry here is a defect in a control. This is a defect in the
*claim about* a control, written by someone who had just built it and had every
reason to believe the claim.

`e2e/ask-deep-links.spec.ts` loads every case study and asserts each anchor the
chatbot index emits resolves to a real element. Its first docblock said it would
catch a wrong anchor in the shared module "even though every producer agrees".

Checked, because the habit is to check. Renaming a section title in
`lib/case-study-anchors.ts` renames the heading and the emitted anchor together,
and **all 34 tests still pass**. The claim was false.

The test is not weaker than it should be — for this property, both sides
agreeing *is* correctness, since the link lands on the right heading whatever it
is called. What it really guards is an anchor the indexer emits that the page
never renders, and that sabotage fails 26 of 34. Both facts are now in the file.

The lesson is about where a wrong sentence about a control ends up. Nobody
re-derives a test's reach from scratch; they read the comment. A docblock
claiming more than the assertions deliver is a check that covers less than its
name, moved one layer out into prose, where no gate looks at all. **Write down
the sabotage that fails a test, not the one you assume would.**

**32. Grading a build while rebuilding underneath it.** Instance 28 in a new
costume, committed the same day it was read.

Verifying that new tests fail against a reverted fix: sabotage two components,
`npm run build`, run the suite. Eight of ten failed, including two that had no
business failing. The result looked like evidence and was noise: a `next start`
launched earlier was still serving `.next` while the build rewrote it
underneath, so the suite graded a directory in motion, some routes stale and
some fresh. Playwright's `reuseExistingServer` adopted it, correctly, because
the port was this checkout's own.

Killing the server by PID and re-running produced the clean result: **exactly
the two sabotaged behaviours failed, the other three passed.**

The tell was that the failure set was larger and less specific than the
sabotage. A negative control that fails *more* than it should is as broken as one
that fails less, and much easier to accept, because failing is what it was
supposed to do. **When a sabotage run fails more tests than the sabotage
explains, suspect the apparatus before the code.**

The narrower rule: `reuseExistingServer` is correct for speed and unsafe across
a rebuild. The port fix from instance 28 guarantees the server belongs to this
worktree. It cannot guarantee it is serving this build.

**33. A gate hard-coded to a port, and the plausibility floor that saved it.**
Found in the same session and worth keeping, because it is the good outcome.

`scripts/check-bundle-size.mjs` defaults to `http://localhost:3000`. A two-day-old
`next start` from another worktree was listening there. The gate ran, fetched
that server's page, summed its chunks, and reported:

```
FAIL — POLYFILL_MISSING: polyfill chunk(s) totaled only 21 bytes gzip within
this route's 231-byte total, well under the 5000-byte plausibility floor
(historical reference: 39,627 bytes)
```

231 bytes for a whole route. The gate did not know it was talking to the wrong
server and did not need to: it knew what its own answer should roughly look
like, and refused an implausible one instead of reporting it.

This is the shape worth copying. Instance 28's fix was to make the port
unambiguous, which is right and specific. This is the general version:
**a check that knows the order of magnitude of its own correct answer can
reject a wrong target without ever identifying it.** The failure it caught is
not one it was written for.

Left as-is deliberately. `BASE_URL_OVERRIDE` exists, CI runs its own server on a
fresh runner, and the floor catches the local case loudly. Deriving the port
here the way `playwright.config.ts` does would be tidier, and it is recorded as
a known sharp edge rather than fixed on the way past.

## What follows from it

- **Name the surface.** For every check, state which paths, which entries, which
  identities it actually reaches. If you cannot state it, you do not know it.
- **Scope a copy rule by where the string is read, not by where it is typed.**
  A directory boundary tracks authorship, and a build script that concatenates
  two strings a visitor reads sits on the wrong side of it. For every string a
  visitor reads, ask which check reaches the place it is *assembled*
  (instance 29).
- **A diagnosis that lives only in a log the alarm cannot read is not available
  to the alarm.** If two failures need different responses, the difference has
  to travel in the artifact the monitor actually receives, not in a log one
  process boundary away (instance 30).
- **Write down the sabotage that fails a test, not the one you assume would.**
  Nobody re-derives a test's reach from scratch; they read the comment. A
  docblock claiming more than the assertions deliver is a check covering less
  than its name, moved into prose where no gate looks (instance 31).
- **When a sabotage run fails more tests than the sabotage explains, suspect the
  apparatus.** A negative control that fails too much is as broken as one that
  fails too little, and far easier to accept, because failing is what it was
  meant to do (instance 32).
- **Give a check a sense of the magnitude of its own correct answer.** A gate
  that knows roughly what its result should look like can reject a wrong target
  without ever identifying it, which catches failures it was never written for
  (instance 33).
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
