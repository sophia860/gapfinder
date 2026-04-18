/**
 * Parallax — translates children on scroll. Negative speed scrolls slower
 * (foreground feel), positive scrolls faster (background feel).
 */
import { type ReactNode, useLayoutEffect, useRef } from "react";
import { gsap, ScrollTrigger, ensureGsapRegistered, prefersReducedMotion } from "@/lib/gsap";

export function Parallax({
  children,
  speed = 0.2,
  className,
  disabled,
}: {
  children: ReactNode;
  /** Fraction of the trigger height to translate. ~0.1–0.5 looks good. */
  speed?: number;
  className?: string;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const node = ref.current;
    if (!node) return;
    if (disabled || prefersReducedMotion()) return;
    ensureGsapRegistered();

    const distance = () => node.offsetHeight * speed;
    const trigger = ScrollTrigger.create({
      trigger: node,
      start: "top bottom",
      end: "bottom top",
      scrub: true,
      onUpdate: (self) => {
        gsap.set(node, { y: -distance() * (self.progress - 0.5) * 2 });
      },
    });

    return () => trigger.kill();
  }, [speed, disabled]);

  return (
    <div ref={ref} className={className} style={{ willChange: "transform" }}>
      {children}
    </div>
  );
}
