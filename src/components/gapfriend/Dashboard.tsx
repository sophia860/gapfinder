import { useState } from "react";
import {
  useProject,
  useIdentity,
  useMoney,
  useChannels,
  useTasks,
  useContentPieces,
  useBrief,
  useGapCards,
} from "@/lib/queries";
import {
  Sparkles,
  Globe,
  DollarSign,
  ListChecks,
  Pencil,
  Radio,
  Lightbulb,
  Beaker,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  projectId: string;
}

export function Dashboard({ projectId }: Props) {
  const { user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const isDev = profile?.mode === "developer";
  const { data: project } = useProject(projectId);
  const { data: identity } = useIdentity(projectId);
  const { data: money } = useMoney(projectId);
  const { data: channels } = useChannels(projectId);
  const { data: tasks } = useTasks(projectId);
  const { data: content } = useContentPieces(projectId);
  const { data: brief } = useBrief(projectId);
  const { data: gaps } = useGapCards(projectId);
  const qc = useQueryClient();

  const tasksByCol = {
    later: tasks?.filter((t) => t.column_name === "later") ?? [],
    this_week: tasks?.filter((t) => t.column_name === "this_week") ?? [],
    in_progress: tasks?.filter((t) => t.column_name === "in_progress") ?? [],
    done: tasks?.filter((t) => t.column_name === "done") ?? [],
  };

  // Quick chat-driven actions: send a prompt to GapFriend
  const [busyAction, setBusyAction] = useState<string | null>(null);
  async function askGapFriend(prompt: string, label: string) {
    setBusyAction(label);
    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-chat", {
        body: { projectId, message: prompt },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      qc.invalidateQueries({ queryKey: ["chat", projectId] });
      qc.invalidateQueries({ queryKey: ["brief", projectId] });
      qc.invalidateQueries({ queryKey: ["gaps", projectId] });
      qc.invalidateQueries({ queryKey: ["identity", projectId] });
      qc.invalidateQueries({ queryKey: ["channels", projectId] });
      qc.invalidateQueries({ queryKey: ["money", projectId] });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      toast.success("GapFriend updated your workspace");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't reach GapFriend");
    } finally {
      setBusyAction(null);
    }
  }

  async function setGapStatus(id: string, status: "selected" | "dismissed") {
    const { error } = await supabase.from("gap_cards").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["gaps", projectId] });
    if (status === "selected") {
      toast.success("Picked. Ask GapFriend to turn this into an opportunity brief.");
    }
  }

  const suggestedGaps = gaps?.filter((g) => g.status === "suggested") ?? [];
  const selectedGap = gaps?.find((g) => g.status === "selected");

  return (
    <div className="px-6 lg:px-12 py-10 max-w-5xl mx-auto space-y-8 pb-20">
      {/* Identity hero */}
      <section className="bg-card rounded-3xl border border-border p-8 md:p-10 shadow-warm-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-terracotta-soft/40 rounded-bl-[120px] -mr-10 -mt-10 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-[10px] font-mono uppercase tracking-widest">
              Cover story · Identity
            </span>
            {!brief && <span className="text-xs text-muted-foreground italic">no brief yet</span>}
            {brief && <span className="text-xs text-sage italic">brief saved</span>}
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
            {brief?.angle ||
              project?.description ||
              "No description yet. Pick a gap and write your opportunity brief — GapFriend will help shape this into something real."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button
              className="rounded-full"
              disabled={!!busyAction}
              onClick={() =>
                askGapFriend(
                  "Suggest 5 specific market gaps for me based on my profile and project so far. Use the add_gap_cards tool.",
                  "gaps",
                )
              }
            >
              {busyAction === "gaps" ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Lightbulb className="size-4 mr-2" />
              )}
              Find market gaps
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              disabled={!!busyAction}
              onClick={() =>
                askGapFriend(
                  identity?.chosen_name
                    ? "Refine the identity (name, tagline, positioning, 5 domain options) for this project. Use save_identity."
                    : "Suggest 5 name options, 5 domain options, a tagline, and a positioning sentence for this project. Use save_identity.",
                  "identity",
                )
              }
            >
              {busyAction === "identity" ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="size-4 mr-2" />
              )}
              {identity?.chosen_name ? "Refine identity" : "Help me name it"}
            </Button>
          </div>
        </div>
      </section>

      {/* Gap cards */}
      {(suggestedGaps.length > 0 || selectedGap) && (
        <section className="bg-card rounded-3xl border border-border p-7 md:p-9 shadow-warm-sm">
          <div className="flex items-start gap-3 mb-5">
            <div className="size-9 rounded-xl bg-sage/20 text-sage flex items-center justify-center shrink-0">
              <Lightbulb className="size-4" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-medium leading-tight">
                Market gaps to consider
              </h2>
              <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mt-1">
                pick one to turn into a brief
              </p>
            </div>
          </div>
          {selectedGap && (
            <div className="mb-5 p-4 rounded-2xl bg-sage/10 border border-sage/30">
              <div className="text-[10px] uppercase tracking-widest font-mono text-sage mb-1">
                Currently exploring
              </div>
              <h3 className="font-serif text-lg font-medium">{selectedGap.title}</h3>
              {selectedGap.problem && (
                <p className="text-sm text-muted-foreground mt-1.5">{selectedGap.problem}</p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="rounded-full mt-3"
                disabled={!!busyAction}
                onClick={() =>
                  askGapFriend(
                    `Turn the selected gap "${selectedGap.title}" into a tight opportunity brief (persona, problem, angle, business_model). Use save_opportunity_brief. Then add 3 concrete validation tasks for this week using add_tasks.`,
                    "brief",
                  )
                }
              >
                {busyAction === "brief" ? <Loader2 className="size-3.5 mr-2 animate-spin" /> : null}
                Turn into a brief + tasks
              </Button>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            {suggestedGaps.map((g) => (
              <div
                key={g.id}
                className="p-4 rounded-2xl border border-border bg-background flex flex-col"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-serif text-base font-medium leading-snug">{g.title}</h4>
                  {g.difficulty && (
                    <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                      {g.difficulty}
                    </span>
                  )}
                </div>
                {g.persona && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">Who:</span> {g.persona}
                  </p>
                )}
                {g.problem && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium text-foreground/80">Problem:</span> {g.problem}
                  </p>
                )}
                {g.why_gap && (
                  <p className="text-xs text-muted-foreground mt-1 italic">{g.why_gap}</p>
                )}
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    className="rounded-full h-7 text-xs"
                    onClick={() => setGapStatus(g.id, "selected")}
                  >
                    <Check className="size-3 mr-1" /> Pick this
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full h-7 text-xs"
                    onClick={() => setGapStatus(g.id, "dismissed")}
                  >
                    <X className="size-3 mr-1" /> Pass
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Grid of cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <Card icon={Globe} title="Naming & home" subtitle="domain · positioning">
          {identity?.chosen_domain ? (
            <div className="p-3 rounded-xl bg-sage/15 border border-sage/30 flex items-center justify-between">
              <span className="font-mono text-sm">{identity.chosen_domain}</span>
              <span className="text-[10px] uppercase tracking-wider text-sage font-semibold">
                Chosen
              </span>
            </div>
          ) : identity?.name_options && (identity.name_options as unknown[]).length > 0 ? (
            <ul className="space-y-1.5">
              {(identity.name_options as string[]).slice(0, 4).map((n) => (
                <li key={n} className="text-sm font-serif">
                  {n}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No name picked yet. Hit "Help me name it" above.</Empty>
          )}
        </Card>

        <Card
          icon={Radio}
          title="Where to be online"
          subtitle="channels & platforms"
          action={
            <button
              className="text-[10px] font-mono uppercase tracking-widest text-terracotta hover:underline disabled:opacity-50"
              disabled={!!busyAction}
              onClick={() =>
                askGapFriend(
                  "Recommend 3 channels (online or offline) for me to be visible on, with rationale, pros, cons, and a starter guide. Use save_channels.",
                  "channels",
                )
              }
            >
              {busyAction === "channels" ? "…" : channels?.length ? "Refresh" : "Suggest"}
            </button>
          }
        >
          {channels?.length ? (
            <ul className="space-y-2.5">
              {channels.slice(0, 3).map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="font-medium">{c.name}</span>
                  {c.is_primary && (
                    <span className="ml-2 text-[10px] font-mono uppercase tracking-wider text-terracotta">
                      primary
                    </span>
                  )}
                  {c.rationale && (
                    <span className="block text-xs text-muted-foreground mt-0.5">
                      {c.rationale}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No channels recommended yet.</Empty>
          )}
        </Card>

        <Card
          icon={DollarSign}
          title="The math"
          subtitle="break-even & pricing"
          action={
            <button
              className="text-[10px] font-mono uppercase tracking-widest text-terracotta hover:underline disabled:opacity-50"
              disabled={!!busyAction}
              onClick={() =>
                askGapFriend(
                  "Propose realistic money settings — currency, monthly income_target, price_per_unit, hours_per_week, and 3 scenarios (lean/realistic/ambitious) with units and revenue. Use save_money.",
                  "money",
                )
              }
            >
              {busyAction === "money" ? "…" : money ? "Refresh" : "Suggest"}
            </button>
          }
        >
          {money?.income_target && money.price_per_unit ? (
            <>
              <div className="font-serif text-3xl font-medium tabular-nums">
                {money.currency} {Number(money.income_target).toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                ~{Math.ceil(Number(money.income_target) / Number(money.price_per_unit))} sales at{" "}
                {money.currency} {Number(money.price_per_unit).toLocaleString()} each.
              </p>
            </>
          ) : (
            <Empty>Set your income target and rough price to see break-even.</Empty>
          )}
        </Card>

        <Card
          icon={ListChecks}
          title="This week's focus"
          subtitle={`${tasksByCol.this_week.length + tasksByCol.in_progress.length} active · ${tasksByCol.done.length} done`}
          className="md:col-span-2"
          action={
            <button
              className="text-[10px] font-mono uppercase tracking-widest text-terracotta hover:underline disabled:opacity-50"
              disabled={!!busyAction}
              onClick={() =>
                askGapFriend(
                  "Based on everything we know, add 3 concrete tasks for THIS WEEK. Use add_tasks with column_name=this_week.",
                  "tasks",
                )
              }
            >
              {busyAction === "tasks" ? "…" : "Plan my week"}
            </button>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            {(["this_week", "in_progress"] as const).map((col) => (
              <div key={col} className="bg-muted/50 rounded-xl p-3">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                  {col === "this_week" ? "This week" : "In progress"}
                </span>
                <div className="mt-2 space-y-1.5">
                  {tasksByCol[col].slice(0, 4).map((t) => (
                    <div
                      key={t.id}
                      className={`bg-background p-2.5 rounded-lg text-xs font-medium ${col === "in_progress" ? "border-l-2 border-terracotta" : "border border-border/50"}`}
                    >
                      {t.title}
                    </div>
                  ))}
                  {tasksByCol[col].length === 0 && (
                    <div className="text-xs text-muted-foreground italic">Nothing here yet</div>
                  )}
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
                  <span className="truncate">{c.title || c.source_text?.slice(0, 60) + "…"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Use the composer below to turn a draft into SEO + a thread.</Empty>
          )}
        </Card>

        <Card
          icon={Sparkles}
          title="Start building"
          subtitle="vibe or code"
          className="md:col-span-2 lg:col-span-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href={`/app/${projectId}/vibe`}
              className="group p-6 rounded-xl border-2 border-border hover:border-terracotta/40 bg-gradient-to-br from-background to-muted/20 transition-all hover:shadow-lg"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="size-10 rounded-lg bg-terracotta-soft flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Sparkles className="size-5 text-terracotta" />
                </div>
                <div>
                  <h4 className="font-serif font-medium text-base">Vibe Coding</h4>
                  <p className="text-xs text-muted-foreground">For non-coders</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Describe what you want to build and I'll generate it from your project's brief and
                identity. No code required.
              </p>
            </a>
            <a
              href={`/app/${projectId}/code`}
              className="group p-6 rounded-xl border-2 border-border hover:border-terracotta/40 bg-gradient-to-br from-background to-muted/20 transition-all hover:shadow-lg"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="size-10 rounded-lg bg-muted flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Beaker className="size-5" />
                </div>
                <div>
                  <h4 className="font-serif font-medium text-base">Coding Space</h4>
                  <p className="text-xs text-muted-foreground">For developers</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Full in-browser IDE with file explorer, code editor, and live preview. Write or
                tweak code directly.
              </p>
            </a>
          </div>
        </Card>
      </section>

      {/* Simulator + content composer */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Simulator projectId={projectId} brief={brief} />
        <ContentComposer projectId={projectId} />
      </section>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function Card({
  icon: Icon,
  title,
  subtitle,
  children,
  className = "",
  action,
}: {
  icon: typeof Globe;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`bg-card rounded-2xl border border-border p-6 shadow-warm-sm hover:shadow-warm transition-shadow ${className}`}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="size-9 rounded-xl bg-terracotta-soft text-terracotta flex items-center justify-center shrink-0">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-serif text-lg font-medium leading-tight">{title}</h3>
            {action}
          </div>
          {subtitle && (
            <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mt-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground italic leading-relaxed">{children}</div>;
}

function Simulator({
  projectId,
  brief,
}: {
  projectId: string;
  brief: { persona?: string | null } | null | undefined;
}) {
  const [idea, setIdea] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    reactions: { name: string; reaction: string; would_pay: boolean }[];
    objections: string;
    hooks: string;
    verdict: "strong" | "needs_work" | "kill";
    recommendation: string;
  } | null>(null);

  async function run() {
    if (!idea.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-simulate", {
        body: { projectId, idea: idea.trim(), persona: brief?.persona ?? null },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setResult((data as { simulation: NonNullable<typeof result> }).simulation);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="size-9 rounded-xl bg-sage/20 text-sage flex items-center justify-center shrink-0">
          <Beaker className="size-4" />
        </div>
        <div>
          <h3 className="font-serif text-lg font-medium leading-tight">
            Synthetic customer simulator
          </h3>
          <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mt-1">
            stress-test an idea
          </p>
        </div>
      </div>
      <Textarea
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        placeholder="Pitch your idea in 1–2 sentences…"
        className="min-h-20"
      />
      <Button onClick={run} disabled={busy || !idea.trim()} className="rounded-full mt-3">
        {busy ? (
          <Loader2 className="size-4 mr-2 animate-spin" />
        ) : (
          <Beaker className="size-4 mr-2" />
        )}
        Run simulation
      </Button>
      {result && (
        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] uppercase tracking-widest font-mono px-2 py-1 rounded ${
                result.verdict === "strong"
                  ? "bg-sage/20 text-sage"
                  : result.verdict === "kill"
                    ? "bg-destructive/15 text-destructive"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {result.verdict.replace("_", " ")}
            </span>
          </div>
          <div className="space-y-2">
            {result.reactions.map((r, i) => (
              <div key={i} className="text-sm bg-muted/40 rounded-xl p-3">
                <div className="font-medium text-xs">
                  {r.name} · {r.would_pay ? "would pay" : "wouldn't pay"}
                </div>
                <p className="text-muted-foreground mt-1">{r.reaction}</p>
              </div>
            ))}
          </div>
          <div className="text-sm">
            <p>
              <span className="font-medium">Objections:</span> {result.objections}
            </p>
            <p className="mt-1.5">
              <span className="font-medium">Hooks:</span> {result.hooks}
            </p>
            <p className="mt-1.5 italic text-muted-foreground">{result.recommendation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function ContentComposer({ projectId }: { projectId: string }) {
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    title: string;
    seo_version: string;
    thread_frames: string[];
  } | null>(null);
  const qc = useQueryClient();

  async function run() {
    if (!draft.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-content", {
        body: { projectId, draft: draft.trim(), title: title.trim() || null },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      const piece = (data as { piece: typeof result }).piece;
      setResult(piece as NonNullable<typeof result>);
      qc.invalidateQueries({ queryKey: ["content", projectId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't compose");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="size-9 rounded-xl bg-terracotta-soft text-terracotta flex items-center justify-center shrink-0">
          <Pencil className="size-4" />
        </div>
        <div>
          <h3 className="font-serif text-lg font-medium leading-tight">Content composer</h3>
          <p className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mt-1">
            draft → SEO + thread
          </p>
        </div>
      </div>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="mb-2"
      />
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Paste rough notes, a voice memo transcript, or a half-baked thought…"
        className="min-h-24"
      />
      <Button onClick={run} disabled={busy || !draft.trim()} className="rounded-full mt-3">
        {busy ? (
          <Loader2 className="size-4 mr-2 animate-spin" />
        ) : (
          <Pencil className="size-4 mr-2" />
        )}
        Compose
      </Button>
      {result && (
        <div className="mt-5 space-y-4 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-1">
              SEO version
            </div>
            <h4 className="font-serif text-base font-medium mb-1">{result.title}</h4>
            <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
              {result.seo_version}
            </p>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest font-mono text-muted-foreground mb-1">
              Thread
            </div>
            <ol className="space-y-2">
              {result.thread_frames.map((f, i) => (
                <li key={i} className="bg-muted/40 rounded-xl p-3">
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {i + 1}/{result.thread_frames.length}
                  </span>
                  <p className="mt-1">{f}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
