/**
 * SelectedWork — horizontal-scroll case-study panel. Each card mimics the
 * dashboard preview style from the previous landing page. Static content
 * for now (no CMS).
 */
import { HorizontalScroll } from "@/components/site/motion/HorizontalScroll";
import { RevealBlock, RevealLines } from "@/components/site/motion/Reveal";

type Case = {
  who: string;
  tag: string;
  title: string;
  body: string;
  metric: { k: string; v: string };
  tone: "terracotta" | "ochre" | "sage";
};

const CASES: Case[] = [
  {
    who: "Solo founder",
    tag: "B2B / SaaS",
    title: "Quiet CRM",
    body: "Killed two ideas in an afternoon. Found one worth shipping — a calm CRM for solo consultants.",
    metric: { k: "Time to first gap", v: "12 min" },
    tone: "terracotta",
  },
  {
    who: "Freelance designer",
    tag: "Creator tools",
    title: "Honest analytics",
    body: "Synthetic customers were brutal in the best way. Saved a month of building the wrong thing.",
    metric: { k: "Ideas tested", v: "9" },
    tone: "ochre",
  },
  {
    who: "Indie consultant",
    tag: "Local services",
    title: "One-person studio booking",
    body: "Felt like a thinking partner, not another dashboard screaming at me. Launched in a week.",
    metric: { k: "Break-even", v: "42 / mo" },
    tone: "sage",
  },
  {
    who: "Small team",
    tag: "Newsletter",
    title: "Slow inbox",
    body: "We replaced a roadmap of 14 maybes with a single calm bet. The team finally stopped arguing.",
    metric: { k: "Maybes killed", v: "13" },
    tone: "terracotta",
  },
  {
    who: "Developer",
    tag: "Tooling",
    title: "Tiny invoicer",
    body: "Vibe-coded the landing page in an hour, then jumped into the full coding workspace for the API.",
    metric: { k: "Time to ship", v: "5 days" },
    tone: "ochre",
  },
];

const toneToBg = {
  terracotta: "bg-terracotta/15 text-terracotta",
  ochre: "bg-ochre/25 text-foreground",
  sage: "bg-sage/30 text-foreground",
} as const;

export function SelectedWork() {
  return (
    <section id="work" className="bg-paper border-y border-border">
      <div className="px-6 lg:px-12 pt-24 md:pt-32 pb-10 max-w-7xl mx-auto">
        <RevealBlock>
          <p className="font-mono text-xs uppercase tracking-widest text-terracotta">
            Selected work
          </p>
        </RevealBlock>
        <h2 className="mt-4 font-serif font-medium tracking-[-0.02em] text-balance text-[clamp(2.25rem,5vw,4.5rem)] leading-[1.02] max-w-4xl">
          <RevealLines as="span" className="block">
            {"Honest words from\nhonest builders."}
          </RevealLines>
        </h2>
      </div>

      <HorizontalScroll className="pb-24 md:pb-32">
        <div className="pl-6 lg:pl-12" aria-hidden="true" />
        {CASES.map((c) => (
          <article
            key={c.title}
            className="snap-start w-[85vw] sm:w-[60vw] lg:w-[36vw] shrink-0 rounded-3xl border border-border bg-background p-8 md:p-10 shadow-warm flex flex-col"
          >
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-3 py-1 text-xs font-mono uppercase tracking-widest ${toneToBg[c.tone]}`}
              >
                {c.who}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {c.tag}
              </span>
            </div>
            <h3 className="mt-6 font-serif text-3xl md:text-4xl font-medium tracking-tight">
              {c.title}
            </h3>
            <p className="mt-4 text-muted-foreground leading-relaxed text-lg flex-1">"{c.body}"</p>
            <div className="mt-8 flex items-baseline justify-between border-t border-border pt-5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {c.metric.k}
              </span>
              <span className="font-serif text-2xl">{c.metric.v}</span>
            </div>
          </article>
        ))}
        <div className="pr-6 lg:pr-12" aria-hidden="true" />
      </HorizontalScroll>
    </section>
  );
}
