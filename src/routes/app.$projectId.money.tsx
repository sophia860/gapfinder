import { createFileRoute } from "@tanstack/react-router";
import { useMoney } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Coins, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/$projectId/money")({
  component: MoneyPage,
});

function MoneyPage() {
  const { projectId } = Route.useParams();
  const { data: money } = useMoney(projectId);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function ask() {
    setBusy(true);
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
      toast.success("Money updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reach GapFriend");
    } finally {
      setBusy(false);
    }
  }

  const scenarios = (money?.scenarios as Array<{ name: string; units?: number; revenue?: number; note?: string }> | null) ?? [];

  const breakeven =
    money?.income_target && money?.price_per_unit
      ? Math.ceil(Number(money.income_target) / Number(money.price_per_unit))
      : null;

  return (
    <div className="px-6 lg:px-12 py-10 max-w-4xl mx-auto space-y-6 pb-20">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-mono text-terracotta">Execute</p>
          <h1 className="font-serif text-4xl font-medium mt-1">Money</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            What "enough" looks like. Keep it honest.
          </p>
        </div>
        <Button className="rounded-full" disabled={busy} onClick={ask}>
          {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Coins className="size-4 mr-2" />}
          {money ? "Refresh" : "Propose"}
        </Button>
      </header>

      <div className="grid md:grid-cols-3 gap-4">
        <Stat
          label="Monthly target"
          value={money?.income_target ? `${money.currency} ${Number(money.income_target).toLocaleString()}` : "—"}
        />
        <Stat
          label="Price per unit"
          value={money?.price_per_unit ? `${money.currency} ${Number(money.price_per_unit).toLocaleString()}` : "—"}
        />
        <Stat
          label="Break-even units"
          value={breakeven ? `${breakeven} / month` : "—"}
        />
      </div>

      <div className="bg-card rounded-3xl border border-border p-7 shadow-warm-sm">
        <h2 className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-4">
          Scenarios
        </h2>
        {scenarios.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No scenarios yet.</p>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {scenarios.map((s, i) => (
              <div key={i} className="p-4 rounded-2xl border border-border bg-background">
                <div className="font-serif text-lg font-medium capitalize">{s.name}</div>
                {s.units != null && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {s.units} units → {money?.currency ?? ""} {(s.revenue ?? 0).toLocaleString()}
                  </div>
                )}
                {s.note && <p className="text-xs text-muted-foreground mt-2 italic">{s.note}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5">
      <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground">
        {label}
      </div>
      <div className="font-serif text-2xl font-medium tabular-nums mt-1.5">{value}</div>
    </div>
  );
}
