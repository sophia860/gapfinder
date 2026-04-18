/**
 * Hero — oversized serif headline with masked word reveal, subtle grain
 * background, and a small CTA cluster. Headline copy preserved verbatim
 * from the previous landing page.
 */
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { RevealWords, RevealBlock } from "@/components/site/motion/Reveal";
import { MagneticButton } from "@/components/site/motion/MagneticButton";

export function Hero() {
  return (
    <section className="relative px-6 lg:px-12 pt-40 pb-32 md:pt-48 md:pb-48 max-w-6xl mx-auto">
      <RevealBlock>
        <p className="font-mono text-xs uppercase tracking-widest text-terracotta mb-6">
          Issue No. 1 — for makers, founders, freelancers
        </p>
      </RevealBlock>

      <h1 className="font-serif font-medium leading-[0.92] tracking-[-0.04em] text-balance text-[clamp(3.5rem,9vw,9rem)]">
        <RevealWords as="span" className="block">
          Find a real gap.
        </RevealWords>
        <RevealWords as="span" className="block italic text-terracotta">
          Build something
        </RevealWords>
        <RevealWords as="span" className="block">
          honest.
        </RevealWords>
      </h1>

      <RevealBlock delay={0.2}>
        <p className="mt-10 max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed text-pretty">
          GapFriend is an AI co-pilot that helps you spot gaps in the market, pressure-test ideas
          with synthetic customers, and turn the good ones into a name, a plan, tasks, content, and
          a working website or app — without writing any code (unless you want to).
        </p>
      </RevealBlock>

      <RevealBlock delay={0.3}>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/auth">
            <MagneticButton className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground h-12 px-7 text-base font-medium hover:bg-primary/90 transition-colors">
              Start free →
            </MagneticButton>
          </Link>
          <a
            href="#how"
            className="inline-flex items-center justify-center rounded-full border border-border bg-background h-12 px-7 text-base font-medium hover:bg-secondary transition-colors"
          >
            How it works
          </a>
        </div>
      </RevealBlock>

      {/* Soft scroll hint */}
      <div
        aria-hidden="true"
        className="mt-24 hidden md:flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground"
      >
        <span className="inline-block h-px w-10 bg-muted-foreground/40" />
        scroll
      </div>
    </section>
  );
}
