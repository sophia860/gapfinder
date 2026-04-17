import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProject } from "@/lib/queries";
import { BookOpen, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
}

const STALE_MS = 1000 * 60 * 60 * 6; // 6 hours

/**
 * Sticky "where you left off" banner shown at the top of a project. Calls the
 * `gapfriend-resume` edge function to (re)generate the note when:
 *   - no resume_note exists yet, OR
 *   - the project has been updated since the last resume_note was written, OR
 *   - the resume_note is older than STALE_MS.
 *
 * Dismissed per session via sessionStorage so it doesn't keep popping up
 * during normal navigation.
 */
export function ResumeBanner({ projectId }: Props) {
  const { data: project } = useProject(projectId);
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(`resume-dismissed:${projectId}`) === "1";
  });

  // Reset the dismissed flag whenever we navigate to a different project.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.sessionStorage.getItem(`resume-dismissed:${projectId}`) === "1");
  }, [projectId]);

  async function generate(opts: { silent: boolean }) {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-resume", {
        body: { projectId },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) {
        throw new Error((data as { error: string }).error);
      }
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    } catch (err) {
      // Silent on the first auto-attempt — the banner just won't appear.
      // On explicit refresh, surface the error so the user knows it failed.
      if (!opts.silent) {
        toast.error(err instanceof Error ? err.message : "Couldn't refresh the note");
      }
    } finally {
      setGenerating(false);
    }
  }

  // Auto-generate on entry when stale, but never spam the AI gateway: at most
  // one attempt per project per session.
  useEffect(() => {
    if (!project || dismissed) return;
    if (typeof window === "undefined") return;
    const tried = window.sessionStorage.getItem(`resume-tried:${projectId}`) === "1";
    if (tried) return;

    const noteAt = project.resume_note_updated_at
      ? new Date(project.resume_note_updated_at).getTime()
      : 0;
    const updatedAt = new Date(project.updated_at).getTime();
    const noNote = !project.resume_note;
    const staleByTime = noteAt > 0 && Date.now() - noteAt > STALE_MS;
    const staleByActivity = noteAt > 0 && updatedAt > noteAt;

    if (noNote || staleByTime || staleByActivity) {
      window.sessionStorage.setItem(`resume-tried:${projectId}`, "1");
      void generate({ silent: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.updated_at, project?.resume_note_updated_at, dismissed]);

  function dismiss() {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(`resume-dismissed:${projectId}`, "1");
    }
    setDismissed(true);
  }

  if (dismissed) return null;
  if (!project?.resume_note) return null;

  return (
    <div className="border-b border-border bg-sage/5">
      <div className="px-4 lg:px-6 py-3 flex items-start gap-3">
        <div className="size-7 rounded-md bg-sage/15 text-sage flex items-center justify-center shrink-0 mt-0.5">
          <BookOpen className="size-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-mono uppercase tracking-widest text-sage">
            Where you left off
          </p>
          <p className="mt-0.5 text-sm text-foreground/90 whitespace-pre-line">
            {project.resume_note}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => generate({ silent: false })}
            disabled={generating}
            aria-label="Refresh resume note"
            className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-sage/10 transition-colors flex items-center justify-center disabled:opacity-50"
          >
            <RefreshCw className={`size-3.5 ${generating ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-sage/10 transition-colors flex items-center justify-center"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
