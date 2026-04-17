import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "@tanstack/react-router";
import { useChatMessages } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Sparkles, Loader2, X, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  projectId: string;
  projectName: string;
}

const STORAGE_KEY = "gapfriend.copilot.open";

/** Suggest 2-3 quick actions based on the current route. */
function quickPromptsFor(path: string): { label: string; prompt: string }[] {
  if (path.endsWith("/gaps")) {
    return [
      {
        label: "Suggest 5 gaps",
        prompt: "Suggest 5 specific market gaps for me based on my profile. Use add_gap_cards.",
      },
      {
        label: "Why these?",
        prompt: "Explain why the gaps you suggested fit my skills and constraints.",
      },
    ];
  }
  if (path.endsWith("/brief")) {
    return [
      {
        label: "Draft brief",
        prompt:
          "Turn the selected gap into a tight opportunity brief (persona, problem, angle, business_model). Use save_opportunity_brief.",
      },
      { label: "Sharpen angle", prompt: "The angle in my brief is too generic. Sharpen it." },
    ];
  }
  if (path.endsWith("/identity")) {
    return [
      {
        label: "Name it",
        prompt:
          "Suggest 5 names, 5 domain options, a tagline, and a positioning sentence. Use save_identity.",
      },
      {
        label: "Refine identity",
        prompt:
          "Refine my identity (name + tagline + positioning) to feel more honest and specific.",
      },
    ];
  }
  if (path.endsWith("/board") || path.endsWith("/roadmap")) {
    return [
      {
        label: "Plan my week",
        prompt:
          "Add 3 concrete tasks for THIS WEEK based on everything we know. Use add_tasks with column_name=this_week.",
      },
      { label: "What's next?", prompt: "What's the single next thing I should do today?" },
    ];
  }
  if (path.endsWith("/money")) {
    return [
      {
        label: "Suggest math",
        prompt:
          "Propose realistic money settings — currency, monthly income_target, price_per_unit, hours_per_week, and 3 scenarios. Use save_money.",
      },
    ];
  }
  if (path.endsWith("/channels")) {
    return [
      {
        label: "Suggest channels",
        prompt:
          "Recommend 3 channels for me to be visible on, with rationale, pros, cons, guide. Use save_channels.",
      },
    ];
  }
  return [
    {
      label: "What now?",
      prompt:
        "Look at my project and tell me the single most useful next step. Don't ask questions — pick one and explain.",
    },
    {
      label: "Find a gap",
      prompt: "Suggest 5 specific market gaps for me based on my profile. Use add_gap_cards.",
    },
  ];
}

export function CopilotBubble({ projectId, projectName }: Props) {
  const [open, setOpen] = useState(false);
  const { data: messages } = useChatMessages(projectId);
  const qc = useQueryClient();
  const location = useLocation();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist open state
  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "1") setOpen(true);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages?.length, sending, open]);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setSending(true);
    setInput("");
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
        body: { projectId, message: text, context: { route: location.pathname } },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  const hasMessages = (messages?.length ?? 0) > 0;
  const prompts = quickPromptsFor(location.pathname);
  const unread = !open && hasMessages ? Math.min(messages!.length, 9) : 0;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-50 size-14 rounded-full bg-terracotta text-primary-foreground shadow-warm-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center group"
        aria-label="Open GapFriend"
      >
        <Sparkles className="size-6" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 size-5 rounded-full bg-sage text-white text-[10px] font-mono font-bold flex items-center justify-center border-2 border-background">
            {unread}
          </span>
        )}
        <span className="absolute right-full mr-3 px-2.5 py-1 rounded-md bg-foreground text-background text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Ask GapFriend
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[380px] max-w-[calc(100vw-2.5rem)] h-[600px] max-h-[calc(100vh-2.5rem)] bg-card border border-border rounded-2xl shadow-warm-lg flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3 shrink-0 bg-card">
        <div className="size-9 rounded-full bg-terracotta-soft flex items-center justify-center">
          <Sparkles className="size-4 text-terracotta" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-serif font-medium text-sm leading-tight">GapFriend</h2>
          <p className="text-[11px] text-muted-foreground truncate">on {projectName}</p>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="size-8 rounded-full hover:bg-secondary transition-colors flex items-center justify-center text-muted-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasMessages && (
          <div className="bg-muted/60 rounded-2xl rounded-tl-sm p-3.5 text-sm leading-relaxed">
            Hey — I'm GapFriend. I can see what you're looking at and act on it. Pick a quick action
            below or ask me anything.
          </div>
        )}
        {messages?.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-auto max-w-[85%] bg-terracotta text-primary-foreground rounded-2xl rounded-tr-sm p-3 text-sm leading-relaxed whitespace-pre-wrap"
                : "max-w-[90%] bg-muted/60 rounded-2xl rounded-tl-sm p-3.5 text-sm leading-relaxed whitespace-pre-wrap"
            }
          >
            {m.content}
          </div>
        ))}
        {sending && (
          <div className="max-w-[90%] bg-muted/60 rounded-2xl rounded-tl-sm p-3.5 text-sm flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Thinking…
          </div>
        )}
      </div>

      {/* Quick actions + composer */}
      <div className="p-3 border-t border-border shrink-0 space-y-2.5 bg-card">
        <div className="flex flex-wrap gap-1.5">
          {prompts.map((p) => (
            <button
              key={p.label}
              onClick={() => send(p.prompt)}
              disabled={sending}
              className="text-[11px] px-2.5 py-1 rounded-full border border-terracotta/30 text-terracotta bg-background hover:bg-terracotta-soft transition-colors disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask GapFriend…"
            disabled={sending}
            className="w-full bg-muted/40 border border-border rounded-full pl-4 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta/40 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="absolute right-1 top-1/2 -translate-y-1/2 size-7 rounded-full bg-terracotta text-primary-foreground flex items-center justify-center hover:bg-terracotta/90 transition-colors disabled:opacity-40"
          >
            {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3" />}
          </button>
        </form>
      </div>
    </div>
  );
}
