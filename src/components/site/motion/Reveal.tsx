/**
 * Reveal — masked text reveal triggered by ScrollTrigger.
 *
 * Splits the inner string into <span> wrappers (lines or words) and animates
 * each with a clip-path mask + y-translate when the section enters the
 * viewport. No premium SplitText plugin needed.
 *
 * Word splitting is straightforward (split by whitespace). "Line" splitting
 * here approximates lines using browser-measured offsetTop after layout —
 * good enough for marketing headlines and avoids a full SplitText port.
 *
 * Both variants render plain readable text on the server / under reduced
 * motion / when JS fails — animation only enhances the static markup.
 */
import { type ElementType, type ReactNode, useLayoutEffect, useRef } from "react";
import { gsap, ScrollTrigger, ensureGsapRegistered, prefersReducedMotion } from "@/lib/gsap";

type RevealProps = {
  children: string;
  as?: ElementType;
  className?: string;
  /** Delay between each line/word in seconds. */
  stagger?: number;
  /** Per-element animation duration in seconds. */
  duration?: number;
  /** Disable animation imperatively (in addition to reduced-motion). */
  disabled?: boolean;
};

function useTextReveal(
  ref: React.RefObject<HTMLElement | null>,
  mode: "lines" | "words",
  {
    stagger = 0.08,
    duration = 0.9,
    disabled = false,
  }: Pick<RevealProps, "stagger" | "duration" | "disabled">,
) {
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const node = ref.current;
    if (!node) return;
    if (disabled || prefersReducedMotion()) return;
    ensureGsapRegistered();

    const text = node.textContent ?? "";
    if (!text.trim()) return;

    // Build wrappers: outer (overflow hidden mask) + inner (translated content).
    const buildWrap = (content: string) => {
      const outer = document.createElement("span");
      outer.className = "reveal-mask";
      const inner = document.createElement("span");
      inner.className = "reveal-inner";
      inner.textContent = content;
      outer.appendChild(inner);
      return { outer, inner };
    };

    // Clear node and rebuild.
    node.textContent = "";
    const inners: HTMLElement[] = [];

    if (mode === "words") {
      const words = text.split(/(\s+)/); // keep spaces between words
      for (const w of words) {
        if (/^\s+$/.test(w)) {
          node.appendChild(document.createTextNode(w));
        } else if (w.length > 0) {
          const { outer, inner } = buildWrap(w);
          node.appendChild(outer);
          inners.push(inner);
        }
      }
    } else {
      // Lines: best-effort — split by newline characters; otherwise treat the
      // whole string as one line. Marketing headlines typically use explicit
      // <br/> which we don't see here, so callers can pre-break with newlines.
      const lines = text.split(/\n/);
      lines.forEach((line, i) => {
        if (i > 0) node.appendChild(document.createElement("br"));
        if (line.length === 0) return;
        const { outer, inner } = buildWrap(line);
        node.appendChild(outer);
        inners.push(inner);
      });
    }

    if (inners.length === 0) return;

    gsap.set(inners, { yPercent: 110 });
    const tween = gsap.to(inners, {
      yPercent: 0,
      duration,
      stagger,
      ease: "power3.out",
      scrollTrigger: {
        trigger: node,
        start: "top 85%",
        once: true,
      },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [ref, mode, stagger, duration, disabled]);
}

export function RevealLines({
  children,
  as: Tag = "span",
  className,
  stagger,
  duration,
  disabled,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  useTextReveal(ref, "lines", { stagger, duration, disabled });
  return (
    <Tag ref={ref as React.Ref<HTMLElement>} className={className} data-reveal="lines">
      {children}
    </Tag>
  );
}

export function RevealWords({
  children,
  as: Tag = "span",
  className,
  stagger = 0.05,
  duration = 0.8,
  disabled,
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  useTextReveal(ref, "words", { stagger, duration, disabled });
  return (
    <Tag ref={ref as React.Ref<HTMLElement>} className={className} data-reveal="words">
      {children}
    </Tag>
  );
}

/**
 * RevealBlock — masked reveal for arbitrary children (not just strings).
 * Useful for cards, images, etc. Uses opacity + y-translate.
 */
export function RevealBlock({
  children,
  className,
  delay = 0,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const node = ref.current;
    if (!node) return;
    if (disabled || prefersReducedMotion()) return;
    ensureGsapRegistered();

    gsap.set(node, { opacity: 0, y: 24 });
    const tween = gsap.to(node, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      delay,
      ease: "power3.out",
      scrollTrigger: { trigger: node, start: "top 88%", once: true },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [delay, disabled]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
