import { createFileRoute } from "@tanstack/react-router";
import { useGapCards } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Lightbulb, Loader2, Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/gaps")({
  component: GapsPage,
});

function GapsPage() {
  const { projectId } = Route.useParams();
  const { data: gaps } = useGapCards(projectId);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const suggested = gaps?.filter((g) => g.status === "suggested") ?? [];
  const selected = gaps?.filter((g) => g.status === "selected") ?? [];
  const dismissed = gaps?.filter((g) => g.status === "dismissed") ?? [];

  async function ask(prompt: string) {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-chat", {
        body: { projectId, message: prompt },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      qc.invalidateQueries({ queryKey: ["gaps", projectId] });
      qc.invalidateQueries({ queryKey: ["chat", projectId] });
      toast.success("GapFriend suggested new gaps");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reach GapFriend");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(id: string, status: "selected" | "dismissed" | "suggested") {
    const { error } = await supabase.from("gap_cards").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["gaps", projectId] });
  }

  return (
    <div className="px-6 lg:px-12 py-10 max-w-5xl mx-auto space-y-8 pb-20">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-mono text-terracotta">
            Discover
          </p>
          <h1 className="font-serif text-4xl font-medium mt-1">Market gaps</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Specific, real problems that don't have a great answer yet. Pick one and turn it into
            an opportunity brief.
          </p>
        </div>
        <Button
          className="rounded-full"
          disabled={busy}
          onClick={() =>
            ask(
              "Suggest 5 specific market gaps for me based on my profile and project so far. Use the add_gap_cards tool.",
            )
          }
        >
          {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Lightbulb className="size-4 mr-2" />}
          Suggest gaps
        </Button>
      </header>

      {selected.length > 0 && (
        <Section title="Currently exploring" tone="sage">
          <div className="grid md:grid-cols-2 gap-3">
            {selected.map((g) => (
              <GapCard key={g.id} gap={g} onPick={setStatus} active />
            ))}
          </div>
        </Section>
      )}

      <Section title="Suggested">
        {suggested.length === 0 ? (
          <Empty>No suggestions yet — hit "Suggest gaps".</Empty>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {suggested.map((g) => (
              <GapCard key={g.id} gap={g} onPick={setStatus} />
            ))}
          </div>
        )}
      </Section>

      {dismissed.length > 0 && (
        <Section title="Passed">
          <div className="grid md:grid-cols-2 gap-3 opacity-60">
            {dismissed.map((g) => (
              <GapCard key={g.id} gap={g} onPick={setStatus} dimmed />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "sage";
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2
        className={`text-[10px] uppercase tracking-widest font-mono mb-3 ${
          tone === "sage" ? "text-sage" : "text-muted-foreground"
        }`}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function GapCard({
  gap,
  onPick,
  active,
  dimmed,
}: {
  gap: {
    id: string;
    title: string;
    persona: string | null;
    problem: string | null;
    why_gap: string | null;
    difficulty: string | null;
  };
  onPick: (id: string, status: "selected" | "dismissed" | "suggested") => void;
  active?: boolean;
  dimmed?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-2xl border bg-card flex flex-col ${
        active ? "border-sage/50 bg-sage/5" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-serif text-base font-medium leading-snug">{gap.title}</h3>
        {gap.difficulty && (
          <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
            {gap.difficulty}
          </span>
        )}
      </div>
      {gap.persona && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">Who:</span> {gap.persona}
        </p>
      )}
      {gap.problem && (
        <p className="text-xs text-muted-foreground mt-1">
          <span className="font-medium text-foreground/80">Problem:</span> {gap.problem}
        </p>
      )}
      {gap.why_gap && <p className="text-xs text-muted-foreground mt-1 italic">{gap.why_gap}</p>}
      {!dimmed && (
        <div className="flex gap-2 mt-3">
          {!active ? (
            <Button
              size="sm"
              className="rounded-full h-7 text-xs"
              onClick={() => onPick(gap.id, "selected")}
            >
              <Check className="size-3 mr-1" /> Pick this
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="rounded-full h-7 text-xs"
              onClick={() => onPick(gap.id, "suggested")}
            >
              Unpick
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full h-7 text-xs"
            onClick={() => onPick(gap.id, "dismissed")}
          >
            <X className="size-3 mr-1" /> Pass
          </Button>
        </div>
      )}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-sm text-muted-foreground italic p-6 rounded-2xl border border-dashed border-border bg-card/40">
      {children}
    </div>
  );
}
