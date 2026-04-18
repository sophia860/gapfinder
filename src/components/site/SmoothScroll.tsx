/**
 * SmoothScroll — Lenis-driven smooth-scroll wrapper for the marketing pages.
 *
 * Mounted ONLY on routes that don't start with `/app`. Lenis's RAF loop is
 * piped into `ScrollTrigger.update` so GSAP scroll-driven timelines stay in
 * sync with the eased scroll position.
 *
 * Disabled entirely under `prefers-reduced-motion`, on touch-only devices
 * (where native momentum scrolling is preferred), and during SSR.
 */
import { useEffect } from "react";
import Lenis from "lenis";
import { ScrollTrigger, ensureGsapRegistered, prefersReducedMotion } from "@/lib/gsap";

export function SmoothScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (prefersReducedMotion()) return;

    // Skip on coarse-pointer (touch) devices — native momentum is better there.
    const isTouch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    if (isTouch) return;

    ensureGsapRegistered();

    const lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    const onScroll = () => ScrollTrigger.update();
    lenis.on("scroll", onScroll);

    // Refresh ScrollTrigger after layout settles so pin positions are correct.
    const refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 50);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(refreshTimer);
      lenis.off("scroll", onScroll);
      lenis.destroy();
    };
  }, []);

  return null;
}
