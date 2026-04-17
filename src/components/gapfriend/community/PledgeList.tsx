import type { Pledge } from "@/lib/queries";
import { formatMoney } from "./format";

interface Props {
  pledges: Pledge[];
  currency?: string;
  limit?: number;
}

function formatBackerId(id: string) {
  return `Backer ${id.slice(0, 4)}…${id.slice(-4)}`;
}

export function PledgeList({ pledges, currency = "USD", limit }: Props) {
  const items = limit ? pledges.slice(0, limit) : pledges;
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No backers yet — be the first to pledge.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((p) => (
        <li key={p.id} className="py-3 flex items-start gap-3">
          <div className="size-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium uppercase shrink-0">
            {p.backer_user_id.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium truncate">
                {formatBackerId(p.backer_user_id)}
              </span>
              <span className="font-serif text-sm">{formatMoney(Number(p.amount), currency)}</span>
            </div>
            {p.message && (
              <p className="text-sm text-muted-foreground mt-1 break-words">{p.message}</p>
            )}
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
              {new Date(p.created_at).toLocaleDateString()}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
