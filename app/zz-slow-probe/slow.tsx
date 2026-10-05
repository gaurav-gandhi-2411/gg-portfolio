"use client";

import { useEffect, useState } from "react";

// Throwaway Lighthouse probe: burns ~1.5s of main thread on mount to force a long task / high TBT.
export function Slow() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const end = performance.now() + 1500;
    let x = 0;
    while (performance.now() < end) x += Math.sqrt(x + 1);
    setN(Math.round(x));
  }, []);
  return <p>probe {n}</p>;
}
