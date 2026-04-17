import { useProject, useIdentity, useMoney, useChannels, useTasks, useContentPieces, useBrief } from "@/lib/queries";
import { Sparkles, Globe, DollarSign, ListChecks, Pencil, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  projectId: string;
}

export function Dashboard({ projectId }: Props) {
  const { data: project } = useProject(projectId);
  const { data: identity } = useIdentity(projectId);
  const { data: money } = useMoney(projectId);
  const { data: channels } = useChannels(projectId);
  const { data: tasks } = useTasks(projectId);
  const { data: content } = useContentPieces(projectId);
  const { data: brief } = useBrief(projectId);

  const tasksByCol = {
    later: tasks?.filter((t) => t.column_name === "later") ?? [],
    this_week: tasks?.filter((t) => t.column_name === "this_week") ?? [],
    in_progress: tasks?.filter((t) => t.column_name === "in_progress") ?? [],
    done: tasks?.filter((t) => t.column_name === "done") ?? [],
  };

  return (
    <div className="px-6 lg:px-12 py-10 max-w-5xl mx-auto space-y-8 pb-20">
      {/* Identity hero */}
      <section className="bg-card rounded-3xl border border-border p-8 md:p-10 shadow-warm-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-terracotta-soft/40 rounded-bl-[120px] -mr-10 -mt-10 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-[10px] font-mono uppercase tracking-widest">
              Cover story · Identity
            </span>
            {!brief && (
              <span className="text-xs text-muted-foreground italic">no brief yet</span>
            )}
          </div>
          <h1 className="font-serif text-5xl md:text-6xl font-medium tracking-tight text-balance">
            {identity?.chosen_name || project?.working_name || "Untitled"}
          </h1>
          {(identity?.tagline || project?.tagline) && (
            <p className="mt-3 font-serif italic text-xl text-muted-foreground text-pretty max-w-2xl">
              "{identity?.tagline ?? project?.tagline}"
            </p>
          )}
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
            {project?.description || "No description yet. Pick a gap and write your opportunity brief — GapFriend will help shape this into something real."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button className="rounded-full">
              <Sparkles className="size-4 mr-2" /> Refine identity
            </Button>
            <Button variant="outline" className="rounded-full">
              Explore gaps
            </Button>
          </div>
        </div>
      </section>

      {/* Grid of cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <Card icon={Globe} title="Naming & home" subtitle="domain · positioning">
          {identity?.chosen_domain ? (
            <div className="p-3 rounded-xl bg-sage/15 border border-sage/30 flex items-center justify-between">
              <span className="font-mono text-sm">{identity.chosen_domain}</span>
              <span className="text-[10px] uppercase tracking-wider text-sage font-semibold">Chosen</span>
            </div>
          ) : (
            <Empty>No name picked yet. Ask GapFriend to suggest some.</Empty>
          )}
        </Card>

        <Card icon={Radio} title="Where to be online" subtitle="channels & platforms">
          {channels?.length ? (
            <ul className="space-y-2.5">
              {channels.slice(0, 3).map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="font-medium">{c.name}</span>
                  {c.rationale && <span className="block text-xs text-muted-foreground mt-0.5">{c.rationale}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No channels recommended yet.</Empty>
          )}
        </Card>

        <Card icon={DollarSign} title="The math" subtitle="break-even & pricing">
          {money?.income_target && money.price_per_unit ? (
            <>
              <div className="font-serif text-3xl font-medium tabular-nums">
                {money.currency} {Number(money.income_target).toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                ~{Math.ceil(Number(money.income_target) / Number(money.price_per_unit))} sales at {money.currency} {Number(money.price_per_unit).toLocaleString()} each.
              </p>
            </>
          ) : (
            <Empty>Set your income target and rough price to see break-even.</Empty>
          )}
        </Card>

        <Card icon={ListChecks} title="This week's focus" subtitle={`${tasksByCol.this_week.length + tasksByCol.in_progress.length} active · ${tasksByCol.done.length} done`} className="md:col-span-2">
          <div className="grid grid-cols-2 gap-3">
            {(["this_week", "in_progress"] as const).map((col) => (
              <div key={col} className="bg-muted/50 rounded-xl p-3">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  {col === "this_week" ? "This week" : "In progress"}
                </span>
                <div className="mt-2 space-y-1.5">
                  {tasksByCol[col].slice(0, 3).map((t) => (
                    <div key={t.id} className={`bg-background p-2.5 rounded-lg text-xs font-medium ${col === "in_progress" ? "border-l-2 border-terracotta" : "border border-border/50"}`}>
                      {t.title}
                    </div>
                  ))}
                  {tasksByCol[col].length === 0 && <div className="text-xs text-muted-foreground italic">Nothing here yet</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card icon={Pencil} title="Content seeds" subtitle="SEO & threads">
          {content?.length ? (
            <ul className="space-y-2 text-sm">
              {content.slice(0, 3).map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <span className="size-1.5 rounded-full bg-terracotta/50 mt-1.5 shrink-0" />
                  <span className="truncate">{c.title || (c.source_text?.slice(0, 60) + "…")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Paste a draft and turn it into SEO copy or a thread.</Empty>
          )}
        </Card>
      </section>

      <p className="text-center text-xs text-muted-foreground font-mono uppercase tracking-widest pt-6">
        AI flows wire up next · ask GapFriend anything in the chat →
      </p>
    </div>
  );
}

function Card({
  icon: Icon,
  title,
  subtitle,
  children,
  className = "",
}: {
  icon: typeof Globe;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-card rounded-2xl border border-border p-6 shadow-warm-sm hover:shadow-warm transition-shadow ${className}`}>
      <div className="flex items-start gap-3 mb-4">
        <div className="size-9 rounded-xl bg-terracotta-soft text-terracotta flex items-center justify-center shrink-0">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0">
          <h3 className="font-serif text-lg font-medium leading-tight">{title}</h3>
          {subtitle && <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground italic leading-relaxed">{children}</div>;
}
