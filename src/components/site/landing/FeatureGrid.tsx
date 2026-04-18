/**
 * FeatureGrid — bento layout where each tile's inner content translates on
 * scroll via the Parallax primitive. Pillars copy preserved verbatim.
 */
import { Zap, Target, FolderKanban, Compass, ShieldCheck, Sparkles } from "lucide-react";
import { Parallax } from "@/components/site/motion/Parallax";
import { RevealBlock, RevealLines } from "@/components/site/motion/Reveal";

const PILLARS = [
  {
    icon: Zap,
    title: "Fast to results",
    body: "First gap ideas in minutes, not weekends.",
    speed: 0.05,
  },
  {
    icon: Target,
    title: "Honest feedback",
    body: "Synthetic customers don't flatter your idea.",
    speed: 0.12,
  },
  {
    icon: FolderKanban,
    title: "All in one place",
    body: "Naming, tasks, and content in one calm workspace.",
    speed: 0.08,
  },
  {
    icon: Compass,
    title: "Tailored to you",
    body: "Suggestions shaped by your skills and constraints.",
    speed: 0.15,
  },
  {
    icon: ShieldCheck,
    title: "Built to kill bad ideas",
    body: "Walk away early — with reasons, not regret.",
    speed: 0.06,
  },
  {
    icon: Sparkles,
    title: "No code required",
    body: "Plain language in, a tiny business out.",
    speed: 0.1,
  },
];

export function FeatureGrid() {
  return (
    <section id="features" className="px-6 lg:px-12 py-32 md:py-48 max-w-7xl mx-auto">
      <RevealBlock>
        <p className="font-mono text-xs uppercase tracking-widest text-terracotta">Why GapFriend</p>
      </RevealBlock>
      <h2 className="mt-4 font-serif font-medium tracking-[-0.02em] text-balance text-[clamp(2.25rem,5vw,4.5rem)] leading-[1.02] max-w-4xl">
        <RevealLines as="span" className="block">
          {"Built for the way solo\nmakers actually work."}
        </RevealLines>
      </h2>

      <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PILLARS.map((p) => (
          <RevealBlock key={p.title}>
            <div className="h-full rounded-3xl border border-border bg-paper p-7 shadow-warm overflow-hidden">
              <Parallax speed={p.speed}>
                <div className="size-12 rounded-full bg-terracotta-soft text-terracotta flex items-center justify-center">
                  <p.icon className="size-5" aria-hidden="true" />
                </div>
                <h3 className="mt-6 font-serif text-2xl font-medium">{p.title}</h3>
                <p className="mt-3 text-muted-foreground leading-relaxed">{p.body}</p>
              </Parallax>
            </div>
          </RevealBlock>
        ))}
      </div>
    </section>
  );
}
