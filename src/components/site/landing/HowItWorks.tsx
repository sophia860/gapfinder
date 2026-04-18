/**
 * HowItWorks — sticky left intro column, scrolling right column of step cards.
 * Replaces the previous 4-up grid; copy preserved verbatim.
 */
import { RevealBlock, RevealLines } from "@/components/site/motion/Reveal";

const STEPS = [
  {
    n: "01",
    title: "Find a gap",
    body: "GapFriend learns about you, then proposes 3–5 real, tailored market gaps you could actually go after.",
  },
  {
    n: "02",
    title: "Pressure-test it",
    body: "Simulate synthetic customers to surface objections, hooks, and a verdict before you waste a month.",
  },
  {
    n: "03",
    title: "Run the business",
    body: "Naming, domains, channels, break-even, tasks, and content threads — all in one calm dashboard.",
  },
  {
    n: "04",
    title: "Ship it",
    body: "Vibe-code a website with AI or jump into a full coding workspace. No code required, but full power available.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="px-6 lg:px-12 py-32 md:py-48 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Sticky intro */}
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <RevealBlock>
              <p className="font-mono text-xs uppercase tracking-widest text-terracotta">
                What it does
              </p>
            </RevealBlock>
            <h2 className="mt-4 font-serif font-medium tracking-[-0.02em] text-balance text-[clamp(2.25rem,4.5vw,4rem)] leading-[1.02]">
              <RevealLines as="span" className="block">
                {"Three quiet steps\nfrom hunch\nto tiny business."}
              </RevealLines>
            </h2>
            <RevealBlock delay={0.15}>
              <p className="mt-6 max-w-md text-muted-foreground leading-relaxed">
                A calm sequence — not a checklist — for solo founders who want to find something
                real and ship it without burning out.
              </p>
            </RevealBlock>
          </div>
        </div>

        {/* Scrolling steps */}
        <div className="lg:col-span-7 space-y-6">
          {STEPS.map((s, i) => (
            <RevealBlock key={s.n} delay={i * 0.05}>
              <article className="rounded-3xl border border-border bg-paper p-8 md:p-10 shadow-warm">
                <div className="flex items-baseline justify-between">
                  <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                    {s.n}
                  </p>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-terracotta">
                    step
                  </span>
                </div>
                <h3 className="mt-4 font-serif text-3xl md:text-4xl font-medium tracking-tight">
                  {s.title}
                </h3>
                <p className="mt-3 text-muted-foreground leading-relaxed text-lg">{s.body}</p>
              </article>
            </RevealBlock>
          ))}
        </div>
      </div>
    </section>
  );
}
