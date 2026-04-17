import { Link } from "@tanstack/react-router";
import type { Campaign } from "@/lib/queries";
import { CampaignProgress } from "./CampaignProgress";
import { Sparkles } from "lucide-react";

interface Props {
  campaign: Campaign;
  raised?: number;
  backers?: number;
}

export function CampaignCard({ campaign, raised = 0, backers = 0 }: Props) {
  return (
    <Link
      to="/community/$campaignId"
      params={{ campaignId: campaign.id }}
      className="group bg-card border border-border rounded-2xl p-6 hover:shadow-warm transition-all hover:-translate-y-0.5 flex flex-col"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="size-10 rounded-xl bg-terracotta-soft text-terracotta flex items-center justify-center font-serif text-sm font-medium shrink-0">
          {campaign.cover_url ? (
            <img src={campaign.cover_url} alt="" className="size-10 rounded-xl object-cover" />
          ) : (
            <Sparkles className="size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-lg font-medium leading-tight truncate">
            {campaign.title}
          </h3>
          {campaign.category && (
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
              {campaign.category}
            </p>
          )}
        </div>
      </div>
      {campaign.pitch && (
        <p className="text-sm text-muted-foreground line-clamp-3 mb-4">{campaign.pitch}</p>
      )}
      <div className="mt-auto">
        <CampaignProgress
          raised={raised}
          goal={Number(campaign.goal_amount ?? 0)}
          currency={campaign.currency}
          backers={backers}
        />
      </div>
    </Link>
  );
}
