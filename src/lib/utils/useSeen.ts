"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Whether an element has come near the screen yet — and, once it has, it
 * stays seen. A fabric's tile is drawn only when its swatch is about to show:
 * sixty tiles drawn at once is what makes a picker slow on a phone, and until
 * then the swatch is its fabric's own average colour.
 */
export function useSeen(ref: RefObject<Element | null>, margin = "160px"): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (seen) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: margin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen, margin]);
  return seen;
}
