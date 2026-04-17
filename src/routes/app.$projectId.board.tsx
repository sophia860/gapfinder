import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTasks } from "@/lib/queries";
import { KanbanSquare, Loader2, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { TaskColumn } from "@/lib/queries";

export const Route = createFileRoute("/app/$projectId/board")({
  component: BoardPage,
});

function BoardPage() {
  const { projectId } = Route.useParams();
  const { data: tasks } = useTasks(projectId);
  const qc = useQueryClient();
  const [newTask, setNewTask] = useState("");
  const [addingTo, setAddingTo] = useState<TaskColumn | null>(null);

  const columns: { name: TaskColumn; label: string }[] = [
    { name: "later", label: "Later" },
    { name: "this_week", label: "This Week" },
    { name: "in_progress", label: "In Progress" },
    { name: "done", label: "Done" },
  ];

  const tasksByCol = columns.reduce(
    (acc, col) => {
      acc[col.name] = tasks?.filter((t) => t.column_name === col.name) ?? [];
      return acc;
    },
    {} as Record<TaskColumn, typeof tasks>,
  );

  async function addTask(columnName: TaskColumn) {
    if (!newTask.trim()) return;
    try {
      const { error } = await supabase
        .from("tasks")
        .insert({ project_id: projectId, title: newTask.trim(), column_name: columnName });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      setNewTask("");
      setAddingTo(null);
      toast.success("Task added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add task");
    }
  }

  async function moveTask(taskId: string, newColumn: TaskColumn) {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ column_name: newColumn })
        .eq("id", taskId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't move task");
    }
  }

  async function deleteTask(taskId: string) {
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      toast.success("Task deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete task");
    }
  }

  return (
    <div className="px-6 lg:px-12 py-10 max-w-7xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <section className="bg-card rounded-3xl border border-border p-8 md:p-10 shadow-warm-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-terracotta-soft/40 rounded-bl-[120px] -mr-10 -mt-10 pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-12 rounded-xl bg-terracotta-soft text-terracotta flex items-center justify-center">
              <KanbanSquare className="size-6" />
            </div>
            <div>
              <h1 className="font-serif text-4xl md:text-5xl font-medium">Board</h1>
              <p className="text-sm text-muted-foreground font-mono uppercase tracking-widest mt-1">
                kanban task board
              </p>
            </div>
          </div>
          <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
            Organize your tasks across columns. Move them as you progress from ideas to completion.
          </p>
        </div>
      </section>

      {/* Board */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {columns.map((col) => (
          <div key={col.name} className="bg-card rounded-2xl border border-border p-4 shadow-warm-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                {col.label}
                <span className="ml-2 text-muted-foreground/50">
                  ({tasksByCol[col.name]?.length ?? 0})
                </span>
              </h2>
              <Button
                size="sm"
                variant="ghost"
                className="size-6 p-0"
                onClick={() => setAddingTo(col.name)}
              >
                <Plus className="size-4" />
              </Button>
            </div>

            {addingTo === col.name && (
              <div className="mb-3">
                <Input
                  placeholder="Task title..."
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addTask(col.name);
                    if (e.key === "Escape") setAddingTo(null);
                  }}
                  autoFocus
                  className="mb-2"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => addTask(col.name)} className="h-7 text-xs">
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setAddingTo(null)}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {tasksByCol[col.name]?.map((task) => (
                <div
                  key={task.id}
                  className="bg-background p-3 rounded-lg border border-border group hover:shadow-sm transition-shadow"
                >
                  <p className="text-sm font-medium mb-2">{task.title}</p>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {columns
                      .filter((c) => c.name !== col.name)
                      .map((targetCol) => (
                        <button
                          key={targetCol.name}
                          onClick={() => moveTask(task.id, targetCol.name)}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                        >
                          → {targetCol.label}
                        </button>
                      ))}
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-500"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
