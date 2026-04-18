/**
 * InkCursor — small terracotta dot that follows the pointer and grows on
 * hover over interactive elements. Skipped on touch devices and under
 * reduced motion. The native system cursor is hidden via global CSS only on
 * the marketing page wrapper.
 */
import { useEffect, useRef } from "react";

export function InkCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const ringRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(pointer: coarse)").matches) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let frame = 0;
    let hovering = false;

    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      const target = e.target as HTMLElement | null;
      const isInteractive = !!target?.closest(
        'a, button, [role="button"], input, textarea, select, [data-cursor="hover"]',
      );
      hovering = isInteractive;
    };

    const tick = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%) scale(${
        hovering ? 1.8 : 1
      })`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    document.documentElement.classList.add("ink-cursor-on");
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.classList.remove("ink-cursor-on");
    };
  }, []);

  return (
    <>
      <div
        ref={ringRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[70] hidden md:block size-8 rounded-full border border-terracotta/50 transition-[width,height,background-color] duration-200 ease-out"
        style={{ willChange: "transform" }}
      />
      <div
        ref={dotRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[71] hidden md:block size-1.5 rounded-full bg-terracotta"
        style={{ willChange: "transform" }}
      />
    </>
  );
}
