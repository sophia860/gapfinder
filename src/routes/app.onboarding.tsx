import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfile, useUpdateProfile, type UserMode } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowRight, Briefcase, Palette, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/app/onboarding")({
  component: Onboarding,
});

const MODES: { id: UserMode; title: string; tagline: string; body: string; icon: typeof Briefcase }[] = [
  {
    id: "solo_founder",
    title: "Solo / non-dev founder",
    tagline: "I want to start something.",
    body: "You want to build a product business but feel overwhelmed by ideas, markets, and what to do next.",
    icon: Briefcase,
  },
  {
    id: "freelancer",
    title: "Freelancer / creative",
    tagline: "I want better clients and stability.",
    body: "Writer, designer, developer, artist. You want a clearer niche, better-paying clients, and steadier income.",
    icon: Palette,
  },
  {
    id: "existing_business",
    title: "Existing business / startup",
    tagline: "I want to expand.",
    body: "You're already selling. You want to find adjacent products, new segments, or test a new mini-product.",
    icon: TrendingUp,
  },
];

const QUESTIONS: Record<UserMode, { key: string; label: string; placeholder: string; multiline?: boolean }[]> = {
  solo_founder: [
    { key: "interests", label: "What industries or topics genuinely interest you?", placeholder: "e.g. fitness for desk workers, indie publishing, sustainable packaging" },
    { key: "skills", label: "What are you actually good at — or comfortable enough with?", placeholder: "e.g. writing, sales calls, design, no-code tools" },
    { key: "constraints", label: "How much time and money can you put in over the next 3 months?", placeholder: "e.g. ~10 hours/week, $500 budget" },
    { key: "stage", label: "Where are you right now?", placeholder: "e.g. just exploring, have one rough idea, ready to launch something small" },
  ],
  freelancer: [
    { key: "discipline", label: "What do you do, in plain words?", placeholder: "e.g. I design brand identities for small wellness companies" },
    { key: "current_clients", label: "Who are your current (or past) clients?", placeholder: "e.g. mostly local restaurants found via referrals" },
    { key: "rate", label: "Your typical price / rate, and ideal monthly income?", placeholder: "e.g. $2,500 per project, would love $8k/month" },
    { key: "constraints", label: "What's getting in your way right now?", placeholder: "e.g. inconsistent leads, undercharging, no clear niche" },
  ],
  existing_business: [
    { key: "what_you_sell", label: "What does your business sell today?", placeholder: "e.g. handmade leather goods sold on Etsy + own shop" },
    { key: "customers", label: "Who buys from you?", placeholder: "e.g. mid-30s urban professionals shopping for gifts" },
    { key: "metrics", label: "Roughly, what does the business look like?", placeholder: "e.g. 80 orders/month, $12k revenue, 1 employee" },
    { key: "ambition", label: "What would expansion look like for you?", placeholder: "e.g. a B2B line, a digital product, a subscription, a new market" },
  ],
};

function Onboarding() {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const updateProfile = useUpdateProfile();
  const navigate = useNavigate();
  const [step, setStep] = useState<"mode" | "details">(profile?.mode ? "details" : "mode");
  const [mode, setMode] = useState<UserMode | null>(profile?.mode ?? null);
  const [pitch, setPitch] = useState<string>(((profile?.profile_answers as Record<string, string>) ?? {}).pitch ?? "");
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const a = (profile?.profile_answers as Record<string, string>) ?? {};
    return a;
  });

  if (!user) return null;

  async function handleModeNext(selected: UserMode) {
    setMode(selected);
    await updateProfile.mutateAsync({ user_id: user.id, mode: selected });
    setStep("details");
  }

  async function handleFinish() {
    if (!mode) return;
    await updateProfile.mutateAsync({
      user_id: user.id,
      mode,
      profile_answers: { ...answers, pitch },
      onboarding_completed: true,
    });
    toast.success("You're all set. Welcome to GapFriend.");
    navigate({ to: "/app" });
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="px-6 lg:px-12 py-6 flex items-center justify-between border-b border-border">
        <span className="font-serif text-lg font-medium tracking-tight">GapFriend</span>
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {step === "mode" ? "Step 1 of 2" : "Step 2 of 2"}
        </span>
      </header>

      <main className="flex-1 px-6 lg:px-12 py-12 max-w-4xl w-full mx-auto">
        {step === "mode" && (
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-terracotta">Welcome</p>
            <h1 className="mt-4 font-serif text-4xl md:text-5xl font-medium tracking-tight text-balance">
              First — which best describes you?
            </h1>
            <p className="mt-3 text-muted-foreground text-lg max-w-2xl">
              I'll tailor the questions, the gap suggestions, and the dashboard to fit how you actually work.
            </p>

            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              {MODES.map((m) => {
                const Icon = m.icon;
                const selected = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => handleModeNext(m.id)}
                    className={`text-left p-6 rounded-2xl border bg-card transition-all hover:shadow-warm hover:-translate-y-0.5 ${
                      selected ? "border-terracotta ring-2 ring-terracotta/20" : "border-border"
                    }`}
                  >
                    <div className="size-10 rounded-xl bg-terracotta-soft text-terracotta flex items-center justify-center mb-4">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="font-serif text-lg font-medium">{m.title}</h3>
                    <p className="font-serif italic text-sm text-terracotta mt-1">"{m.tagline}"</p>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{m.body}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "details" && mode && (
          <div>
            <button onClick={() => setStep("mode")} className="text-sm text-muted-foreground hover:text-foreground mb-6">
              ← Change
            </button>
            <p className="font-mono text-xs uppercase tracking-widest text-terracotta">A few quick questions</p>
            <h1 className="mt-3 font-serif text-4xl md:text-5xl font-medium tracking-tight text-balance">
              Tell me a little about your situation.
            </h1>
            <p className="mt-3 text-muted-foreground text-lg max-w-2xl">
              Short answers are fine. I'll remember all of this so I can give you advice that actually fits.
            </p>

            <div className="mt-10 space-y-6 bg-card border border-border rounded-2xl p-6 md:p-8 shadow-warm-sm">
              <div>
                <Label htmlFor="pitch" className="font-serif text-base font-medium">In one or two sentences, what are you hoping to do?</Label>
                <Textarea
                  id="pitch"
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder="e.g. I want to start a small product business on the side that pays for itself within 6 months."
                  className="mt-2 min-h-20"
                />
              </div>

              {QUESTIONS[mode].map((q) => (
                <div key={q.key}>
                  <Label htmlFor={q.key} className="font-serif text-base font-medium">{q.label}</Label>
                  {q.multiline ? (
                    <Textarea
                      id={q.key}
                      value={answers[q.key] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                      placeholder={q.placeholder}
                      className="mt-2 min-h-20"
                    />
                  ) : (
                    <Input
                      id={q.key}
                      value={answers[q.key] ?? ""}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))}
                      placeholder={q.placeholder}
                      className="mt-2"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <Button onClick={handleFinish} disabled={updateProfile.isPending} size="lg" className="rounded-full px-7">
                {updateProfile.isPending ? "Saving…" : "Take me to my workspace"}
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
