import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useContentPieces } from "@/lib/queries";
import { Pencil, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/content")({
  component: ContentPage,
});

function ContentPage() {
  const { projectId } = Route.useParams();
  const { data: content } = useContentPieces(projectId);
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  async function composeContent() {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-chat", {
        body: {
          projectId,
          message: `Turn this draft into SEO-optimized content and a social thread:\n\n${draft.trim()}`,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      qc.invalidateQueries({ queryKey: ["content", projectId] });
      qc.invalidateQueries({ queryKey: ["chat", projectId] });
      setDraft("");
      toast.success("Content created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't create content");
    } finally {
      setBusy(false);
    }
  }

  async function deleteContent(id: string) {
    const { error } = await supabase.from("content_pieces").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["content", projectId] });
    toast.success("Content deleted");
  }

  return (
    <div className="px-6 lg:px-12 py-10 max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <section className="bg-card rounded-3xl border border-border p-8 md:p-10 shadow-warm-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-terracotta-soft/40 rounded-bl-[120px] -mr-10 -mt-10 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-xl bg-terracotta-soft text-terracotta flex items-center justify-center">
              <Pencil className="size-6" />
            </div>
            <div>
              <h1 className="font-serif text-4xl md:text-5xl font-medium">Content</h1>
              <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest mt-1">
                SEO & social threads
              </p>
            </div>
          </div>
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
            Turn your ideas and drafts into SEO-optimized content and social media threads with
            GapFriend's help.
          </p>
        </div>
      </section>

      {/* Composer */}
      <section className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
        <label className="block text-sm font-medium mb-3">Write a draft or idea</label>
        <Textarea
          placeholder="Share a thought, insight, or rough draft. GapFriend will help you turn it into polished content..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="min-h-[140px] mb-4"
          disabled={busy}
        />
        <Button onClick={composeContent} disabled={busy || !draft.trim()} className="rounded-full">
          {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Pencil className="size-4 mr-2" />}
          Compose content
        </Button>
      </section>

      {/* Content list */}
      {content && content.length > 0 ? (
        <section className="space-y-4">
          <h2 className="font-serif text-xl font-medium text-muted-foreground">
            Your content ({content.length})
          </h2>
          {content.map((piece) => (
            <div
              key={piece.id}
              className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm hover:shadow-warm transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {piece.title && (
                    <h3 className="font-serif text-xl font-medium mb-3">{piece.title}</h3>
                  )}
                  {piece.source_text && (
                    <div className="mb-4">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                        Original draft
                      </h4>
                      <p className="text-sm text-muted-foreground italic leading-relaxed">
                        {piece.source_text}
                      </p>
                    </div>
                  )}
                  {piece.seo_text && (
                    <div className="mb-4">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                        SEO version
                      </h4>
                      <p className="text-sm leading-relaxed">{piece.seo_text}</p>
                    </div>
                  )}
                  {piece.thread && (
                    <div>
                      <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                        Social thread
                      </h4>
                      <p className="text-sm leading-relaxed whitespace-pre-line">{piece.thread}</p>
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => deleteContent(piece.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="bg-card rounded-2xl border border-border p-12 text-center">
          <Pencil className="size-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-serif text-xl font-medium mb-2">No content yet</h3>
          <p className="text-sm text-muted-foreground">
            Use the composer above to turn your drafts into polished content and social threads.
          </p>
        </section>
      )}
    </div>
  );
}
