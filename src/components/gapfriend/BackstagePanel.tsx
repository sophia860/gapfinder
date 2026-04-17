import { useState } from "react";
import {
  useBackstageInsights,
  useTriggerBackstage,
  useUpdateInsightStatus,
  type BackstageInsight,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Sparkles, Bug, Palette, Bell, Eye, Loader2, Check, X, Clock } from "lucide-react";

const KIND_META: Record<
  BackstageInsight["kind"],
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  wild_niche: { label: "Wild niche", icon: Sparkles },
  redesign: { label: "Redesign", icon: Palette },
  bug: { label: "Bug", icon: Bug },
  reminder: { label: "Reminder", icon: Bell },
  observation: { label: "Observation", icon: Eye },
};

export function BackstagePanel({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const { data: insights = [], isLoading } = useBackstageInsights(projectId);
  const trigger = useTriggerBackstage();
  const updateStatus = useUpdateInsightStatus();

  const openInsights = insights.filter((i) => i.status === "open");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative font-mono text-xs uppercase tracking-widest"
        >
          <Sparkles className="size-3.5 mr-1.5" />
          Backstage
          {openInsights.length > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
              {openInsights.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif text-2xl">Backstage</SheetTitle>
          <SheetDescription>
            Quiet observations, wild niches, redesigns, and reminders from your AI co-pilot.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => trigger.mutate({ projectId, trigger: "manual" })}
            disabled={trigger.isPending}
          >
            {trigger.isPending ? (
              <>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                Thinking…
              </>
            ) : (
              <>
                <Sparkles className="size-3.5 mr-1.5" />
                Run Backstage
              </>
            )}
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {isLoading && (
            <p className="text-sm text-muted-foreground font-mono">Loading…</p>
          )}
          {!isLoading && insights.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No insights yet. Tap "Run Backstage" to let your co-pilot study the project.
            </p>
          )}
          {insights.map((insight) => {
            const meta = KIND_META[insight.kind];
            const Icon = meta.icon;
            const isOpen = insight.status === "open";
            return (
              <div
                key={insight.id}
                className={`rounded-lg border border-border p-4 ${
                  isOpen ? "bg-background" : "bg-muted/40 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="size-4 shrink-0 text-terracotta" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {meta.label}
                    </span>
                    {insight.kind === "wild_niche" && insight.weirdness > 0 && (
                      <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                        {insight.weirdness}/10
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {insight.status}
                  </Badge>
                </div>
                <h3 className="mt-2 font-serif text-base font-medium leading-snug">
                  {insight.title}
                </h3>
                {insight.body && (
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    {insight.body}
                  </p>
                )}
                {isOpen && (
                  <div className="mt-3 flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() =>
                        updateStatus.mutate({
                          id: insight.id,
                          projectId,
                          status: "acted",
                        })
                      }
                    >
                      <Check className="size-3 mr-1" />
                      Acted
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() =>
                        updateStatus.mutate({
                          id: insight.id,
                          projectId,
                          status: "snoozed",
                        })
                      }
                    >
                      <Clock className="size-3 mr-1" />
                      Snooze
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() =>
                        updateStatus.mutate({
                          id: insight.id,
                          projectId,
                          status: "dismissed",
                        })
                      }
                    >
                      <X className="size-3 mr-1" />
                      Dismiss
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
