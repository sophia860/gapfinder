/**
 * ClosingCta — full-viewport closing statement. The headline scales and
 * unmasks via clip-path as the section enters the viewport. Footer below.
 */
import { useLayoutEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { gsap, ScrollTrigger, ensureGsapRegistered, prefersReducedMotion } from "@/lib/gsap";

export function ClosingCta() {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const headlineRef = useRef<HTMLHeadingElement | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const section = sectionRef.current;
    const headline = headlineRef.current;
    if (!section || !headline) return;
    if (prefersReducedMotion()) return;
    ensureGsapRegistered();

    gsap.set(headline, {
      scale: 0.85,
      clipPath: "inset(40% 0% 40% 0%)",
    });
    const tween = gsap.to(headline, {
      scale: 1,
      clipPath: "inset(0% 0% 0% 0%)",
      ease: "power3.out",
      scrollTrigger: {
        trigger: section,
        start: "top 80%",
        end: "bottom bottom",
        scrub: 0.6,
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, []);

  return (
    <>
      <section
        ref={sectionRef}
        className="px-6 lg:px-12 py-32 md:py-48 max-w-7xl mx-auto text-center"
      >
        <h2
          ref={headlineRef}
          className="font-serif font-medium tracking-[-0.04em] text-balance text-[clamp(3rem,10vw,10rem)] leading-[0.92] text-terracotta"
        >
          Ready to find your gap?
        </h2>
        <p className="mt-10 max-w-xl mx-auto text-lg md:text-xl text-muted-foreground leading-relaxed">
          Spend an afternoon with GapFriend. Walk away with one idea worth building — or none, with
          reasons.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/auth">
            <Button size="lg" className="rounded-full px-8 h-12 text-base">
              Start free →
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border px-6 lg:px-12 py-8 text-xs text-muted-foreground font-mono uppercase tracking-widest flex justify-between">
        <span>GapFriend</span>
        <span>Made with care</span>
      </footer>
    </>
  );
}
