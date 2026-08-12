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
