import { createFileRoute } from "@tanstack/react-router";
import { useChannels } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Globe, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/channels")({
  component: ChannelsPage,
});

function ChannelsPage() {
  const { projectId } = Route.useParams();
  const { data: channels } = useChannels(projectId);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-chat", {
        body: {
          projectId,
          message:
            "Recommend 3 channels (online or offline) for me to be visible on, with rationale, pros, cons, and a starter guide. Use save_channels.",
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      qc.invalidateQueries({ queryKey: ["channels", projectId] });
      qc.invalidateQueries({ queryKey: ["chat", projectId] });
      toast.success("Channels updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reach GapFriend");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 lg:px-12 py-10 max-w-4xl mx-auto space-y-6 pb-20">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-mono text-terracotta">Decide</p>
          <h1 className="font-serif text-4xl font-medium mt-1">Channels</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Where your people already are. Don't try to be everywhere.
          </p>
        </div>
        <Button className="rounded-full" disabled={busy} onClick={ask}>
          {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Globe className="size-4 mr-2" />}
          {channels?.length ? "Refresh" : "Suggest channels"}
        </Button>
      </header>

      {!channels?.length ? (
        <div className="text-sm text-muted-foreground italic p-8 rounded-3xl border border-dashed border-border bg-card/40 text-center">
          No channels yet.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {channels.map((c) => (
            <div key={c.id} className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-serif text-xl font-medium">{c.name}</h3>
                {c.is_primary && (
                  <span className="text-[10px] font-mono uppercase tracking-wider text-terracotta">
                    primary
                  </span>
                )}
              </div>
              {c.rationale && (
                <p className="text-sm text-muted-foreground mb-3">{c.rationale}</p>
              )}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {c.pros && (
                  <div>
                    <div className="font-mono uppercase tracking-wider text-sage mb-1">Pros</div>
                    <p className="text-muted-foreground">{c.pros}</p>
                  </div>
                )}
                {c.cons && (
                  <div>
                    <div className="font-mono uppercase tracking-wider text-terracotta mb-1">
                      Cons
                    </div>
                    <p className="text-muted-foreground">{c.cons}</p>
                  </div>
                )}
              </div>
              {c.guide && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-terracotta hover:underline text-xs font-mono uppercase tracking-wider">
                    Starter guide
                  </summary>
                  <p className="mt-2 text-muted-foreground whitespace-pre-wrap">{c.guide}</p>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
