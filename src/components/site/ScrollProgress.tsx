/**
 * ScrollProgress — a 1px terracotta line at the top of the viewport that
 * tracks page scroll progress. Pure DOM/CSS, no GSAP needed.
 */
import { useEffect, useRef } from "react";

export function ScrollProgress() {
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bar = barRef.current;
    if (!bar) return;

    let frame = 0;
    const update = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0;
      bar.style.transform = `scaleX(${progress})`;
    };
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-px bg-terracotta/20"
    >
      <div
        ref={barRef}
        className="h-full origin-left bg-terracotta"
        style={{ transform: "scaleX(0)", transition: "transform 60ms linear" }}
      />
    </div>
  );
}
