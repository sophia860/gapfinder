import type { GapCard, OpportunityBrief, Identity, Task } from "@/lib/queries";

/**
 * One concrete next thing the user can do on a project — used by both
 * the PortfolioHub "pick up where you left off" card and the per-project
 * Dashboard "your next 1 thing" card.
 *
 * Keep the labels short, action-y, and non-judgmental.
 */
export interface NextAction {
  /** A short, imperative label, e.g. "Pick a market gap". */
  label: string;
  /** Sub-line of context shown under the label. */
  hint: string;
  /** Route to navigate to when the user clicks. */
  to: string;
  /** Stable id for the kind of action (useful for analytics / tests). */
  kind:
    | "pick_gap"
    | "find_gaps"
    | "write_brief"
    | "name_it"
    | "plan_week"
    | "start_a_task"
    | "finish_in_progress"
    | "write_content"
    | "ship_it"
    | "all_clear";
}

interface DeriveInput {
  projectId: string;
  gaps?: Pick<GapCard, "status">[] | null;
  brief?: Pick<OpportunityBrief, "persona" | "problem" | "angle"> | null;
  identity?: Pick<Identity, "chosen_name"> | null;
  tasks?: Pick<Task, "column_name">[] | null;
}

/**
 * Derive the single most useful next action from project state.
 * Order is intentional: discover → decide → execute → ship.
 */
export function deriveNextAction({
  projectId,
  gaps,
  brief,
  identity,
  tasks,
}: DeriveInput): NextAction {
  const hasGaps = (gaps?.length ?? 0) > 0;
  const hasSelectedGap = gaps?.some((g) => g.status === "selected") ?? false;
  const briefDone = !!(brief?.persona && brief?.problem && brief?.angle);
  const named = !!identity?.chosen_name;
  const inProgress = tasks?.filter((t) => t.column_name === "in_progress") ?? [];
  const thisWeek = tasks?.filter((t) => t.column_name === "this_week") ?? [];
  const hasAnyOpenTasks = (tasks?.filter((t) => t.column_name !== "done").length ?? 0) > 0;

  if (!hasGaps) {
    return {
      kind: "find_gaps",
      label: "Find market gaps",
      hint: "Ask GapFriend to suggest 3–5 real gaps tailored to you.",
      to: `/app/${projectId}/gaps`,
    };
  }

  if (hasGaps && !hasSelectedGap && !briefDone) {
    return {
      kind: "pick_gap",
      label: "Pick a market gap",
      hint: "Choose one to turn into an opportunity brief.",
      to: `/app/${projectId}/gaps`,
    };
  }

  if (!briefDone) {
    return {
      kind: "write_brief",
      label: "Write the opportunity brief",
      hint: "Lock in the persona, problem, and angle.",
      to: `/app/${projectId}/brief`,
    };
  }

  if (!named) {
    return {
      kind: "name_it",
      label: "Name it",
      hint: "Pick a name, tagline, and domain.",
      to: `/app/${projectId}/identity`,
    };
  }

  if (!hasAnyOpenTasks) {
    return {
      kind: "plan_week",
      label: "Plan this week",
      hint: "Add 3 small, concrete tasks for the next 7 days.",
      to: `/app/${projectId}/board`,
    };
  }

  if (inProgress.length > 0) {
    return {
      kind: "finish_in_progress",
      label: "Finish what's in progress",
      hint:
        inProgress.length === 1
          ? "1 task is mid-stride — small push to done."
          : `${inProgress.length} tasks are mid-stride.`,
      to: `/app/${projectId}/board`,
    };
  }

  if (thisWeek.length > 0) {
    return {
      kind: "start_a_task",
      label: "Start one task",
      hint: "Move a 'this week' task into 'in progress'.",
      to: `/app/${projectId}/board`,
    };
  }

  return {
    kind: "ship_it",
    label: "Ship something tiny",
    hint: "Open Vibe coding and put a landing page out.",
    to: `/app/${projectId}/vibe`,
  };
}
