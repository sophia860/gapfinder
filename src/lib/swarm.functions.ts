/**
 * Swarm orchestrator — TanStack Start server functions.
 *
 * Why server functions and not edge functions: this project ships on Cloudflare
 * Workers SSR; server functions run there cheaply and have first-class access
 * to the authenticated Supabase client + OPENAI_API_KEY secret.
 *
 * Concurrency: every loop is bounded (MAX_AGENTS_PER_SWARM, MAX_STEPS_PER_RUN,
 * a hard cap on parallel OpenAI calls per request) so a runaway swarm can't
 * burn through the user's OpenAI credits or hit the Worker CPU limit.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const MAX_AGENTS_PER_SWARM = 50;
const MAX_PARALLEL_STEPS = 5;
const MAX_STEPS_PER_RUN = 8;

type Role = "supervisor" | "researcher" | "coder" | "critic" | "executor" | "specialist";

const ROLE_PROMPTS: Record<Role, string> = {
  supervisor:
    "You are the Supervisor. Decompose the user's high-level goal into 3-6 concrete subtasks. Reply ONLY as JSON: {\"tasks\":[{\"title\":\"...\",\"description\":\"...\",\"role\":\"researcher|coder|critic|executor|specialist\"}]}.",
  researcher: "You are a Researcher. Investigate the assigned subtask and produce a concise findings brief (max 200 words).",
  coder: "You are a Coder. Produce a small, focused implementation snippet or pseudocode for the assigned subtask. Keep it under 80 lines.",
  critic: "You are a Critic. Review prior agent output for risks, gaps, and weaknesses. Be terse and specific. Max 150 words.",
  executor: "You are the Executor. Summarize what would be done to ship this subtask in production. Bullet points only.",
  specialist: "You are a Domain Specialist. Provide expert insight on the assigned subtask. Max 200 words.",
};

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): Promise<{ text: string; tokens: number }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, max_completion_tokens: 600 }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${errText.slice(0, 300)}`);
  }
  const j = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
  };
  return {
    text: j.choices?.[0]?.message?.content ?? "",
    tokens: j.usage?.total_tokens ?? 0,
  };
}

/* -------------------- Create swarm -------------------- */
export const createSwarm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().min(1).max(100),
      goal: z.string().min(10).max(2000),
      max_agents: z.number().int().min(1).max(MAX_AGENTS_PER_SWARM).default(10),
      model: z.enum(["gpt-5-nano", "gpt-5-mini", "gpt-5"]).default("gpt-5-mini"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: swarm, error } = await supabase
      .from("swarms")
      .insert({ user_id: userId, name: data.name, goal: data.goal, max_agents: data.max_agents, model: data.model })
      .select()
      .single();
    if (error || !swarm) throw new Error(error?.message ?? "create failed");

    // Seed a Supervisor agent.
    await supabase.from("swarm_agents").insert({
      swarm_id: swarm.id,
      name: "Supervisor",
      role: "supervisor",
      system_prompt: ROLE_PROMPTS.supervisor,
    });
    return { swarm };
  });

/* -------------------- Spawn agents -------------------- */
export const spawnAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      swarm_id: z.string().uuid(),
      role: z.enum(["researcher", "coder", "critic", "executor", "specialist"]),
      count: z.number().int().min(1).max(20),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { count: existing } = await supabase
      .from("swarm_agents").select("id", { count: "exact", head: true }).eq("swarm_id", data.swarm_id);
    const { data: swarm } = await supabase.from("swarms").select("max_agents").eq("id", data.swarm_id).maybeSingle();
    if (!swarm) throw new Error("Swarm not found");
    const room = swarm.max_agents - (existing ?? 0);
    const toSpawn = Math.max(0, Math.min(data.count, room));
    if (toSpawn === 0) return { spawned: 0 };

    const rows = Array.from({ length: toSpawn }, (_, i) => ({
      swarm_id: data.swarm_id,
      name: `${data.role}-${(existing ?? 0) + i + 1}`,
      role: data.role,
      system_prompt: ROLE_PROMPTS[data.role],
    }));
    const { error } = await supabase.from("swarm_agents").insert(rows);
    if (error) throw new Error(error.message);
    return { spawned: toSpawn };
  });

/* -------------------- Decompose goal -------------------- */
export const decomposeGoal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ swarm_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    const { data: swarm } = await supabase.from("swarms").select("*").eq("id", data.swarm_id).maybeSingle();
    if (!swarm) throw new Error("Swarm not found");

    const { data: supervisor } = await supabase
      .from("swarm_agents").select("*").eq("swarm_id", data.swarm_id).eq("role", "supervisor").maybeSingle();
    if (!supervisor) throw new Error("No supervisor in swarm");

    await supabase.from("swarm_agents").update({ status: "thinking" }).eq("id", supervisor.id);

    const { text, tokens } = await callOpenAI(apiKey, swarm.model, [
      { role: "system", content: supervisor.system_prompt },
      { role: "user", content: `Goal: ${swarm.goal}` },
    ]);

    let parsed: { tasks?: Array<{ title: string; description?: string; role?: Role }> } = {};
    try { parsed = JSON.parse(text.replace(/^```json|```$/g, "").trim()); } catch { parsed = { tasks: [] }; }
    const tasks = (parsed.tasks ?? []).slice(0, 6);

    if (tasks.length) {
      await supabase.from("swarm_tasks").insert(
        tasks.map((t, i) => ({
          swarm_id: data.swarm_id,
          title: t.title.slice(0, 200),
          description: (t.description ?? "").slice(0, 1000),
          priority: tasks.length - i,
        })),
      );
    }
    await supabase.from("swarm_messages").insert({
      swarm_id: data.swarm_id, from_agent_id: supervisor.id, content: text.slice(0, 4000), kind: "thought",
    });
    await supabase.from("swarm_agents").update({
      status: "idle", tokens_used: supervisor.tokens_used + tokens, steps_run: supervisor.steps_run + 1,
    }).eq("id", supervisor.id);

    return { tasks: tasks.length };
  });

/* -------------------- Run one tick: assign + execute pending tasks -------------------- */
export const runSwarmTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ swarm_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    const { data: swarm } = await supabase.from("swarms").select("*").eq("id", data.swarm_id).maybeSingle();
    if (!swarm) throw new Error("Swarm not found");

    await supabase.from("swarms").update({ status: "running" }).eq("id", data.swarm_id);

    const { data: pending } = await supabase
      .from("swarm_tasks").select("*").eq("swarm_id", data.swarm_id).eq("status", "pending")
      .order("priority", { ascending: false }).limit(MAX_PARALLEL_STEPS);

    const { data: workers } = await supabase
      .from("swarm_agents").select("*").eq("swarm_id", data.swarm_id).neq("role", "supervisor");

    if (!pending?.length || !workers?.length) {
      await supabase.from("swarms").update({ status: pending?.length ? "blocked" as never : "idle" }).eq("id", data.swarm_id);
      return { processed: 0 };
    }

    // Round-robin assign
    let processed = 0;
    await Promise.all(
      pending.slice(0, MAX_STEPS_PER_RUN).map(async (task, idx) => {
        const agent = workers[idx % workers.length];
        await supabase.from("swarm_tasks").update({ status: "in_progress", assigned_agent_id: agent.id }).eq("id", task.id);
        await supabase.from("swarm_agents").update({ status: "thinking" }).eq("id", agent.id);

        try {
          const { text, tokens } = await callOpenAI(apiKey, swarm.model, [
            { role: "system", content: agent.system_prompt },
            { role: "user", content: `Goal context: ${swarm.goal}\n\nYour subtask: ${task.title}\n${task.description ?? ""}` },
          ]);
          await supabase.from("swarm_tasks").update({ status: "done", result: text.slice(0, 4000) }).eq("id", task.id);
          await supabase.from("swarm_messages").insert({
            swarm_id: data.swarm_id, from_agent_id: agent.id, task_id: task.id, content: text.slice(0, 4000), kind: "chat",
          });
          await supabase.from("swarm_agents").update({
            status: "idle", tokens_used: agent.tokens_used + tokens, steps_run: agent.steps_run + 1,
          }).eq("id", agent.id);
          processed++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "unknown";
          await supabase.from("swarm_tasks").update({ status: "failed", result: msg }).eq("id", task.id);
          await supabase.from("swarm_agents").update({ status: "error" }).eq("id", agent.id);
        }
      }),
    );

    const { count: stillPending } = await supabase
      .from("swarm_tasks").select("id", { count: "exact", head: true }).eq("swarm_id", data.swarm_id).in("status", ["pending", "in_progress"]);
    await supabase.from("swarms").update({ status: stillPending ? "running" : "done" }).eq("id", data.swarm_id);

    return { processed };
  });

/* -------------------- List swarms -------------------- */
export const listSwarms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Record<string, never>) => d)
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.from("swarms").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { swarms: data ?? [] };
  });
