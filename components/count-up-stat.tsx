"use client";

import { useEffect, useState } from "react";

const NUMBER_PATTERN = /^([^\d]*)(\d+(?:\.\d+)?)(.*)$/;

function zeroState(value: string): string {
  const match = value.match(NUMBER_PATTERN);
  if (!match) return value;
  const [, prefix, numStr, suffix] = match;
  const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
  return `${prefix}${(0).toFixed(decimals)}${suffix}`;
}

/**
 * Animates a stat's leading number from 0 up to its real value once, on
 * mount. Parses the numeric prefix out of strings like "9", "50M+",
 * "$10M+" and animates just that part, keeping the suffix/prefix static —
 * so "$10M+" counts 0 -> 10 while "$" and "M+" stay put.
 *
 * Initial state is always the zero-state (matches what SSR renders, so no
 * hydration mismatch regardless of the client's motion preference).
 * prefers-reduced-motion is handled by collapsing the animation duration
 * to 0 inside the rAF callback, not a bare effect-body setState.
 */
export function CountUpStat({ value }: { value: string }) {
  const [display, setDisplay] = useState(() => zeroState(value));

  useEffect(() => {
    const match = value.match(NUMBER_PATTERN);
    if (!match) return;

    const [, prefix, numStr, suffix] = match;
    const target = parseFloat(numStr);
    const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduceMotion ? 0 : 900;
    const start = performance.now();

    function tick(now: number) {
      const progress = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = (target * eased).toFixed(decimals);
      setDisplay(`${prefix}${current}${suffix}`);
      if (progress < 1) requestAnimationFrame(tick);
      else setDisplay(value);
    }

    const frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span>{display}</span>;
}
