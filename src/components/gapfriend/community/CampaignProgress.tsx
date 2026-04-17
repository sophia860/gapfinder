import { Progress } from "@/components/ui/progress";
import { formatMoney } from "./format";

interface Props {
  raised: number;
  goal: number;
  currency?: string;
  backers?: number;
}

export function CampaignProgress({ raised, goal, currency = "USD", backers }: Props) {
  const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-serif text-2xl font-medium">{formatMoney(raised, currency)}</span>
        <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          of {formatMoney(goal, currency)} • {pct}%
        </span>
      </div>
      <Progress value={pct} className="mt-2 h-2" />
      {typeof backers === "number" && (
        <div className="mt-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
          {backers} {backers === 1 ? "backer" : "backers"}
        </div>
      )}
    </div>
  );
}
