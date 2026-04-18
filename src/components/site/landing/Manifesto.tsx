/**
 * Manifesto — pinned section that swaps short phrases as you scroll.
 */
import { PinnedPhrases } from "@/components/site/motion/Pinned";

const PHRASES = [
  "We don't flatter your idea.",
  "We pressure-test it.",
  "We help you walk away early — with reasons.",
  "Or we help you ship something honest.",
];

export function Manifesto() {
  return (
    <section className="bg-background">
      <PinnedPhrases
        phrases={PHRASES}
        className="font-serif text-balance text-[clamp(2rem,5.5vw,5rem)] leading-tight tracking-[-0.02em] px-6 lg:px-12"
      />
    </section>
  );
}
