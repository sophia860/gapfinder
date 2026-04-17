import { useEffect, useRef, useState, type FormEvent } from "react";
import { useChatMessages } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  projectName: string;
}

export function ChatPanel({ projectId, projectName }: Props) {
  const { data: messages } = useChatMessages(projectId);
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages?.length, sending]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    // Optimistic user bubble
    qc.setQueryData(["chat", projectId], (old: unknown) => {
      const list = (old as Array<Record<string, unknown>>) ?? [];
      return [
        ...list,
        {
          id: `tmp-${Date.now()}`,
          project_id: projectId,
          role: "user",
          content: text,
          created_at: new Date().toISOString(),
        },
      ];
    });

    try {
      const { data, error } = await supabase.functions.invoke("gapfriend-chat", {
        body: { projectId, message: text },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);

      // Refetch chat + any tables the assistant might have touched
      qc.invalidateQueries({ queryKey: ["chat", projectId] });
      qc.invalidateQueries({ queryKey: ["brief", projectId] });
      qc.invalidateQueries({ queryKey: ["gaps", projectId] });
      qc.invalidateQueries({ queryKey: ["identity", projectId] });
      qc.invalidateQueries({ queryKey: ["channels", projectId] });
      qc.invalidateQueries({ queryKey: ["money", projectId] });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    } catch (err) {
      qc.invalidateQueries({ queryKey: ["chat", projectId] });
      toast.error(err instanceof Error ? err.message : "Couldn't reach GapFriend");
    } finally {
      setSending(false);
    }
  }

  const hasMessages = (messages?.length ?? 0) > 0;

  return (
    <>
      <div className="p-6 border-b border-border flex items-center gap-3 shrink-0">
        <div className="size-10 rounded-full bg-terracotta-soft flex items-center justify-center">
          <Sparkles className="size-4 text-terracotta" />
        </div>
        <div className="min-w-0">
          <h2 className="font-serif font-medium text-base leading-tight">GapFriend</h2>
          <p className="text-xs text-muted-foreground truncate">on {projectName}</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-5">
        {!hasMessages && (
          <div className="bg-muted/60 rounded-2xl rounded-tl-sm p-4 text-sm leading-relaxed">
            Hey — I'm GapFriend, your honest co-pilot. I can help you find a gap, pressure-test
            ideas with synthetic customers, name your thing, work out the money, and turn advice
            into tasks.
            <br />
            <br />
            What do you want to look at first?
          </div>
        )}
        {messages?.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] bg-terracotta text-primary-foreground rounded-2xl rounded-tr-sm p-3.5 text-sm leading-relaxed whitespace-pre-wrap"
                : "max-w-[90%] bg-muted/60 rounded-2xl rounded-tl-sm p-4 text-sm leading-relaxed whitespace-pre-wrap"
            }
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div className="max-w-[90%] bg-muted/60 rounded-2xl rounded-tl-sm p-4 text-sm flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border shrink-0 space-y-3">
        <div className="flex flex-wrap gap-2">
          {[
            "Suggest 3 market gaps for me",
            "Help me write an opportunity brief",
            "What should I do this week?",
          ].map((q) => (
            <button
              key={q}
              onClick={() => setInput(q)}
              disabled={sending}
              className="text-xs px-3 py-1.5 rounded-full border border-terracotta/30 text-terracotta bg-background hover:bg-terracotta-soft transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
        <form onSubmit={send} className="relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask GapFriend anything…"
            disabled={sending}
            className="w-full bg-muted/40 border border-border rounded-full pl-4 pr-11 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/40 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 size-8 rounded-full bg-terracotta text-primary-foreground flex items-center justify-center hover:bg-terracotta/90 transition-colors disabled:opacity-40"
          >
            {sending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </button>
        </form>
      </div>
    </>
  );
}
