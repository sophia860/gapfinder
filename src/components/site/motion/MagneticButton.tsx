/**
 * MagneticButton — pointer-follow micro-interaction. Skipped on touch
 * devices and under reduced motion. Native focus rings preserved by passing
 * children through unchanged.
 */
import { type ButtonHTMLAttributes, type ReactNode, useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "@/lib/gsap";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  /** Maximum pixel offset from rest position. */
  strength?: number;
};

export function MagneticButton({ children, strength = 14, className, ...rest }: Props) {
  const ref = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) return;
    if (window.matchMedia?.("(pointer: coarse)").matches) return;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const relX = e.clientX - (rect.left + rect.width / 2);
      const relY = e.clientY - (rect.top + rect.height / 2);
      gsap.to(el, {
        x: (relX / rect.width) * strength * 2,
        y: (relY / rect.height) * strength * 2,
        duration: 0.4,
        ease: "power3.out",
      });
    };
    const onLeave = () => {
      gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: "elastic.out(1, 0.5)" });
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [strength]);

  return (
    <button ref={ref} className={className} {...rest}>
      {children}
    </button>
  );
}
