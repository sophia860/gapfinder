/**
 * /swarm — Realistic multi-agent dashboard.
 *
 * Architecture: Supabase tables (swarms, swarm_agents, swarm_tasks,
 * swarm_messages) + Realtime subscription + TanStack Start server functions
 * that call OpenAI with the user's key. React Flow renders the topology.
 *
 * Concurrency is bounded server-side; each "tick" runs up to 5 tasks in
 * parallel, capped at 8 per request to protect Worker CPU + OpenAI credits.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ReactFlow, Background, Controls, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  createSwarm, spawnAgents, decomposeGoal, runSwarmTick, listSwarms,
} from "@/lib/swarm.functions";

type Swarm = { id: string; name: string; goal: string; status: string; model: string; max_agents: number };
type Agent = { id: string; swarm_id: string; name: string; role: string; status: string; tokens_used: number; steps_run: number };
type Task = { id: string; swarm_id: string; title: string; description: string | null; status: string; result: string | null; assigned_agent_id: string | null };
type Msg = { id: string; swarm_id: string; from_agent_id: string | null; content: string; kind: string; created_at: string };

const ROLES = ["researcher", "coder", "critic", "executor", "specialist"] as const;

export const Route = createFileRoute("/swarm")({
  head: () => ({
    meta: [
      { title: "Swarm — Multi-Agent Orchestrator" },
      { name: "description", content: "Spawn AI agents, decompose a goal, and watch them collaborate in real time." },
    ],
  }),
  component: SwarmPage,
});

function SwarmPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [swarms, setSwarms] = useState<Swarm[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const refresh = async () => {
    const { swarms } = await listSwarms({ data: {} });
    setSwarms(swarms as Swarm[]);
    if (!activeId && swarms[0]) setActiveId(swarms[0].id);
  };
  useEffect(() => { if (user) void refresh(); }, [user]);

  if (loading || !user) {
    return <div className="min-h-dvh grid place-items-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/app" className="text-sm text-muted-foreground hover:text-foreground">← App</Link>
          <h1 className="text-xl font-semibold tracking-tight">Swarm</h1>
        </div>
        <CreateSwarmDialog onCreated={refresh} />
      </header>
      <div className="grid grid-cols-[260px_1fr] min-h-[calc(100dvh-65px)]">
        <aside className="border-r border-border p-3 space-y-2 overflow-y-auto">
          {swarms.length === 0 && <p className="text-xs text-muted-foreground p-2">No swarms yet. Create one.</p>}
          {swarms.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`w-full text-left rounded-md px-3 py-2 transition-colors ${activeId === s.id ? "bg-accent" : "hover:bg-accent/50"}`}
            >
              <div className="text-sm font-medium truncate">{s.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.status} · {s.model}</div>
            </button>
          ))}
        </aside>
        {activeId ? <SwarmWorkspace key={activeId} swarmId={activeId} /> : (
          <div className="grid place-items-center text-muted-foreground">Pick or create a swarm.</div>
        )}
      </div>
    </div>
  );
}

/* -------------------- Create dialog -------------------- */
function CreateSwarmDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div>
      <Button onClick={() => setOpen(true)}>+ New swarm</Button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <Card className="w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="font-semibold">New swarm</h2>
            <Input placeholder="Name (e.g. 'Launch checklist')" value={name} onChange={e => setName(e.target.value)} />
            <Textarea rows={4} placeholder="High-level goal — the supervisor will decompose this." value={goal} onChange={e => setGoal(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={busy || !name || goal.length < 10} onClick={async () => {
                setBusy(true);
                try {
                  await createSwarm({ data: { name, goal, max_agents: 10, model: "gpt-5-mini" } });
                  setOpen(false); setName(""); setGoal(""); onCreated();
                  toast({ title: "Swarm created", description: "Supervisor seeded." });
                } catch (e) { toast({ title: "Failed", description: e instanceof Error ? e.message : "error", variant: "destructive" }); }
                finally { setBusy(false); }
              }}>{busy ? "Creating…" : "Create"}</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* -------------------- Workspace per swarm -------------------- */
function SwarmWorkspace({ swarmId }: { swarmId: string }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [spawnRole, setSpawnRole] = useState<typeof ROLES[number]>("researcher");
  const [spawnCount, setSpawnCount] = useState(3);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [a, t, m] = await Promise.all([
        supabase.from("swarm_agents").select("*").eq("swarm_id", swarmId).order("created_at"),
        supabase.from("swarm_tasks").select("*").eq("swarm_id", swarmId).order("priority", { ascending: false }),
        supabase.from("swarm_messages").select("*").eq("swarm_id", swarmId).order("created_at", { ascending: false }).limit(100),
      ]);
      if (!active) return;
      setAgents((a.data ?? []) as Agent[]);
      setTasks((t.data ?? []) as Task[]);
      setMessages((m.data ?? []) as Msg[]);
    };
    void load();

    const channel = supabase.channel(`swarm:${swarmId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "swarm_agents", filter: `swarm_id=eq.${swarmId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "swarm_tasks", filter: `swarm_id=eq.${swarmId}` }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "swarm_messages", filter: `swarm_id=eq.${swarmId}` },
        (payload) => setMessages(prev => [payload.new as Msg, ...prev].slice(0, 100)))
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [swarmId]);

  const { nodes, edges } = useMemo(() => buildGraph(agents, tasks), [agents, tasks]);

  const wrap = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); }
    catch (e) { toast({ title: label + " failed", description: e instanceof Error ? e.message : "error", variant: "destructive" }); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid grid-rows-[auto_1fr] min-h-0">
      <div className="border-b border-border p-3 flex flex-wrap items-center gap-2">
        <Select value={spawnRole} onValueChange={(v) => setSpawnRole(v as typeof ROLES[number])}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="number" min={1} max={20} value={spawnCount}
          onChange={e => setSpawnCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
          className="w-20" />
        <Button variant="outline" disabled={busy} onClick={() => wrap("Spawn",
          () => spawnAgents({ data: { swarm_id: swarmId, role: spawnRole, count: spawnCount } }))}>
          Spawn agents
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button disabled={busy} onClick={() => wrap("Decompose",
          () => decomposeGoal({ data: { swarm_id: swarmId } }))}>
          Decompose goal
        </Button>
        <Button disabled={busy} onClick={() => wrap("Tick",
          () => runSwarmTick({ data: { swarm_id: swarmId } }))}>
          Run tick
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">
          {agents.length} agents · {tasks.filter(t => t.status === "done").length}/{tasks.length} tasks done · {messages.length} msgs
        </span>
      </div>

      <Tabs defaultValue="topology" className="min-h-0 flex flex-col">
        <TabsList className="m-3 self-start">
          <TabsTrigger value="topology">Topology</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="topology" className="flex-1 m-0">
          <div className="h-[calc(100dvh-220px)]">
            <ReactFlow nodes={nodes} edges={edges} fitView>
              <Background /><Controls />
            </ReactFlow>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="flex-1 overflow-auto px-3 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {(["pending", "in_progress", "done", "failed"] as const).map(col => (
              <div key={col}>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">{col.replace("_", " ")}</div>
                <div className="space-y-2">
                  {tasks.filter(t => t.status === col).map(t => (
                    <Card key={t.id} className="p-3">
                      <div className="text-sm font-medium">{t.title}</div>
                      {t.description && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.description}</div>}
                      {t.result && <div className="text-xs mt-2 border-l-2 border-border pl-2 line-clamp-3">{t.result}</div>}
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="messages" className="flex-1 overflow-auto px-3 pb-6 space-y-2">
          {messages.map(m => {
            const agent = agents.find(a => a.id === m.from_agent_id);
            return (
              <Card key={m.id} className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline">{agent?.name ?? "system"}</Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleTimeString()}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              </Card>
            );
          })}
          {messages.length === 0 && <p className="text-sm text-muted-foreground">No messages yet.</p>}
        </TabsContent>

        <TabsContent value="agents" className="flex-1 overflow-auto px-3 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {agents.map(a => (
              <Card key={a.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm">{a.name}</div>
                  <Badge>{a.role}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  status: {a.status} · steps: {a.steps_run} · tokens: {a.tokens_used}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------- Topology graph -------------------- */
function buildGraph(agents: Agent[], tasks: Task[]): { nodes: Node[]; edges: Edge[] } {
  const supervisor = agents.find(a => a.role === "supervisor");
  const workers = agents.filter(a => a.role !== "supervisor");

  const nodes: Node[] = [];
  if (supervisor) {
    nodes.push({ id: supervisor.id, position: { x: 0, y: 0 }, data: { label: `👑 ${supervisor.name}` }, style: { background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", borderRadius: 8 } });
  }
  workers.forEach((a, i) => {
    const angle = (i / Math.max(workers.length, 1)) * Math.PI * 2;
    nodes.push({
      id: a.id,
      position: { x: Math.cos(angle) * 240, y: Math.sin(angle) * 200 + 120 },
      data: { label: `${a.name}\n(${a.status})` },
      style: { borderRadius: 8, fontSize: 11, whiteSpace: "pre-line" as const, textAlign: "center" as const, padding: 6 },
    });
  });

  const edges: Edge[] = [];
  if (supervisor) workers.forEach(w => edges.push({ id: `s-${w.id}`, source: supervisor.id, target: w.id, animated: w.status === "thinking" }));
  tasks.forEach(t => {
    if (t.assigned_agent_id) edges.push({ id: `t-${t.id}`, source: t.assigned_agent_id, target: t.assigned_agent_id, label: t.title.slice(0, 24), style: { stroke: "hsl(var(--muted-foreground))" } });
  });
  return { nodes, edges };
}
