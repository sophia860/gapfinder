import { createFileRoute } from "@tanstack/react-router";
import { useIdentity } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Target, Loader2, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/identity")({
  component: IdentityPage,
});

function IdentityPage() {
  const { projectId } = Route.useParams();
  const { data: identity } = useIdentity(projectId);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
    try {
      const prompt = identity?.chosen_name
        ? "Refine the identity (name, tagline, positioning, 5 domain options) for this project. Use save_identity."
        : "Suggest 5 name options, 5 domain options, a tagline, and a positioning sentence for this project. Use save_identity.";
      const { data, error } = await supabase.functions.invoke("gapfriend-chat", {
        body: { projectId, message: prompt },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      qc.invalidateQueries({ queryKey: ["identity", projectId] });
      qc.invalidateQueries({ queryKey: ["chat", projectId] });
      toast.success("Identity updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reach GapFriend");
    } finally {
      setBusy(false);
    }
  }

  async function chooseName(name: string) {
    const { error } = await supabase
      .from("identity")
      .update({ chosen_name: name })
      .eq("project_id", projectId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["identity", projectId] });
    toast.success(`Picked ${name}`);
  }

  async function chooseDomain(domain: string) {
    const { error } = await supabase
      .from("identity")
      .update({ chosen_domain: domain })
      .eq("project_id", projectId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["identity", projectId] });
    toast.success(`Picked ${domain}`);
  }

  const names = (identity?.name_options as string[] | null) ?? [];
  const domains = (identity?.domain_options as string[] | null) ?? [];

  return (
    <div className="px-6 lg:px-12 py-10 max-w-4xl mx-auto space-y-6 pb-20">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-mono text-terracotta">Decide</p>
          <h1 className="font-serif text-4xl font-medium mt-1">Identity & naming</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Name, tagline, positioning, and a domain to call home.
          </p>
        </div>
        <Button className="rounded-full" disabled={busy} onClick={ask}>
          {busy ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <Target className="size-4 mr-2" />
          )}
          {identity?.chosen_name ? "Refine" : "Generate options"}
        </Button>
      </header>

      <div className="bg-card rounded-3xl border border-border p-8 shadow-warm-sm space-y-6">
        {identity?.tagline && (
          <p className="font-serif italic text-xl text-muted-foreground">"{identity.tagline}"</p>
        )}
        {identity?.positioning && (
          <p className="text-foreground leading-relaxed">{identity.positioning}</p>
        )}

        <div>
          <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-2">
            Name options
          </div>
          {names.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No options yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {names.map((n) => {
                const picked = identity?.chosen_name === n;
                return (
                  <button
                    key={n}
                    onClick={() => chooseName(n)}
                    className={`px-3 py-1.5 rounded-full border text-sm font-serif transition-colors ${
                      picked
                        ? "bg-sage/15 border-sage/40 text-foreground"
                        : "bg-background border-border hover:border-terracotta/40"
                    }`}
                  >
                    {picked && <Check className="size-3 inline mr-1 text-sage" />}
                    {n}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-2">
            Domain options
          </div>
          {domains.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No options yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {domains.map((d) => {
                const picked = identity?.chosen_domain === d;
                return (
                  <button
                    key={d}
                    onClick={() => chooseDomain(d)}
                    className={`px-3 py-1.5 rounded-full border text-sm font-mono transition-colors ${
                      picked
                        ? "bg-sage/15 border-sage/40 text-foreground"
                        : "bg-background border-border hover:border-terracotta/40"
                    }`}
                  >
                    {picked && <Check className="size-3 inline mr-1 text-sage" />}
                    {d}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
