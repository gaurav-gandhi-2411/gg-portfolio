# Wave 2 performance/quality budgets — 2026-07-12

Measured against a **local production build** (`npm run build && npm run start`), not the
dev server — dev-mode React/Next overhead would misrepresent real numbers (rule 65b: no
invented or unrepresentative metrics). Raw Lighthouse JSON: `lighthouse-2026-07-12.json`
(accessibility/best-practices/SEO/agentic-browsing categories; this Lighthouse run excludes
performance — LCP/CLS below are from a separate Chrome DevTools performance trace, same
production server).

**Caveat on LCP:** measured on `localhost` with no network or CPU throttling — real users
hitting the actual Vercel deployment will see higher LCP due to real network RTT. This number
is a useful regression signal (build didn't get objectively slower), not a promise of the
field-observed number. No CrUX field data exists yet for this brand-new domain.

## Results vs. budget (spec.md rule 15e: JS ≤150KB, LCP ≤1.5s, CLS ≤0.05)

| Metric | Budget | Measured | Status |
|---|---|---|---|
| Initial JS (gzip, homepage) | ≤150 KB | **161.3 KiB** (165,135 bytes) | **OVER by 11.3 KiB (7.5%)** |
| LCP | ≤1.5s | 171 ms | PASS (localhost, unthrottled — see caveat) |
| CLS | ≤0.05 | 0.00 | PASS |
| Lighthouse Accessibility | — | 100 | — |
| Lighthouse Best Practices | — | 96 | 1 finding, see below |
| Lighthouse SEO | — | 100 | — |
| axe-core violations | 0 | 0 | PASS (`npx @axe-core/cli`) |

## JS bundle breakdown (gzip, as measured via `curl -H "Accept-Encoding: gzip"`, confirmed
against response headers — `Content-Encoding: gzip` present, `Transfer-Encoding: chunked`)

| Chunk | Size (gzip) |
|---|---|
| `0iec5q4ack_04.js` (React + Next.js App Router runtime) | 69.3 KiB |
| `20msfz3016icq.js` | 37.9 KiB |
| `0rim7jnyhao6s.js` | 16.8 KiB |
| `14mumt5_n0xhi.js` | 13.5 KiB |
| `12ng9y1xmtxdd.js` | 10.6 KiB |
| `09bbkqv9yi88w.js` | 7.3 KiB |
| `turbopack-0tku3z-ude9fy.js` | 4.1 KiB |
| `3-c5bii1rqffh.js` | 1.6 KiB |
| `1d4h-sglyo8ft.js` | 0.3 KiB |
| **Total** | **161.3 KiB** |

**Honest assessment — not chased down further this wave:** the largest chunk (69.3 KiB) is
React 19 + the Next.js 16 App Router client runtime, which is close to unavoidable baseline
cost for this stack. The remaining ~92 KiB is app code + `@base-ui/react` (shadcn's
non-Radix primitive layer) + `lucide-react` + `class-variance-authority`/`tailwind-merge`.
Chasing the remaining 11.3 KiB would mean either swapping out base-ui for hand-rolled
primitives (meaningful architecture change, not justified by an 11 KiB miss on a portfolio
site) or auditing per-component import weight in detail — deferred as a named follow-up
rather than rushed under this wave's time budget. **Flagging as open, not silently passing.**

## Best Practices: 1 finding (96/100)

`errors-in-console` — one console error: `/_vercel/insights/script.js` returns 404. Confirmed
this is a **local-server-only artifact**: `@vercel/analytics`'s script is served by Vercel's
actual edge infrastructure and doesn't exist on a bare `next start`. Verified the real
deployed URL returns 200 for the same path (`curl https://gaurav-gandhi.vercel.app/_vercel/insights/script.js`
→ `200`, checked same day). Not a real defect — would score 100 if Lighthouse ran against
production.

## A11y contrast re-check (post dark+indigo remap)

Full WCAG 2.1 contrast calculations in `app/globals.css`'s token-file comment. Headline: the
original border color pick (`#2C2F36`) only hit **1.47:1** against the background — badly
failing the 3:1 non-text-contrast requirement for UI component boundaries (chip/card
outlines would have been nearly invisible). Raised to `#62656E` (3.38:1 on background, 3.16:1
on card). All text pairs (body, muted, accent) clear 6:1+, well above the 4.5:1 AA minimum.
