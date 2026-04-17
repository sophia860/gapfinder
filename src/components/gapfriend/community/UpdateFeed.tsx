import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useCampaignPosts, useCreatePost, type Campaign } from "@/lib/queries";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ReactionBar } from "./ReactionBar";

interface Props {
  campaign: Campaign;
}

export function UpdateFeed({ campaign }: Props) {
  const { user } = useAuth();
  const { data: posts, isLoading } = useCampaignPosts(campaign.id);
  const createPost = useCreatePost();
  const [body, setBody] = useState("");

  const isOwner = user?.id === campaign.created_by;

  async function submit() {
    if (!user || !isOwner) return;
    const text = body.trim();
    if (!text) return;
    try {
      await createPost.mutateAsync({
        author_id: user.id,
        campaign_id: campaign.id,
        body: text,
      });
      setBody("");
      toast.success("Update posted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not post update";
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-6">
      {isOwner && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <Textarea
            placeholder="Share an update with your backers…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={2000}
            className="resize-none"
          />
          <div className="flex justify-end mt-3">
            <Button onClick={submit} disabled={createPost.isPending || !body.trim()}>
              {createPost.isPending ? "Posting…" : "Post update"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
          Loading…
        </div>
      ) : (posts?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground italic">No updates yet.</p>
      ) : (
        <ul className="space-y-4">
          {posts!.map((p) => (
            <li key={p.id} className="bg-card border border-border rounded-2xl p-5">
              <p className="text-sm whitespace-pre-wrap break-words">{p.body}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  {new Date(p.created_at).toLocaleString()}
                </span>
                <ReactionBar targetType="post" targetId={p.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
