import { expect, test } from "@playwright/test";

/**
 * BL-9's core constraint: the tier-2 model must not be fetched, loaded, or
 * referenced in any way that causes it to download on page load. This is
 * the ONE test file in this feature that does NOT block the model's real
 * network requests — the whole point is capturing genuine request evidence
 * that laziness holds, not reading the code and assuming it. Mirrors
 * e2e/ask.spec.ts's precedent of letting the real local ONNX pipeline load
 * over the network in e2e (see that file's comment on the /ask submit
 * test's generous timeout) — same real download, this time in the browser
 * rather than the Playwright-launched Node server.
 *
 * A request is classed as "model traffic" if it targets an `.onnx` file or
 * any huggingface.co-hosted path — the same predicate
 * e2e/project-search.spec.ts's blockModelNetwork() uses to block it, used
 * here instead to detect it.
 */
function isModelRequest(url: string): boolean {
  const parsed = new URL(url);
  return /\.onnx(\?|$)/.test(parsed.pathname) || parsed.hostname.endsWith("huggingface.co");
}

test("zero model requests on page load; the model loads only after the search box is focused", async ({
  page,
}) => {
  const allRequests: string[] = [];
  const modelRequestsBeforeFocus: string[] = [];
  let focused = false;

  page.on("request", (req) => {
    allRequests.push(req.url());
    if (!focused && isModelRequest(req.url())) modelRequestsBeforeFocus.push(req.url());
  });

  await page.goto("/projects");
  // Give any accidental eager fetch (a stray top-level import, a prefetch)
  // a real window to fire before asserting its absence — an assertion
  // made immediately after goto only proves "not yet", not "never".
  await page.waitForTimeout(2000);

  expect(
    modelRequestsBeforeFocus,
    `expected zero model requests before the search box is focused, got: ${JSON.stringify(modelRequestsBeforeFocus, null, 2)}`
  ).toEqual([]);

  const requestsOnLoad = [...allRequests];

  const input = page.getByRole("combobox", { name: /search projects/i });
  await input.focus();
  focused = true;

  // Real download over a real connection — generous timeout matching
  // ask.spec.ts's precedent for this exact class of wait (local ONNX model
  // cold start), not a guess.
  await expect
    .poll(() => allRequests.some(isModelRequest), {
      message: "expected at least one model request to fire after focusing the search box",
      timeout: 45_000,
    })
    .toBe(true);

  const modelRequestsAfterFocus = allRequests.filter(isModelRequest);

  // The evidence this whole test exists to produce — pasted into the PR
  // description verbatim, not summarized.
  console.log(
    "BL-9 network evidence — requests on page load (" +
      requestsOnLoad.length +
      " total, 0 model):\n" +
      JSON.stringify(requestsOnLoad, null, 2)
  );
  console.log(
    "BL-9 network evidence — model requests fired after focus:\n" +
      JSON.stringify(modelRequestsAfterFocus, null, 2)
  );

  expect(modelRequestsAfterFocus.length).toBeGreaterThan(0);
});
