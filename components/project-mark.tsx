/**
 * Concept C follow-up (GG, 2026-08-22): every project gets its own logo,
 * used wherever a project is named — the card, the case-study header, a
 * related-projects entry. They have to read as a family and sit inside the
 * site's own identity rather than competing with the monogram
 * (public/logo-mark.svg), not just be fourteen unrelated glyphs bolted on.
 *
 * The family resemblance is structural, not just "similar-looking":
 * - Same construction discipline as the monogram itself — monoline strokes,
 *   stroke-width 4.2, round caps/joins, no fill except the rare accent dot,
 *   64x64 viewBox.
 * - Every mark carries the same background device: a fragment of the
 *   monogram's own arc geometry (a partial ring at the monogram's own
 *   radius, ~15.5, centred at 32,32), rendered at low opacity in the
 *   project's own hue. It's the literal geometric DNA the monogram is built
 *   from, echoed at low volume behind whatever glyph is specific to that
 *   project — the part of each mark that says "this belongs to the same
 *   site," independent of what the foreground glyph is.
 * - One hue throughout, at two weights — the ring at low opacity as quiet
 *   background texture, the glyph at full strength as the thing actually
 *   read — rather than the monogram's own equal-weight two-colour split,
 *   which works there because the shape itself (two interlocking arcs) IS
 *   the identity; here the glyph has its own job (reading as a target, a
 *   fork, a wave) and a second full-strength colour would compete with it
 *   rather than support it. The hue itself is lib/project-rhythm.ts's
 *   projectHue — the same number every border, glow, and case-study rule
 *   mark on that project's pages already uses, so a logo and its own case
 *   study are never two independently-chosen colours.
 * - The inner glyph itself is a plain, literal read of what the project
 *   concretely does (a target for a "warmer/colder" word game, a routing
 *   fork for an issue triager, a gauge for a scoring tool) rather than an
 *   abstract mark — simple enough to hold up at favicon size, the way the
 *   monogram itself is four paths and nothing else.
 */

export type ProjectMarkId =
  | "triageiq"
  | "warmer"
  | "multimodal-fashion-recommender"
  | "style-maitri"
  | "shelfsense"
  | "aetherart"
  | "agentgauge"
  | "reclaim"
  | "reviewiq"
  | "gold-rate-tracker"
  | "dealhunter"
  | "tracegauge"
  | "adk-tracegauge"
  | "expense-tracker";

const GLYPHS: Record<ProjectMarkId, React.ReactNode> = {
  // TriageIQ — one issue, routed to the stage it belongs in.
  triageiq: (
    <path d="M32 15 L32 30 M32 30 L19 47 M32 30 L45 47" />
  ),
  // Warmer — a target: how close your guess landed to the secret word.
  warmer: (
    <>
      <circle cx="32" cy="32" r="17" />
      <circle cx="32" cy="32" r="9" />
    </>
  ),
  // Multimodal Fashion Recommender — a hanger.
  "multimodal-fashion-recommender": (
    <path d="M32 15 C 37 15 37 22 32 24 M32 24 L14 42 L50 42 L32 24" />
  ),
  // Style Maitri — a sparkle, for an occasion-styling assistant.
  "style-maitri": (
    <path d="M32 12 L36 28 L52 32 L36 36 L32 52 L28 36 L12 32 L28 28 Z" />
  ),
  // ShelfSense — demand across three horizons, read at a glance.
  shelfsense: (
    <path d="M16 46 L48 46 M20 46 L20 34 M32 46 L32 24 M44 46 L44 16" />
  ),
  // AetherArt — a cresting wave, the ukiyo-e style it was fine-tuned on.
  aetherart: (
    <path d="M13 39 C 20 28 26 28 32 34 C 38 40 44 40 51 29 M44 29 Q 49 24 46 19" />
  ),
  // AgentGauge — a dial and a needle: does the change actually move the score.
  agentgauge: (
    <>
      <path d="M16 41 A 16 16 0 0 1 48 41" />
      <path d="M32 41 L43 27" />
    </>
  ),
  // Reclaim — space given back, the recovery arc of an undo.
  reclaim: <path d="M45 20 A 18 18 0 1 0 47 45 M47 45 L53 41 M47 45 L51 51" />,
  // Samidha Reviews (reviewiq) — the rating a review is actually about.
  reviewiq: (
    <path d="M32 14 L37 27 L51 27 L40 36 L44 50 L32 42 L20 50 L24 36 L13 27 L27 27 Z" />
  ),
  // Gold Rate Tracker — a coin, and the honest flat line inside it.
  "gold-rate-tracker": (
    <>
      <circle cx="32" cy="32" r="17" />
      <path d="M23 35 L28 30 L33 33 L41 24" />
    </>
  ),
  // DealHunter — a heading, not a destination fixed in advance.
  dealhunter: <path d="M13 34 L51 17 L34 51 L28 36 Z" />,
  // tracegauge — the trace a session actually leaves behind.
  tracegauge: <path d="M12 32 L21 32 L25 18 L31 46 L35 25 L39 32 L52 32" />,
  // adk-tracegauge — the same trace, framed: the same measurement, wrapped for a different SDK.
  "adk-tracegauge": (
    <>
      <path d="M17 21 L13 21 L13 43 L17 43 M47 21 L51 21 L51 43 L47 43" />
      <path d="M20 32 L26 32 L29 24 L34 40 L37 27 L40 32 L44 32" />
    </>
  ),
  // Expense Tracker — a receipt, one line spent at a time.
  "expense-tracker": (
    <>
      <path d="M19 14 L45 14 L45 50 L41 46 L37 50 L33 46 L29 50 L25 46 L21 50 L19 46 Z" />
      <path d="M25 23 L39 23 M25 30 L35 30" />
    </>
  ),
};

/**
 * cx/cy 32,32, radius 15.5 — literally the monogram's own two arcs
 * (public/logo-mark.svg), reused as a low-opacity ring behind every
 * project's own glyph so the family resemblance is a real shared shape,
 * not just a shared stroke width.
 *
 * `mark-idle-ring` (app/globals.css) gives this ring its own idle life — a
 * slow opacity breathe, gated behind the parent `.mark-idle` class and
 * running on a plain timer, never on scroll or pointer position. Only the
 * ring breathes; the glyph inside it (the thing actually being read) never
 * dims, so the mark stays fully legible while still being alive.
 */
function IdentityRing() {
  return (
    <circle
      cx="32"
      cy="32"
      r="15.5"
      opacity="0.22"
      className="mark-idle-ring"
      style={{ stroke: "var(--mark-accent)" }}
    />
  );
}

export function ProjectMark({
  id,
  hue,
  className,
  size = 40,
}: {
  id: ProjectMarkId;
  /** Degrees — content/products.ts's projectHue(allProducts, slug), so a
   * project's logo, its case-study rule mark, and its card border are
   * always the same colour computed from the same one place. */
  hue: number;
  className?: string;
  size?: number;
}) {
  const glyph = GLYPHS[id];
  if (!glyph) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={4.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-hidden="true"
      className={className}
      style={
        {
          "--mark-accent": `oklch(var(--accent-l) var(--accent-c) ${hue})`,
          // Desyncs this instance's idle breathe from every other mark on the
          // same page (a related-projects entry and its own card, say) — a
          // negative delay starts the animation already partway through its
          // cycle instead of every mark visibly pulsing in lockstep.
          // Deterministic from the project's own hue, not Math.random(), so
          // server and client render the same value.
          "--mark-idle-delay": `${-((hue % 12) * 0.5)}s`,
        } as React.CSSProperties
      }
    >
      <IdentityRing />
      <g style={{ stroke: "var(--mark-accent)" }}>{glyph}</g>
    </svg>
  );
}
