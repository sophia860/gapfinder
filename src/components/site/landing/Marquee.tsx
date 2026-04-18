/**
 * Marquee — auto-scrolling tag strip that reacts to scroll velocity.
 */
import { ScrollVelocityMarquee } from "@/components/site/motion/ScrollVelocityMarquee";

const TAGS = [
  "market gaps",
  "tiny businesses",
  "honest builds",
  "synthetic customers",
  "calm dashboards",
  "no fluff",
  "indie founders",
  "freelancers",
  "small teams",
];

export function Marquee() {
  return (
    <section className="border-y border-border bg-paper py-8 overflow-hidden">
      <ScrollVelocityMarquee className="font-serif italic text-3xl md:text-5xl text-foreground/80">
        {TAGS.map((t) => (
          <span key={t} className="flex items-center gap-12">
            <span>{t}</span>
            <span aria-hidden="true" className="text-terracotta">
              ✦
            </span>
          </span>
        ))}
      </ScrollVelocityMarquee>
    </section>
  );
}
