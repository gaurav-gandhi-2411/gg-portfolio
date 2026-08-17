import type { FullConfig } from "@playwright/test";

/**
 * Pays the chatbot's cold start once, before any test runs.
 *
 * Three /ask tests failed on main and two more flaked on the same run, all of
 * them the ones that submit a question. They wait 20s for "Thinking…" to clear,
 * and the spec's own comment already named why that number is generous: the
 * first request into /api/chat loads the local ONNX retrieval model, and on a
 * fresh runner it downloads it first. Whichever test happens to be first pays
 * all of that inside its own timeout.
 *
 * Measured on a local production build, same server, three requests:
 *
 *   warm disk cache, first request     2.00s
 *   empty disk cache, first request    5.41s
 *   every subsequent request           0.015s to 0.027s
 *
 * A 200x difference, entirely on the first call. Reproducing CI's 20s is a
 * different matter and this did not manage it: a 2-core runner on a cold
 * network is slower than this machine by some factor nobody here has measured,
 * so the honest claim is that the mechanism is confirmed and its CI magnitude
 * is inferred, not that 20s was reproduced.
 *
 * The fix is not a bigger timeout. Instance 17 in CHECKS.md is about exactly
 * that trade: raising a limit makes a symptom rarer and leaves the cause in
 * place. This moves the cold start out of every test's critical path, so no
 * test is ever the one that pays it.
 *
 * Deliberately does not throw. If the warm-up cannot reach the route the tests
 * are about to exercise, failing here would replace a clear test failure with a
 * confusing setup error, so it warns loudly and lets the suite run and say what
 * is actually wrong. The warning is the signal that this run's greenness is
 * back to depending on a race.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL ?? process.env.PLAYWRIGHT_BASE_URL;
  if (!baseURL) {
    console.warn("[global-setup] no baseURL resolved, skipping chatbot warm-up");
    return;
  }

  const started = Date.now();
  try {
    const res = await fetch(new URL("/api/chat", baseURL), {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Any answerable question does it. The point is the model load, not the
      // answer, and nothing asserts on what comes back.
      body: JSON.stringify({ question: "What Hinglish bug did Warmer have?" }),
      signal: AbortSignal.timeout(180_000),
    });
    const seconds = ((Date.now() - started) / 1000).toFixed(2);
    if (!res.ok) {
      console.warn(
        `[global-setup] chatbot warm-up got HTTP ${res.status} after ${seconds}s. ` +
          "The cold start has NOT been absorbed and the submit-flow tests are racing it again."
      );
      return;
    }
    console.log(`[global-setup] chatbot warm-up done in ${seconds}s, retrieval model now loaded`);
  } catch (err) {
    console.warn(
      `[global-setup] chatbot warm-up failed after ${((Date.now() - started) / 1000).toFixed(2)}s: ` +
        `${err instanceof Error ? err.message : String(err)}. ` +
        "The cold start has NOT been absorbed and the submit-flow tests are racing it again."
    );
  }
}
