/**
 * GSAP setup — registers ScrollTrigger once on the client and exposes a
 * `useGsap` hook that wraps animations in a `gsap.context()` so cleanup is
 * automatic when the calling component unmounts.
 *
 * GSAP and ScrollTrigger are MIT/free-tier plugins. Premium plugins (SplitText,
 * ScrollSmoother, etc.) are intentionally NOT used.
 */
import { useLayoutEffect, useRef, type DependencyList, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Observer } from "gsap/Observer";

let registered = false;

export function ensureGsapRegistered() {
  if (registered) return;
  if (typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger, Observer);
  registered = true;
}

/** True when the user has requested reduced motion. SSR-safe (false on server). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Run a GSAP setup function inside a context scoped to a ref. Animations and
 * ScrollTriggers created inside `setup` are automatically reverted on unmount.
 *
 * The setup callback is skipped entirely when reduced motion is requested, so
 * the underlying DOM stays in its static, fully-readable initial state.
 */
export function useGsap<T extends HTMLElement = HTMLElement>(
  setup: (ctx: { self: T }) => void,
  deps: DependencyList = [],
): RefObject<T | null> {
  const ref = useRef<T | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const node = ref.current;
    if (!node) return;
    if (prefersReducedMotion()) return;
    ensureGsapRegistered();

    const ctx = gsap.context(() => {
      setup({ self: node });
    }, node);

    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

export { gsap, ScrollTrigger, Observer };
