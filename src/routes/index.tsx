import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GapFriend — find a real gap, build something honest" },
      { name: "description", content: "An AI co-pilot for solo founders, freelancers, and small teams. Find market gaps, kill bad ideas early, and turn good ones into a tiny business." },
      { property: "og:title", content: "GapFriend" },
      { property: "og:description", content: "Find a real gap. Kill bad ideas early. Build something honest." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="px-6 lg:px-12 py-6 flex items-center justify-between">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="font-serif text-xl font-medium tracking-tight">GapFriend</span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-terracotta">v1</span>
        </Link>
        <Link to="/auth">
          <Button variant="ghost" className="rounded-full">Sign in</Button>
        </Link>
      </header>

      <main className="px-6 lg:px-12 pt-16 pb-24 max-w-5xl mx-auto">
        <p className="font-mono text-xs uppercase tracking-widest text-terracotta mb-6">Issue No. 1 — for makers, founders, freelancers</p>
        <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-medium leading-[0.95] tracking-tight text-balance">
          Find a real gap.<br />
          <span className="italic text-terracotta">Build something</span> honest.
        </h1>
        <p className="mt-8 max-w-2xl text-lg md:text-xl text-muted-foreground leading-relaxed text-pretty">
          GapFriend is an AI co-pilot that helps you spot gaps in the market, pressure-test ideas with synthetic customers, and turn the good ones into a name, a plan, tasks, and content — without writing any code.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/auth">
            <Button size="lg" className="rounded-full px-7 h-12 text-base">Start free →</Button>
          </Link>
          <a href="#how" className="inline-flex items-center justify-center rounded-full border border-border bg-background h-12 px-7 text-base font-medium hover:bg-secondary transition-colors">
            How it works
          </a>
        </div>

        <section id="how" className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { n: "01", title: "Find a gap", body: "GapFriend learns about you, then proposes 3–5 real, tailored market gaps you could actually go after." },
            { n: "02", title: "Pressure-test it", body: "Simulate synthetic customers to surface objections, hooks, and a verdict before you waste a month." },
            { n: "03", title: "Run the business", body: "Naming, domains, channels, break-even, tasks, and content threads — all in one calm dashboard." },
          ].map((s) => (
            <div key={s.n}>
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{s.n}</p>
              <h3 className="mt-3 font-serif text-2xl font-medium">{s.title}</h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border px-6 lg:px-12 py-6 text-xs text-muted-foreground font-mono uppercase tracking-widest flex justify-between">
        <span>GapFriend</span>
        <span>Made with care</span>
      </footer>
    </div>
  );
}
