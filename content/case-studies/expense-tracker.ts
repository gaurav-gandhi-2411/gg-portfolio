import type { CaseStudy } from "../types";

// Sources: expense-tracker repo (CURRENT_STATE.md) — see provenance.md's
// Expense Tracker section. STATUS (wave 19, 2026-07-31): the backend outage
// documented below was fixed 2026-07-26 (commit 7f1e15c, migrated off the
// dead Supabase project) and is now confirmed live (curl /health -> 200).
// The frontend is a SEPARATE, still-open outage — 404/DEPLOYMENT_NOT_FOUND,
// live-verified this wave — so no liveUrl ships on the product card (a dead
// link is worse than no link). See provenance.md's wave-19 addendum for the
// full timeline, including a second frontend outage between wave 16's
// 2026-07-26 200-OK check and this wave.
export const expenseTracker: CaseStudy = {
  slug: "expense-tracker",
  verifiedAt: "2026-07-31", // wave 19 -- last re-checked against source this session
  title: "Expense Tracker",
  dek: "A multi-user personal-finance app built to practice production discipline, real auth, real data isolation, real migrations, real tests, with a few pragmatic ML features layered on top.",
  depth: "short",
  problem: [
    "This is a personal expense tracker, and it's framed honestly: it's a product used to practice the discipline that separates a working demo from something that could hold real user data, proper multi-user authentication, per-user data isolation enforced at the query level, versioned schema migrations, and a real test suite, not a research artifact chasing a novel metric.",
    "On top of that production base sit a few pragmatic ML features: natural-language expense entry, narrative spending insights, automatic categorization, anomaly detection, and short-term forecasting, each scoped to what a personal-finance tool actually needs rather than what's academically interesting.",
  ],
  approach: [
    "The backend is FastAPI, deployed to Google Cloud Run, backed by Postgres in production and SQLite locally, with Alembic migrations versioning the schema (three migrations shipped so far, a baseline, one adding the `user_id` column and index for multi-user support, and one isolating the app onto a dedicated schema on a shared Supabase project after the original project went dark). Auth runs through Supabase Auth with dual-algorithm JWT verification: ES256 via a JWKS endpoint in production, HS256 for local and test tokens. Every one of the 15 non-health endpoints requires a valid token, and every database query filters on the current user's ID, cross-user access returns a 404, not a 403, so a stranger's data isn't even revealed to exist.",
    "The Next.js 16 frontend deploys to Vercel and talks to the backend through a proxy that keeps Supabase's SSR cookie refresh working across redirects. On the ML side, a Groq-backed LLM parses free-text entries like \"coffee 150\" into structured expenses and writes short narrative insights, while three local models run without any external API call: a sentence-embedding categorizer, an IsolationForest anomaly detector, and a Prophet forecaster, each with documented low-confidence and fallback behavior, and each checked by a manual (non-CI) eval script rather than a CI-gated one.",
  ],
  architecture: {
    intro: "A standard multi-user web app shape, with ML features bolted on as optional endpoints rather than load-bearing infrastructure.",
    stages: [
      { label: "Next.js 16 frontend", kind: "input", detail: "Vercel, sign-in, expense CRUD, NL entry hero" },
      { label: "Supabase Auth", detail: "JWT, ES256/JWKS in prod, HS256 locally" },
      { label: "FastAPI backend", detail: "Cloud Run, 16 endpoints, all but /health require auth" },
      {
        label: "ML features",
        parallel: [
          { label: "Groq LLM", detail: "NL parsing + narrative insights" },
          { label: "Sentence-embedding categorizer" },
          { label: "IsolationForest", detail: "anomaly detection" },
          { label: "Prophet", detail: "forecasting" },
        ],
      },
      { label: "Postgres (prod) / SQLite (dev)", kind: "output", detail: "per-user filtered queries, Alembic-migrated" },
    ],
  },
  results: [
    {
      label: "Test suite",
      value: "143/143 passing",
      detail: "ruff clean, mypy clean (strict=false)",
      sourceRef: "expense-tracker:tests",
    },
    {
      label: "Deployment",
      value: "Cloud Run (backend) is live; Vercel (frontend) is down",
      detail:
        "backend found down 2026-07-18, root-caused and fixed 2026-07-26 (migrated off a dead Supabase project onto a dedicated schema on a shared one, /health returns 200 as of this writing); the frontend's Vercel deployment 404s (DEPLOYMENT_NOT_FOUND), a separate, still-open outage, said here rather than a dead link on the product card; 9/9 Playwright auth E2E scenarios pass locally",
      sourceRef: "expense-tracker:state",
    },
    {
      label: "Local ML features",
      value: "categorizer, anomaly detection, forecasting, each with documented fallback behavior",
      detail: "evaluated with manual scripts (scripts/eval_parser.py, scripts/eval_ml.py), not gated in CI",
      sourceRef: "expense-tracker:ml-features",
    },
  ],
  closing: [
    "If you need to evaluate whether someone can ship past a working demo to something that could hold real user data, this is the checklist worth applying: per-user isolation enforced at the query level (not just the UI), versioned migrations, and a real test suite, the boring production discipline a screenshot can't show you.",
  ],
  links: [
    { label: "Source on GitHub", href: "https://github.com/gaurav-gandhi-2411/expense-tracker" },
  ],
};
