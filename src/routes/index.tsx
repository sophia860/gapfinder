/**
 * Public landing page — Uneevo-inspired motion + GapFriend's warm-editorial
 * brand. The page is a thin composition of section components living under
 * `src/components/site/landing/`.
 *
 * Below-the-fold sections are lazy-loaded via React.lazy + Suspense so the
 * hero stays interactive quickly. The static fallbacks keep page height
 * stable so ScrollTrigger pin positions don't jump after hydration.
 */
import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { Nav } from "@/components/site/landing/Nav";
import { Hero } from "@/components/site/landing/Hero";
import { ScrollProgress } from "@/components/site/ScrollProgress";
import { InkCursor } from "@/components/site/InkCursor";
import { SmoothScroll } from "@/components/site/SmoothScroll";

const Marquee = lazy(() =>
  import("@/components/site/landing/Marquee").then((m) => ({ default: m.Marquee })),
);
const Manifesto = lazy(() =>
  import("@/components/site/landing/Manifesto").then((m) => ({ default: m.Manifesto })),
);
const HowItWorks = lazy(() =>
  import("@/components/site/landing/HowItWorks").then((m) => ({ default: m.HowItWorks })),
);
const SelectedWork = lazy(() =>
  import("@/components/site/landing/SelectedWork").then((m) => ({ default: m.SelectedWork })),
);
const FeatureGrid = lazy(() =>
  import("@/components/site/landing/FeatureGrid").then((m) => ({ default: m.FeatureGrid })),
);
const ClosingCta = lazy(() =>
  import("@/components/site/landing/ClosingCta").then((m) => ({ default: m.ClosingCta })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GapFriend — find a real gap, build something honest" },
      {
        name: "description",
        content:
          "An AI co-pilot for solo founders, freelancers, and small teams. Find market gaps, kill bad ideas early, turn good ones into a tiny business, and build your site or app.",
      },
      { property: "og:title", content: "GapFriend" },
      {
        property: "og:description",
        content: "Find a real gap. Kill bad ideas early. Build something honest.",
      },
    ],
  }),
  component: Landing,
});

function SectionFallback({ minHeight = "60vh" }: { minHeight?: string }) {
  return <div aria-hidden="true" style={{ minHeight }} />;
}

function Landing() {
  return (
    <div className="site-marketing relative min-h-dvh bg-background text-foreground">
      <SmoothScroll />
      <ScrollProgress />
      <InkCursor />
      <div aria-hidden="true" className="grain-overlay pointer-events-none fixed inset-0 z-[1]" />

      <Nav />

      <main className="relative z-[2]">
        <Hero />

        <Suspense fallback={<SectionFallback minHeight="6rem" />}>
          <Marquee />
        </Suspense>

        <Suspense fallback={<SectionFallback minHeight="100vh" />}>
          <Manifesto />
        </Suspense>

        <Suspense fallback={<SectionFallback />}>
          <HowItWorks />
        </Suspense>

        <Suspense fallback={<SectionFallback minHeight="100vh" />}>
          <SelectedWork />
        </Suspense>

        <Suspense fallback={<SectionFallback />}>
          <FeatureGrid />
        </Suspense>

        <Suspense fallback={<SectionFallback />}>
          <ClosingCta />
        </Suspense>
      </main>
    </div>
  );
}
