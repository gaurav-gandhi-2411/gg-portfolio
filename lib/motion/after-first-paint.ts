/**
 * When a deferred enhancement is allowed to arrive.
 *
 * One implementation, shared by everything that waits: the scroll driver, the
 * nav indicator, the hero scrubs and the hero's WebGL field. It exists because
 * the rule below is subtle enough to get wrong once, and having it in two places
 * means getting it wrong twice.
 *
 * The rule: requestIdleCallback's `timeout` is a ceiling, not a floor. It fires
 * at the first idle moment, and on an unthrottled machine the first idle moment
 * after load is immediate. Passing 2500 and reading it as "wait up to 2.5s" got
 * the hero field mounting 105ms after load, inside the window blocking time is
 * measured in, which would have moved work without moving the number and looked
 * like a fix that was not one.
 *
 * So the minimum is a timer and idle is only asked for afterwards. A visitor who
 * does something gets the enhancement at once; a visitor who does nothing gets it
 * a beat after the page is theirs to use.
 */

/**
 * Anything that means a person is present. `scroll` is on the list because it is
 * the first thing that happens on a phone, where there is no cursor to move.
 */
const PRESENCE_EVENTS = ["pointerdown", "pointermove", "wheel", "touchstart", "keydown", "scroll"] as const;

/** Asked for only after the minimum has elapsed, never as the way to wait. */
const IDLE_GRACE_MS = 1000;

/**
 * Runs `arrive` once, on the first presence event or on the first idle moment at
 * least `minimumMs` after `load`, whichever comes first.
 *
 * @returns a teardown that cancels everything if it has not fired yet.
 */
export function onPresenceOrIdle(arrive: () => void, minimumMs: number): () => void {
  let fired = false;
  let idleHandle: number | null = null;
  let waitTimer: number | null = null;

  const fire = () => {
    if (fired) return;
    fired = true;
    teardown();
    arrive();
  };

  const afterLoad = () => {
    waitTimer = window.setTimeout(() => {
      const ric = window.requestIdleCallback;
      if (ric) idleHandle = ric(fire, { timeout: IDLE_GRACE_MS });
      else fire();
    }, minimumMs);
  };

  function teardown() {
    for (const type of PRESENCE_EVENTS) window.removeEventListener(type, fire);
    window.removeEventListener("load", afterLoad);
    if (idleHandle !== null) window.cancelIdleCallback?.(idleHandle);
    if (waitTimer !== null) window.clearTimeout(waitTimer);
  }

  for (const type of PRESENCE_EVENTS) {
    window.addEventListener(type, fire, { passive: true, once: true });
  }
  if (document.readyState === "complete") afterLoad();
  else window.addEventListener("load", afterLoad, { once: true });

  return teardown;
}
