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
