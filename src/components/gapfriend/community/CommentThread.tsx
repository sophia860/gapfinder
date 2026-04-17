import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useComments, useCreateComment, type CommentTarget } from "@/lib/queries";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  targetType: CommentTarget;
  targetId: string;
}

export function CommentThread({ targetType, targetId }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: comments, isLoading } = useComments({ type: targetType, id: targetId });
  const createComment = useCreateComment();
  const [body, setBody] = useState("");

  async function submit() {
    if (!user) {
      toast.error("Sign in to comment");
      navigate({ to: "/auth" });
      return;
    }
    const text = body.trim();
    if (!text) return;
    try {
      await createComment.mutateAsync({
        author_id: user.id,
        target_type: targetType,
        target_id: targetId,
        body: text,
      });
      setBody("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not post comment";
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4">
        <Textarea
          placeholder={user ? "Add a comment…" : "Sign in to join the conversation"}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={1000}
          className="resize-none"
        />
        <div className="flex justify-end mt-3">
          <Button onClick={submit} disabled={createComment.isPending || !body.trim()}>
            {createComment.isPending ? "Posting…" : "Comment"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
          Loading…
        </div>
      ) : (comments?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground italic">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments!.map((c) => (
            <li key={c.id} className="flex items-start gap-3">
              <div className="size-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium uppercase shrink-0">
                {c.author_id.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1 bg-card border border-border rounded-2xl p-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {new Date(c.created_at).toLocaleString()}
                </div>
                <p className="text-sm mt-1 whitespace-pre-wrap break-words">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
