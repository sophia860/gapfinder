/**
 * Nav — minimal landing-page header that condenses into a pill after the
 * user scrolls past the hero. Uses a scroll listener to toggle a data
 * attribute, which Tailwind data-variants pick up.
 */
import { useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function Nav() {
  const innerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const inner = innerRef.current;
    if (!inner) return;

    let condensed = false;
    const onScroll = () => {
      const next = window.scrollY > 80;
      if (next === condensed) return;
      condensed = next;
      inner.dataset.condensed = condensed ? "true" : "false";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-4 sm:px-6 lg:px-12 py-4">
      <div
        ref={innerRef}
        data-condensed="false"
        className="mx-auto flex items-center justify-between rounded-full border border-transparent bg-background/0 px-2 py-1 transition-all duration-300 data-[condensed=true]:max-w-3xl data-[condensed=true]:border-border data-[condensed=true]:bg-background/85 data-[condensed=true]:backdrop-blur data-[condensed=true]:px-4 data-[condensed=true]:py-2 data-[condensed=true]:shadow-warm"
      >
        <Link to="/" className="flex items-baseline gap-2 px-3">
          <span className="font-serif text-xl font-medium tracking-tight">GapFriend</span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-terracotta">
            v1
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a href="#work" className="hover:text-foreground transition-colors">
            Work
          </a>
          <a href="#how" className="hover:text-foreground transition-colors">
            How
          </a>
          <a href="#features" className="hover:text-foreground transition-colors">
            Features
          </a>
        </nav>
        <Link to="/auth">
          <Button variant="ghost" className="rounded-full">
            Sign in
          </Button>
        </Link>
      </div>
    </header>
  );
}
