import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useChannels } from "@/lib/queries";
import { Globe, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/channels")({
  component: ChannelsPage,
});

function ChannelsPage() {
  const { projectId } = Route.useParams();
  const { data: channels } = useChannels(projectId);
  const qc = useQueryClient();
  const [busyAction, setBusyAction] = useState(false);

  async function askGapFriend() {
    setBusyAction(true);
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
      toast.success("GapFriend updated your channels");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reach GapFriend");
    } finally {
      setBusyAction(false);
    }
  }

  async function deleteChannel(id: string) {
    const { error } = await supabase.from("channels").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["channels", projectId] });
    toast.success("Channel removed");
  }

  return (
    <div className="px-6 lg:px-12 py-10 max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <section className="bg-card rounded-3xl border border-border p-8 md:p-10 shadow-warm-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-terracotta-soft/40 rounded-bl-[120px] -mr-10 -mt-10 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-xl bg-terracotta-soft text-terracotta flex items-center justify-center">
              <Globe className="size-6" />
            </div>
            <div>
              <h1 className="font-serif text-4xl md:text-5xl font-medium">Channels</h1>
              <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest mt-1">
                where to be visible
              </p>
            </div>
          </div>
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
            These are the platforms and channels where your target audience hangs out. Focus on the
            ones that match your strengths and where you can create the most value.
          </p>
          <div className="mt-6">
            <Button className="rounded-full" disabled={busyAction} onClick={askGapFriend}>
              {busyAction ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Globe className="size-4 mr-2" />
              )}
              {channels?.length ? "Refresh recommendations" : "Get channel suggestions"}
            </Button>
          </div>
        </div>
      </section>

      {/* Channels list */}
      {channels && channels.length > 0 ? (
        <section className="space-y-4">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm hover:shadow-warm transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-serif text-xl font-medium">{channel.name}</h3>
                    {channel.is_primary && (
                      <span className="px-2 py-0.5 rounded-md bg-terracotta/20 text-terracotta text-[10px] font-mono uppercase tracking-wider">
                        primary
                      </span>
                    )}
                  </div>
                  {channel.rationale && (
                    <p className="text-sm text-muted-foreground mb-3">{channel.rationale}</p>
                  )}
                  <div className="grid md:grid-cols-2 gap-4">
                    {channel.pros && (
                      <div>
                        <h4 className="text-xs font-mono uppercase tracking-wider text-sage mb-2">
                          Pros
                        </h4>
                        <p className="text-sm text-muted-foreground">{channel.pros}</p>
                      </div>
                    )}
                    {channel.cons && (
                      <div>
                        <h4 className="text-xs font-mono uppercase tracking-wider text-terracotta mb-2">
                          Cons
                        </h4>
                        <p className="text-sm text-muted-foreground">{channel.cons}</p>
                      </div>
                    )}
                  </div>
                  {channel.starter_guide && (
                    <div className="mt-4 p-4 rounded-xl bg-muted/50">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-foreground mb-2">
                        Getting started
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {channel.starter_guide}
                      </p>
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0"
                  onClick={() => deleteChannel(channel.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="bg-card rounded-2xl border border-border p-12 text-center">
          <Globe className="size-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-serif text-xl font-medium mb-2">No channels yet</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Ask GapFriend to recommend channels based on your project and target audience.
          </p>
        </section>
      )}
    </div>
  );
}
