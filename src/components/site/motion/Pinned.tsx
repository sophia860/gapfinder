/**
 * Pinned — pins a section while running an internal scrubbed timeline that
 * cross-fades between phrases / slides. Keyboard scrolling and tabbing still
 * work because ScrollTrigger pinning doesn't trap input.
 */
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { gsap, ScrollTrigger, ensureGsapRegistered, prefersReducedMotion } from "@/lib/gsap";

export function PinnedPhrases({
  phrases,
  className,
  disabled,
}: {
  phrases: string[];
  className?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const node = ref.current;
    if (!node) return;
    if (disabled || prefersReducedMotion()) return;
    if (phrases.length <= 1) return;
    ensureGsapRegistered();

    const items = node.querySelectorAll<HTMLElement>("[data-phrase]");
    if (items.length === 0) return;

    gsap.set(items, { opacity: 0, y: 24 });
    gsap.set(items[0], { opacity: 1, y: 0 });

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: node,
        start: "top top",
        end: () => `+=${window.innerHeight * (phrases.length - 1) * 0.9}`,
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
      },
    });

    items.forEach((el, i) => {
      if (i === 0) return;
      tl.to(items[i - 1], { opacity: 0, y: -24, duration: 1 }, "+=0.3").to(
        el,
        { opacity: 1, y: 0, duration: 1 },
        "<",
      );
    });

    return () => {
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [phrases, disabled]);

  return (
    <div ref={ref} className={className}>
      <div className="relative h-screen flex items-center justify-center">
        <div className="relative w-full">
          {phrases.map((p, i) => (
            <p
              key={i}
              data-phrase
              className="absolute inset-0 flex items-center justify-center text-center"
            >
              {p}
            </p>
          ))}
          {/* Static fallback for no-JS / reduced-motion: first phrase visible. */}
          <p className="invisible" aria-hidden="true">
            {phrases[0]}
          </p>
        </div>
      </div>
    </div>
  );
}
