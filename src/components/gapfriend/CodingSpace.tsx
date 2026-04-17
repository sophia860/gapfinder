import { Code2 } from "lucide-react";

interface Props {
  projectId: string;
}

export function CodingSpace({ projectId: _projectId }: Props) {
  return (
    <div className="px-6 lg:px-12 py-16 max-w-3xl mx-auto">
      <div className="bg-card rounded-3xl border border-border p-10 shadow-warm-sm text-center">
        <div className="size-12 rounded-2xl bg-terracotta-soft text-terracotta flex items-center justify-center mx-auto">
          <Code2 className="size-5" />
        </div>
        <h1 className="font-serif text-3xl font-medium mt-5">Coding space — coming soon</h1>
        <p className="text-muted-foreground mt-3">
          A full editor for your generated site lives here. Stay tuned.
        </p>
      </div>
    </div>
  );
}
