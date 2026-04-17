import { createFileRoute } from "@tanstack/react-router";
import { useContentPieces } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/content")({
  component: ContentPage,
});

function ContentPage() {
  const { projectId } = Route.useParams();
  const { data: pieces } = useContentPieces(projectId);
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-content", {
        body: { projectId, sourceText: draft },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      qc.invalidateQueries({ queryKey: ["content", projectId] });
      setDraft("");
      toast.success("Content saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 lg:px-12 py-10 max-w-4xl mx-auto space-y-6 pb-20">
      <header>
        <p className="text-[10px] uppercase tracking-widest font-mono text-terracotta">Library</p>
        <h1 className="font-serif text-4xl font-medium mt-1">Content</h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Drop a rough draft — get an SEO version and a thread back.
        </p>
      </header>

      <div className="bg-card rounded-3xl border border-border p-6 shadow-warm-sm space-y-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Paste a rough draft, idea, or post here…"
          className="min-h-[140px] resize-none rounded-2xl"
        />
        <div className="flex justify-end">
          <Button className="rounded-full" disabled={busy || !draft.trim()} onClick={generate}>
            {busy ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Pencil className="size-4 mr-2" />
            )}
            Generate
          </Button>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
          Saved pieces
        </h2>
        {!pieces?.length ? (
          <p className="text-sm text-muted-foreground italic">Nothing saved yet.</p>
        ) : (
          <div className="space-y-3">
            {pieces.map((p) => {
              const frames = (p.thread_frames as string[] | null) ?? [];
              return (
                <details key={p.id} className="bg-card rounded-2xl border border-border p-5 group">
                  <summary className="cursor-pointer">
                    <span className="font-serif text-lg font-medium">
                      {p.title || (p.source_text?.slice(0, 60) ?? "Untitled") + "…"}
                    </span>
                  </summary>
                  <div className="mt-4 space-y-4 text-sm">
                    {p.seo_version && (
                      <div>
                        <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-1">
                          SEO version
                        </div>
                        <p className="text-foreground whitespace-pre-wrap">{p.seo_version}</p>
                      </div>
                    )}
                    {frames.length > 0 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-1">
                          Thread ({frames.length})
                        </div>
                        <ol className="space-y-2 list-decimal list-inside">
                          {frames.map((f, i) => (
                            <li key={i} className="text-foreground">
                              {f}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
