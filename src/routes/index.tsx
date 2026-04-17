import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";
import { Zap, Target, FolderKanban, Compass, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

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

/**
 * Reveal — wraps children with a scroll-triggered fade/slide-in.
 * Uses IntersectionObserver and respects prefers-reduced-motion via CSS.
 */
function Reveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      node.classList.add("is-visible");
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.classList.add("is-visible");
            obs.unobserve(node);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/** Faux dashboard preview rendered in CSS — no external assets needed. */
function DashboardPreview() {
  return (
    <div className="relative rounded-2xl border border-border bg-paper shadow-warm-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-warm/60">
        <span className="size-2.5 rounded-full bg-terracotta/70" />
        <span className="size-2.5 rounded-full bg-ochre/70" />
        <span className="size-2.5 rounded-full bg-sage/70" />
        <span className="ml-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          gapfriend / workspace
        </span>
      </div>
      <div className="grid grid-cols-12 gap-4 p-5">
        <div className="col-span-4 space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Projects
          </div>
          {["Quiet CRM", "Slow inbox", "Tiny invoicer"].map((p, i) => (
            <div
              key={p}
              className={`rounded-lg px-3 py-2 text-sm ${
                i === 0
                  ? "bg-terracotta-soft text-terracotta font-medium"
                  : "bg-warm/60 text-foreground/80"
              }`}
            >
              {p}
            </div>
          ))}
        </div>
        <div className="col-span-8 space-y-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Today
          </div>
          <div className="rounded-lg border border-border p-4">
            <div className="font-serif text-lg">Pressure-test verdict</div>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              7 of 10 synthetic customers would try it. Pricing is the friction.
            </p>
            <div className="mt-3 flex gap-2">
              <span className="rounded-full bg-sage/20 text-foreground/70 px-2.5 py-0.5 text-xs">
                strong hook
              </span>
              <span className="rounded-full bg-ochre/20 text-foreground/70 px-2.5 py-0.5 text-xs">
                price-sensitive
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { k: "Gaps", v: "5" },
              { k: "Tasks", v: "12" },
              { k: "Threads", v: "3" },
            ].map((c) => (
              <div key={c.k} className="rounded-lg bg-warm/60 px-3 py-3 text-center">
                <div className="font-serif text-2xl">{c.v}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {c.k}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Visual mock for the "Gap Discovery" feature block. */
function GapDiscoveryVisual() {
  const gaps = [
    { tag: "B2B / SaaS", title: "Calm CRM for solo consultants" },
    { tag: "Local services", title: "Booking for one-person studios" },
    { tag: "Creator tools", title: "Honest analytics for newsletters" },
  ];
  return (
    <div className="rounded-2xl border border-border bg-paper p-5 shadow-warm">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
        Suggested gaps
      </div>
      <ul className="space-y-2">
        {gaps.map((g) => (
          <li
            key={g.title}
            className="rounded-lg border border-border px-4 py-3 flex items-center justify-between hover:bg-warm/50 transition-colors"
          >
            <div>
              <div className="font-serif text-base">{g.title}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                {g.tag}
              </div>
            </div>
            <span className="text-terracotta font-mono text-xs">explore →</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Visual mock for "Synthetic Customer Testing" feature block. */
function SyntheticVisual() {
  const quotes = [
    {
      who: "Maya, freelance designer",
      tone: "sage",
      text: "I'd try it if onboarding took under five minutes.",
    },
    {
      who: "Dan, indie consultant",
      tone: "ochre",
      text: "Looks useful, but the price feels steep for solo.",
    },
    {
      who: "Priya, agency owner",
      tone: "terracotta",
      text: "Yes — this kills the spreadsheet I hate maintaining.",
    },
  ];
  return (
    <div className="rounded-2xl border border-border bg-paper p-5 shadow-warm space-y-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        Synthetic customers · 3 of 10
      </div>
      {quotes.map((q) => (
        <div key={q.who} className="flex gap-3">
          <div
            className={`size-9 shrink-0 rounded-full ${
              q.tone === "sage"
                ? "bg-sage/40"
                : q.tone === "ochre"
                  ? "bg-ochre/40"
                  : "bg-terracotta/40"
            }`}
          />
          <div className="flex-1">
            <p className="text-sm leading-relaxed">"{q.text}"</p>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
              {q.who}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Visual mock for "Business Launchpad" feature block. */
function LaunchpadVisual() {
  return (
    <div className="rounded-2xl border border-border bg-paper p-5 shadow-warm">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
        Launch checklist
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { k: "Name", v: "Quietly" },
          { k: "Domain", v: "quietly.app" },
          { k: "Channel", v: "Newsletter" },
          { k: "Break-even", v: "42 / mo" },
        ].map((c) => (
          <div key={c.k} className="rounded-lg bg-warm/60 px-3 py-3">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {c.k}
            </div>
            <div className="font-serif text-lg mt-0.5">{c.v}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {["Draft launch post", "Set up payments", "Write first 3 emails"].map((t, i) => (
          <div key={t} className="flex items-center gap-2 text-sm">
            <span
              className={`size-4 rounded border ${
                i < 2 ? "bg-terracotta border-terracotta" : "border-border"
              }`}
            />
            <span className={i < 2 ? "line-through text-muted-foreground" : ""}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Landing() {
  const features = [
    {
      kicker: "01 · Discover",
      title: "Gap Discovery",
      body: "GapFriend learns about your skills, audience, and constraints, then proposes 3–5 real, tailored market gaps. Each one comes with a why-now, who-it's-for, and the kind of customer that would care.",
      visual: <GapDiscoveryVisual />,
    },
    {
      kicker: "02 · Validate",
      title: "Synthetic Customer Testing",
      body: "Pressure-test any idea against a panel of synthetic customers shaped from real markets. Surface hooks, objections, and a clear verdict in minutes — before you sink a month into the wrong thing.",
      visual: <SyntheticVisual />,
    },
    {
      kicker: "03 · Launch",
      title: "Business Launchpad",
      body: "Turn the good ones into a name, a domain, channels, a break-even number, tasks, and content threads. One calm dashboard for everything between idea and first customer.",
      visual: <LaunchpadVisual />,
    },
  ];

  const pillars = [
    {
      icon: Zap,
      title: "Fast to results",
      body: "First gap ideas in minutes, not weekends.",
    },
    {
      icon: Target,
      title: "Honest feedback",
      body: "Synthetic customers don't flatter your idea.",
    },
    {
      icon: FolderKanban,
      title: "All in one place",
      body: "Naming, tasks, and content in one calm workspace.",
    },
    {
      icon: Compass,
      title: "Tailored to you",
      body: "Suggestions shaped by your skills and constraints.",
    },
    {
      icon: ShieldCheck,
      title: "Built to kill bad ideas",
      body: "Walk away early — with reasons, not regret.",
    },
    {
      icon: Sparkles,
      title: "No code required",
      body: "Plain language in, a tiny business out.",
    },
  ];

  const testimonials = [
    {
      quote:
        "Killed two ideas in an afternoon and found one I'm actually shipping. That's the dream.",
      name: "Alex R.",
      role: "Solo founder",
      tone: "terracotta",
    },
    {
      quote:
        "The synthetic customers were brutal in the best way. Saved me a month of building the wrong thing.",
      name: "Jordan M.",
      role: "Indie maker",
      tone: "ochre",
    },
    {
      quote: "Feels like a calm thinking partner, not another dashboard screaming at me.",
      name: "Sam K.",
      role: "Freelance designer",
      tone: "sage",
    },
  ];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="px-6 lg:px-12 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-serif text-xl font-medium tracking-tight">GapFriend</span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-terracotta">
            v1
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#why" className="hover:text-foreground transition-colors">
            Why GapFriend
          </a>
          <a href="#pricing" className="hover:text-foreground transition-colors">
            Pricing
          </a>
        </nav>
        <Link to="/auth">
          <Button variant="ghost" className="rounded-full">
            Sign in
          </Button>
        </Link>
      </header>

      <main className="px-6 lg:px-12 pt-16 pb-24 max-w-5xl mx-auto">
        <p className="font-mono text-xs uppercase tracking-widest text-terracotta mb-6">
          Issue No. 1 — for makers, founders, freelancers
        </p>
        <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-medium leading-[0.95] tracking-tight text-balance">
          Find a real gap.
          <br />
          <span className="italic text-terracotta">Build something</span> honest.
        </h1>
        <p className="mt-8 max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed text-pretty">
          GapFriend is an AI co-pilot that helps you spot gaps in the market, pressure-test ideas
          with synthetic customers, and turn the good ones into a name, a plan, tasks, content, and
          a working website or app — without writing any code (unless you want to).
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/auth">
            <Button size="lg" className="rounded-full px-7 h-12 text-base">
              Start free →
            </Button>
          </Link>
          <a
            href="#how"
            className="inline-flex items-center justify-center rounded-full border border-border bg-background h-12 px-7 text-base font-medium hover:bg-secondary transition-colors"
          >
            How it works
          </a>
        </div>
      </section>

      {/* Feature blocks */}
      <section
        id="features"
        className="px-6 lg:px-12 py-24 md:py-32 max-w-6xl mx-auto space-y-24 md:space-y-32"
      >
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-widest text-terracotta">
            What it does
          </p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl font-medium tracking-tight max-w-2xl">
            Three quiet steps from <span className="italic">hunch</span> to{" "}
            <span className="italic">tiny business</span>.
          </h2>
        </Reveal>

        <section id="how" className="mt-32 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
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
          ].map((s) => (
            <div key={s.n}>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {s.n}
              </p>
              <h3 className="mt-3 font-serif text-2xl font-medium">{s.title}</h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </section>

      {/* Why GapFriend pillars */}
      <section id="why" className="bg-paper border-y border-border">
        <div className="px-6 lg:px-12 py-24 md:py-32 max-w-6xl mx-auto">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-widest text-terracotta">
              Why GapFriend
            </p>
            <h2 className="mt-3 font-serif text-4xl md:text-5xl font-medium tracking-tight max-w-2xl">
              Built for the way solo makers actually work.
            </h2>
          </Reveal>

          <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pillars.map((p, i) => (
              <Reveal key={p.title} delayMs={i * 60}>
                <div className="h-full rounded-2xl border border-border bg-background p-6 hover:shadow-warm transition-shadow">
                  <div className="size-10 rounded-full bg-terracotta-soft text-terracotta flex items-center justify-center">
                    <p.icon className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 font-serif text-xl font-medium">{p.title}</h3>
                  <p className="mt-2 text-muted-foreground leading-relaxed">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-6 lg:px-12 py-24 md:py-32 max-w-6xl mx-auto">
        <Reveal>
          <p className="font-mono text-xs uppercase tracking-widest text-terracotta">
            From early users
          </p>
          <h2 className="mt-3 font-serif text-4xl md:text-5xl font-medium tracking-tight max-w-2xl">
            Honest words from honest builders.
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delayMs={i * 80}>
              <figure className="h-full rounded-2xl border border-border bg-paper p-6 flex flex-col">
                <blockquote className="font-serif text-xl leading-snug text-balance">
                  "{t.quote}"
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <div
                    className={`size-10 rounded-full ${
                      t.tone === "terracotta"
                        ? "bg-terracotta/30"
                        : t.tone === "ochre"
                          ? "bg-ochre/40"
                          : "bg-sage/40"
                    }`}
                    aria-hidden="true"
                  />
                  <div>
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {t.role}
                    </div>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-paper border-y border-border">
        <div className="px-6 lg:px-12 py-24 md:py-32 max-w-6xl mx-auto">
          <Reveal>
            <p className="font-mono text-xs uppercase tracking-widest text-terracotta">Pricing</p>
            <h2 className="mt-3 font-serif text-4xl md:text-5xl font-medium tracking-tight max-w-2xl">
              Start free. Stay calm.
            </h2>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground leading-relaxed">
              GapFriend is free for early founders while we figure out what's fair. No credit card,
              no expiring trial — just enough room to find your first real gap.
            </p>
          </Reveal>

          <Reveal className="mt-12">
            <div className="max-w-md mx-auto rounded-2xl border border-border bg-background p-8 shadow-warm-lg">
              <p className="font-mono text-xs uppercase tracking-widest text-terracotta">
                Early founder
              </p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-serif text-5xl font-medium">$0</span>
                <span className="text-muted-foreground">/ forever for now</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Unlimited gap suggestions",
                  "Synthetic customer panels",
                  "Naming, tasks & content threads",
                  "One calm workspace",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 rounded-full bg-terracotta shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="block mt-8">
                <Button size="lg" className="rounded-full w-full h-12 text-base">
                  Claim your spot →
                </Button>
              </Link>
              <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                No credit card required
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-6 lg:px-12 py-24 md:py-32 max-w-6xl mx-auto">
        <Reveal>
          <div className="rounded-3xl bg-terracotta text-primary-foreground px-8 md:px-16 py-16 md:py-20 text-center shadow-warm-lg">
            <h2 className="font-serif text-4xl md:text-6xl font-medium tracking-tight text-balance">
              Ready to find your gap?
            </h2>
            <p className="mt-5 max-w-xl mx-auto text-lg text-primary-foreground/85 leading-relaxed">
              Spend an afternoon with GapFriend. Walk away with one idea worth building — or none,
              with reasons.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/auth">
                <Button size="lg" variant="secondary" className="rounded-full px-7 h-12 text-base">
                  Start free →
                </Button>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-border px-6 lg:px-12 py-6 text-xs text-muted-foreground font-mono uppercase tracking-widest flex justify-between">
        <span>GapFriend</span>
        <span>Made with care</span>
      </footer>
    </div>
  );
}
