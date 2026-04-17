import { createFileRoute } from "@antml:parameter>
import { useState } from "react";
import { useMoney } from "@/lib/queries";
import { DollarSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/money")({
  component: MoneyPage,
});

function MoneyPage() {
  const { projectId } = Route.useParams();
  const { data: money } = useMoney(projectId);
  const qc = useQueryClient();
  const [busyAction, setBusyAction] = useState(false);

  async function askGapFriend() {
    setBusyAction(true);
    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-chat", {
        body: {
          projectId,
          message:
            "Propose realistic money settings — currency, monthly income_target, price_per_unit, hours_per_week, and 3 scenarios (lean/realistic/ambitious) with units and revenue. Use save_money.",
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      qc.invalidateQueries({ queryKey: ["money", projectId] });
      qc.invalidateQueries({ queryKey: ["chat", projectId] });
      toast.success("Money settings updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update settings");
    } finally {
      setBusyAction(false);
    }
  }

  const unitsNeeded = money?.income_target && money.price_per_unit
    ? Math.ceil(Number(money.income_target) / Number(money.price_per_unit))
    : null;

  return (
    <div className="px-6 lg:px-12 py-10 max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <section className="bg-card rounded-3xl border border-border p-8 md:p-10 shadow-warm-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-terracotta-soft/40 rounded-bl-[120px] -mr-10 -mt-10 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-xl bg-terracotta-soft text-terracotta flex items-center justify-center">
              <DollarSign className="size-6" />
            </div>
            <div>
              <h1 className="font-serif text-4xl md:text-5xl font-medium">Money</h1>
              <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest mt-1">
                break-even & pricing
              </p>
            </div>
          </div>
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
            The math behind your project — your income target, pricing, and what it takes to break
            even. Get realistic scenarios to guide your decisions.
          </p>
          <div className="mt-6">
            <Button className="rounded-full" disabled={busyAction} onClick={askGapFriend}>
              {busyAction ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <DollarSign className="size-4 mr-2" />
              )}
              {money ? "Refresh scenarios" : "Calculate break-even"}
            </Button>
          </div>
        </div>
      </section>

      {/* Money content */}
      {money ? (
        <section className="space-y-6">
          {/* Key numbers */}
          <div className="bg-card rounded-2xl border-2 border-sage p-8 shadow-warm-sm">
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                  Monthly Target
                </h2>
                <p className="font-serif text-4xl font-medium tabular-nums">
                  {money.currency} {Number(money.income_target).toLocaleString()}
                </p>
              </div>
              <div>
                <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                  Price per Unit
                </h2>
                <p className="font-serif text-4xl font-medium tabular-nums">
                  {money.currency} {Number(money.price_per_unit).toLocaleString()}
                </p>
              </div>
              <div>
                <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
                  Units Needed
                </h2>
                <p className="font-serif text-4xl font-medium tabular-nums text-sage">
                  {unitsNeeded?.toLocaleString() ?? "—"}
                </p>
              </div>
            </div>
            {money.hours_per_week && (
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Working <span className="font-medium text-foreground">{money.hours_per_week} hours/week</span>
                </p>
              </div>
            )}
          </div>

          {/* Scenarios */}
          {money.scenarios && (money.scenarios as unknown[]).length > 0 && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
                Scenarios
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                {(money.scenarios as Array<{ name: string; units: number; revenue: number }>).map(
                  (scenario, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-muted/50 border border-border/50"
                    >
                      <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                        {scenario.name}
                      </h3>
                      <p className="font-serif text-2xl font-medium mb-1 tabular-nums">
                        {scenario.units} units
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {money.currency} {scenario.revenue.toLocaleString()} revenue
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {money.notes && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
              <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
                Notes
              </h2>
              <p className="text-base leading-relaxed">{money.notes}</p>
            </div>
          )}
        </section>
      ) : (
        <section className="bg-card rounded-2xl border border-border p-12 text-center">
          <DollarSign className="size-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="font-serif text-xl font-medium mb-2">No money settings yet</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Ask GapFriend to help you calculate your break-even point and create realistic
            scenarios.
          </p>
        </section>
      )}
    </div>
  );
}
