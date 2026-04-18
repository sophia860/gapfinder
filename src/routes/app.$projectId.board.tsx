import { createFileRoute } from "@tanstack/react-router";
import {
  useTasks,
  useUpdateTask,
  useCreateTask,
  useDeleteTask,
  type TaskColumn,
} from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KanbanSquare, Plus, Trash2, ArrowRight, ArrowLeft } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/app/$projectId/board")({
  component: BoardPage,
});

const COLUMNS: { key: TaskColumn; label: string }[] = [
  { key: "later", label: "Later" },
  { key: "this_week", label: "This week" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

function BoardPage() {
  const { projectId } = Route.useParams();
  const { data: tasks } = useTasks(projectId);
  const updateTask = useUpdateTask();
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();
  const [newTitle, setNewTitle] = useState("");

  function move(id: string, column_name: TaskColumn) {
    updateTask.mutate({ id, column_name });
  }

  function nextCol(c: TaskColumn): TaskColumn | null {
    const i = COLUMNS.findIndex((x) => x.key === c);
    return i < COLUMNS.length - 1 ? COLUMNS[i + 1].key : null;
  }
  function prevCol(c: TaskColumn): TaskColumn | null {
    const i = COLUMNS.findIndex((x) => x.key === c);
    return i > 0 ? COLUMNS[i - 1].key : null;
  }

  return (
    <div className="px-6 lg:px-12 py-10 max-w-7xl mx-auto space-y-6 pb-20">
      <header>
        <p className="text-[10px] uppercase tracking-widest font-mono text-terracotta">Execute</p>
        <h1 className="font-serif text-4xl font-medium mt-1">Board</h1>
        <p className="text-muted-foreground mt-2 max-w-xl">
          Move things forward, one column at a time.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newTitle.trim()) return;
          createTask.mutate(
            { project_id: projectId, title: newTitle.trim(), column_name: "this_week" },
            { onSuccess: () => setNewTitle("") },
          );
        }}
        className="flex gap-2"
      >
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Add a task to This week…"
          className="rounded-full"
        />
        <Button type="submit" className="rounded-full" disabled={!newTitle.trim()}>
          <Plus className="size-4 mr-1" /> Add
        </Button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const items = tasks?.filter((t) => t.column_name === col.key) ?? [];
          return (
            <div
              key={col.key}
              className="bg-card rounded-2xl border border-border p-4 min-h-[200px]"
            >
              <div className="flex items-center gap-2 mb-3">
                <KanbanSquare className="size-3.5 text-muted-foreground" />
                <h2 className="text-[11px] uppercase tracking-widest font-mono">{col.label}</h2>
                <span className="ml-auto text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Empty</p>
                )}
                {items.map((t) => {
                  const next = nextCol(t.column_name);
                  const prev = prevCol(t.column_name);
                  return (
                    <div
                      key={t.id}
                      className="bg-background p-3 rounded-lg border border-border/50 text-sm"
                    >
                      <div className="font-medium">{t.title}</div>
                      {t.notes && (
                        <div className="text-xs text-muted-foreground mt-1">{t.notes}</div>
                      )}
                      <div className="flex gap-1 mt-2">
                        {prev && (
                          <button
                            onClick={() => move(t.id, prev)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground"
                            title={`Move to ${prev}`}
                          >
                            <ArrowLeft className="size-3" />
                          </button>
                        )}
                        {next && (
                          <button
                            onClick={() => move(t.id, next)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground"
                            title={`Move to ${next}`}
                          >
                            <ArrowRight className="size-3" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteTask.mutate({ id: t.id, project_id: projectId })}
                          className="ml-auto p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                          title="Delete"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
