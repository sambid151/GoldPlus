"use client";

import { useEffect } from "react";

const MAX_WAIT_MS = 10_000;

/**
 * Sections stream in and change height after first paint, which pushes a deep link
 * (e.g. /#calculator) off target. Re-align whenever the page height changes, until
 * the user starts scrolling or MAX_WAIT_MS passes.
 */
export function HashScroller() {
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;

    let interacted = false;
    const stop = () => void (interacted = true);
    const events = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    events.forEach((e) => window.addEventListener(e, stop, { once: true, passive: true }));

    const observer = new ResizeObserver(() => {
      if (interacted) return observer.disconnect();
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    });
    observer.observe(document.body);
    const timer = window.setTimeout(() => observer.disconnect(), MAX_WAIT_MS);

    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, stop));
    };
  }, []);

  return null;
}
