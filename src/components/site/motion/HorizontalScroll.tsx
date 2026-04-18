/**
 * HorizontalScroll — pins a section and translates its inner track sideways
 * based on vertical scroll progress. Falls back to a normal horizontal
 * overflow-scroll container under reduced motion.
 */
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { gsap, ScrollTrigger, ensureGsapRegistered, prefersReducedMotion } from "@/lib/gsap";

export function HorizontalScroll({
  children,
  className,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;
    if (disabled || prefersReducedMotion()) return;
    ensureGsapRegistered();

    // Switch from the SSR-safe overflow-scroll layout to pinned/translated
    // mode now that we know we can animate.
    track.classList.remove("overflow-x-auto", "snap-x", "snap-mandatory", "pb-6");
    track.classList.add("will-change-transform");
    track.style.width = "max-content";

    const getDistance = () => Math.max(0, track.scrollWidth - window.innerWidth);

    const tween = gsap.to(track, {
      x: () => -getDistance(),
      ease: "none",
      scrollTrigger: {
        trigger: section,
        start: "top top",
        end: () => `+=${getDistance()}`,
        pin: true,
        scrub: 0.5,
        invalidateOnRefresh: true,
        anticipatePin: 1,
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [disabled]);

  return (
    <section ref={sectionRef} className={className}>
      <div ref={trackRef} className="flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory">
        {children}
      </div>
    </section>
  );
}
