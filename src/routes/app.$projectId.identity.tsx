import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useIdentity, useProject } from "@/lib/queries";
import { Target, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/identity")({
  component: IdentityPage,
});

function IdentityPage() {
  const { projectId } = Route.useParams();
  const { data: identity } = useIdentity(projectId);
  const { data: project } = useProject(projectId);
  const qc = useQueryClient();
  const [busyAction, setBusyAction] = useState(false);

  async function askGapFriend() {
    setBusyAction(true);
    try {
      const message = identity?.chosen_name
        ? "Refine the identity (name, tagline, positioning, 5 domain options) for this project. Use save_identity."
        : "Suggest 5 name options, 5 domain options, a tagline, and a positioning sentence for this project. Use save_identity.";

      const { data, error } = await supabase.functions.invoke("gapfriend-chat", {
        body: { projectId, message },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      qc.invalidateQueries({ queryKey: ["identity", projectId] });
      qc.invalidateQueries({ queryKey: ["chat", projectId] });
      toast.success("Identity updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update identity");
    } finally {
      setBusyAction(false);
    }
  }

  return (
    <div className="px-6 lg:px-12 py-10 max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <section className="bg-card rounded-3xl border border-border p-8 md:p-10 shadow-warm-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-terracotta-soft/40 rounded-bl-[120px] -mr-10 -mt-10 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-xl bg-terracotta-soft text-terracotta flex items-center justify-center">
              <Target className="size-6" />
            </div>
            <div>
              <h1 className="font-serif text-4xl md:text-5xl font-medium">Identity & naming</h1>
              <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest mt-1">
                name · domain · positioning
              </p>
            </div>
          </div>
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
            Your project's identity — the name people remember, the domain they visit, and the
            positioning that makes you distinct.
          </p>
          <div className="mt-6">
            <Button className="rounded-full" disabled={busyAction} onClick={askGapFriend}>
              {busyAction ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Target className="size-4 mr-2" />
              )}
              {identity?.chosen_name ? "Refine identity" : "Help me name it"}
            </Button>
          </div>
        </div>
      </section>

      {/* Identity content */}
      {identity ? (
        <section className="space-y-6">
          {/* Chosen name and domain */}
          {(identity.chosen_name || identity.chosen_domain) && (
            <div className="bg-card rounded-2xl border-2 border-sage p-8 shadow-warm-sm">
              {identity.chosen_name && (
                <div className="mb-4">
                  <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                    Chosen name
                  </h2>
                  <p className="font-serif text-4xl font-medium">{identity.chosen_name}</p>
                </div>
              )}
              {identity.chosen_domain && (
                <div>
                  <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                    Domain
                  </h2>
                  <p className="font-mono text-xl text-sage">{identity.chosen_domain}</p>
                </div>
              )}
            </div>
          )}

          {/* Tagline */}
          {identity.tagline && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                Tagline
              </h2>
              <p className="font-serif text-xl italic text-muted-foreground">
                "{identity.tagline}"
              </p>
            </div>
          )}

          {/* Positioning */}
          {identity.positioning && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                Positioning
              </h2>
              <p className="text-base leading-relaxed">{identity.positioning}</p>
            </div>
          )}

          {/* Name options */}
          {identity.name_options && (identity.name_options as unknown[]).length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
                Name options
              </h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(identity.name_options as string[]).map((name, idx) => (
                  <li
                    key={idx}
                    className="p-3 rounded-xl bg-muted/50 font-serif text-lg border border-border/50"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Domain options */}
          {identity.domain_options && (identity.domain_options as unknown[]).length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
                Domain options
              </h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {(identity.domain_options as string[]).map((domain, idx) => (
                  <li
                    key={idx}
                    className="p-3 rounded-xl bg-muted/50 font-mono text-sm border border-border/50"
                  >
                    {domain}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <section className="bg-card rounded-2xl border border-border p-12 text-center">
          <Target className="size-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-serif text-xl font-medium mb-2">No identity yet</h3>
          <p className="text-sm text-muted-foreground mb-6">
            {project?.working_name
              ? `Your project is currently called "${project.working_name}". Ask GapFriend to suggest a proper name, tagline, and positioning.`
              : "Ask GapFriend to help you choose a name, domain, tagline, and positioning for your project."}
          </p>
        </section>
      )}
    </div>
  );
}
