/**
 * The 7-step opacity ramp that carries cluster identity in the Warmer
 * embedding viewer.
 *
 * Shared by the static SVG layer and the WebGL layer so the two cannot drift:
 * they render the same 419 points and must agree on what each cluster looks
 * like, or swapping between them would visibly re-colour the field.
 *
 * One accent, seven opacities — cluster identity never gets a second hue.
 */
export const WARMER_CLUSTER_OPACITY = [0.22, 0.32, 0.42, 0.52, 0.62, 0.72, 0.82] as const;

/**
 * The hero's ramp, shared by its static SVG and its WebGL layer for the same
 * reason.
 *
 * Much fainter than the Warmer viewer's, and deliberately so: the hero cloud
 * sits behind headline copy, and the brief for it was explicit that noticing
 * the background before the text is a failure. The ceiling stays under the
 * 0.26 peak of the gradient halo this replaced.
 */
export const HERO_CLUSTER_OPACITY = [0.14, 0.2, 0.26, 0.32, 0.38, 0.44, 0.5] as const;

/**
 * perf/lcp-final Task 4 — shared by both new project-embedding surfaces (the
 * case-study "explore in 3D" toggle and the /projects grid ambient layer) so
 * neither can drift from the other. Same fainter-than-Warmer ceiling as the
 * hero ramp: both new surfaces sit behind or beside real page content, never
 * as the primary focus.
 */
export const PROJECT_CLUSTER_OPACITY = [0.18, 0.26, 0.34, 0.42, 0.5, 0.58, 0.66] as const;
