# gg-portfolio — Claude Code notes

## Parallel sessions: worktrees required, never a shared checkout

If more than one Claude Code session may be working in this repo at the same time,
each session must work in its own `git worktree`, never in a shared checkout. Two
sessions checking out different branches in the same working directory is not safe —
`HEAD` is a single pointer per checkout, and one session's `git checkout` silently
moves it out from under the other.

**Failure mode observed (2026-08-06):** two sessions were both operating in the same
`gg-portfolio` checkout — one on `fix/metric-freshness-issue-45`, the other on
`feat/provenance-interaction`. One session checked out its own branch mid-way through
the other's edit. HEAD moved with no error and no warning; the first session's
in-progress, uncommitted edits landed as a real commit on its original branch that
session never issued `git commit` for, then found itself checked out on the other
session's branch entirely. The work was recovered (the auto-landed commit turned out
to contain the intended diff), but only because it was caught and manually verified
before continuing — a session that trusted its own `git status` output without
re-checking `git branch --show-current` first could have kept editing files that were
now the wrong branch's content, or built a commit message describing changes that
weren't actually staged.

**Before starting work in this repo, run `git worktree list`.** If another worktree
already exists for the branch you're about to touch, use it — do not check that
branch out a second time anywhere else; `git worktree add` will refuse for exactly
this reason if you try. If no worktree exists yet for your branch, create one:

```
git worktree add ../gg-portfolio-<short-workstream-name> <branch>
```

Do not use the primary `gg-portfolio` checkout directory for direct feature work
once more than one workstream is active — treat it as the base clone worktrees are
created from, and keep its own `HEAD` in a detached or otherwise unclaimed state so
it never contends with a dedicated worktree for the same branch.

# Run the e2e suite after touching content labels, metric IDs, or rendered copy

`npm run typecheck`, `npm run build` and the metric checks all pass clean while
the e2e suite is broken, because the tests locate elements by their **rendered
accessible names**. Renaming a results-row label or a metric ID moves a locator
target that nothing else in the toolchain looks at.

This broke the same branch twice in one day, both times after the other checks
were green:

- renaming `triageiq:classifier-top3` to per-repo entries changed six labels and
  broke three provenance tests and two axe tests, in a file there was no obvious
  reason to suspect;
- adding a results row labelled "Cluster separation, base vs fine-tuned …" broke
  the Warmer toggle test, because Playwright's `getByRole({ name })` matches a
  **substring** by default — the new row's provenance button also matched
  `"Fine-tuned"`, a strict-mode violation that reads as "the toggle is broken."

So: after any edit touching `content/**` labels, `metrics.json` IDs, or copy
that renders, run `npx playwright test` before pushing — the whole suite, not
the specs that look related. Both times the surprising failures were in files
that would not have been guessed at.

When adding a label, prefer `exact: true` in new locators; the substring default
makes collisions a matter of luck about future copy.

**Rebuild the chatbot index too.** The same edits feed
`content/chatbot/index.json` — adding case-study rows for the metric splits took
it from 509 to 518 chunks and failed CI's "Verify chatbot index is up to date"
step, on the same branch, after everything else was green. Run
`node scripts/chatbot/build-index.mjs` and commit the result. A stale index is
not cosmetic: it has broken `main` twice.

The reflex after a content edit is therefore three things, none of which
typecheck or build will tell you about: **e2e suite, chatbot index, metric
checks.**

# Never run an unscoped process kill

`taskkill //F //IM node.exe` (or any equivalent — `pkill -f node`, `killall node`)
terminates **every** Node process on the machine, not just the one you started.
GG runs multiple worktrees and parallel sessions in this repo by design — an
unscoped kill can destroy another session's in-flight `npm ci`/build/dev-server
mid-write with no warning. This is a real, standing candidate explanation for
two previously-unexplained incidents: round 1's `npm ci` `EPERM` on a locked
native SWC binary (13 concurrent `node.exe` processes at the time), and a
near-full-disk event during a later round's worktree-heavy session. Neither was
conclusively attributed, but an unscoped kill fits both and should not be
risked again now that the mechanism is known.

**Kill by PID, scoped to the exact process you started, or don't kill it at
all.** Capture the PID when you launch a background server (`node ... &
echo $!`, or read it back via `Get-NetTCPConnection -LocalPort <port> |
Select OwningProcess` if the launcher's own PID doesn't own the socket — see
round-1's note on this exact gotcha), then kill only that PID
(`kill <pid>` / `taskkill /F /PID <pid>`). If you can't identify the specific
PID with confidence, leave the process running and say so rather than
reaching for a broad kill.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
