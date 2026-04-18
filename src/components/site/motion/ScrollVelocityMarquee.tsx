/**
 * ScrollVelocityMarquee — auto-scrolling tag strip whose speed (and direction)
 * is nudged by the user's scroll velocity, like Uneevo's footer marquee.
 *
 * Implementation notes:
 * - Children are duplicated once so the loop is seamless.
 * - Base x-translation is driven by a gsap.ticker; ScrollTrigger.getVelocity()
 *   adds a transient delta on top of the base speed.
 * - Under reduced motion, the strip is rendered as a static line.
 */
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { gsap, ensureGsapRegistered, prefersReducedMotion } from "@/lib/gsap";

export function ScrollVelocityMarquee({
  children,
  baseSpeed = 40, // pixels per second
  className,
  disabled,
}: {
  children: ReactNode;
  baseSpeed?: number;
  className?: string;
  disabled?: boolean;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const track = trackRef.current;
    if (!track) return;
    if (disabled || prefersReducedMotion()) return;
    ensureGsapRegistered();

    const halfWidth = () => track.scrollWidth / 2;
    let offset = 0;
    let direction = -1;
    let lastTime = performance.now();
    let lastScrollY = window.scrollY;
    let scrollVelocity = 0;

    const onScroll = () => {
      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      const dy = window.scrollY - lastScrollY;
      // px/sec, smoothed
      scrollVelocity = scrollVelocity * 0.6 + (dy / dt) * 1000 * 0.4;
      lastScrollY = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const tick = () => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const velocity = scrollVelocity / 800; // dampened
      // Decay so the boost fades when scrolling stops.
      scrollVelocity *= 0.92;
      if (Math.abs(velocity) > 0.5) direction = velocity > 0 ? -1 : 1;

      const speed = baseSpeed + Math.min(Math.abs(velocity) * 200, 600);
      offset += direction * speed * dt;

      const w = halfWidth();
      if (w > 0) {
        if (offset <= -w) offset += w;
        if (offset >= 0) offset -= w;
      }
      gsap.set(track, { x: offset });
    };

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("scroll", onScroll);
    };
  }, [baseSpeed, disabled]);

  return (
    <div ref={wrapperRef} className={className} aria-hidden="true">
      <div className="overflow-hidden">
        <div ref={trackRef} className="flex gap-12 whitespace-nowrap will-change-transform">
          {children}
          {/* Duplicate for seamless loop — hidden from AT to avoid double-read. */}
          <div className="flex gap-12" aria-hidden="true">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
