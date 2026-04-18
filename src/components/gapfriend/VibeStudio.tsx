import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wand2, RotateCcw, Copy, CheckCheck, Zap, Feather, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface Props {
  projectId: string;
}

type EnergyMode = "calm" | "creative" | "execution";

interface VibeProfile {
  energy: EnergyMode;
  colors: string[];
  fonts: string[];
  tone_keywords: string[];
  past_patterns: string[];
}

const ENERGY_OPTIONS: { value: EnergyMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "calm", label: "Calm & Sustainable", icon: <Feather className="size-4" />, desc: "Steady, considered, zero noise" },
  { value: "creative", label: "Creative Flow", icon: <Wand2 className="size-4" />, desc: "Generative, exploratory, warm" },
  { value: "execution", label: "Quiet Execution", icon: <Target className="size-4" />, desc: "Sharp, decisive, minimal" },
];

const ENERGY_MODES: EnergyMode[] = ["calm", "creative", "execution"];

function isVibeProfile(value: unknown): value is VibeProfile {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    ENERGY_MODES.includes(v.energy as EnergyMode) &&
    Array.isArray(v.colors) &&
    Array.isArray(v.fonts) &&
    Array.isArray(v.tone_keywords) &&
    Array.isArray(v.past_patterns)
  );
}

const DEFAULT_VIBE: VibeProfile = {
  energy: "calm",
  colors: ["#e8d5c0", "#c2410f", "#3f2a1e", "#f8f1e3"],
  fonts: ["serif", "monospace"],
  tone_keywords: ["warm", "editorial", "minimal", "sustainable"],
  past_patterns: [],
};

async function invokeVibeCoder(payload: {
  projectId: string;
  prompt: string;
  checkpointId: string | null;
  vibeProfile: VibeProfile;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vibe-coder`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ code: string; newCheckpointId: string }>;
}

export function VibeStudio({ projectId }: Props) {
  const [prompt, setPrompt] = useState("");
  const [code, setCode] = useState("// Your vibe-generated code will appear here.\n// Set your energy mode, write a prompt, and click Generate.");
  const [vibe, setVibe] = useState<VibeProfile>(DEFAULT_VIBE);
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);

  // Load existing vibe profile for this project
  useQuery({
    queryKey: ["project_vibes", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_vibes")
        .select("vibe_profile, updated_at")
        .eq("project_id", projectId)
        .maybeSingle();
      if (isVibeProfile(data?.vibe_profile)) {
        setVibe(data.vibe_profile);
      }
      return data;
    },
    enabled: !!projectId,
  });

  // Load last coding session checkpoint
  useQuery({
    queryKey: ["coding_sessions_last", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("coding_sessions")
        .select("checkpoint_id, session_vibe_snapshot, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.checkpoint_id) {
        setCheckpointId(data.checkpoint_id);
        const snap = data.session_vibe_snapshot as { messages?: { role: string; content: string }[] };
        const lastAssistant = snap?.messages?.filter((m) => m.role === "assistant").at(-1);
        if (lastAssistant?.content) setCode(lastAssistant.content);
      }
      return data;
    },
    enabled: !!projectId,
  });

  const mutation = useMutation({
    mutationFn: invokeVibeCoder,
    onSuccess: (result) => {
      setCode(result.code);
      setCheckpointId(result.newCheckpointId);
      toast({ title: "Code generated", description: "Your vibe-aligned code is ready." });
    },
    onError: (err: Error) => {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    mutation.mutate({ projectId, prompt, checkpointId, vibeProfile: vibe });
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setCheckpointId(null);
    setCode("// Session reset. Start a fresh generation.");
    toast({ title: "Session cleared", description: "Starting a new vibe thread." });
  };

  return (
    <div className="min-h-full bg-[#f8f1e3] font-serif text-[#3f2a1e]">
      <div className="max-w-screen-xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-medium tracking-tight">Vibe Coding Studio</h1>
            <p className="text-[#c2410f] mt-1 text-sm">Calm, sustainable code that mirrors your founder energy.</p>
          </div>
          {checkpointId && (
            <Badge variant="outline" className="text-xs border-[#e8d5c0] text-[#9c6b4e] font-mono">
              resumed session
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Vibe Controls */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl border border-[#e8d5c0] p-5 shadow-sm">
              <h2 className="text-xs uppercase tracking-widest text-[#9c6b4e] mb-4">Energy Mode</h2>
              <div className="space-y-2">
                {ENERGY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setVibe({ ...vibe, energy: opt.value })}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all ${
                      vibe.energy === opt.value
                        ? "bg-[#c2410f] text-white"
                        : "bg-[#f8f1e3] text-[#3f2a1e] hover:bg-[#e8d5c0]"
                    }`}
                  >
                    {opt.icon}
                    <div>
                      <div className="font-medium">{opt.label}</div>
                      <div className={`text-xs mt-0.5 ${vibe.energy === opt.value ? "text-orange-100" : "text-[#9c6b4e]"}`}>
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt */}
            <div className="bg-white rounded-2xl border border-[#e8d5c0] p-5 shadow-sm">
              <h2 className="text-xs uppercase tracking-widest text-[#9c6b4e] mb-3">Prompt</h2>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe what to build... e.g. 'A hero section with warm serif heading and terracotta CTA button'"
                className="min-h-[120px] bg-[#f8f1e3] border-[#e8d5c0] font-sans text-sm resize-none rounded-xl focus-visible:ring-[#c2410f]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
                }}
              />
              <p className="text-xs text-[#9c6b4e] mt-2">⌘+Enter to generate</p>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={mutation.isPending || !prompt.trim()}
              className="w-full bg-[#c2410f] hover:bg-[#9c2f0d] text-white rounded-2xl py-6 text-sm tracking-widest font-sans transition-colors"
            >
              {mutation.isPending ? (
                <span className="flex items-center gap-2"><Zap className="size-4 animate-pulse" /> Generating...</span>
              ) : (
                <span className="flex items-center gap-2"><Wand2 className="size-4" /> GENERATE WITH VIBE</span>
              )}
            </Button>
          </div>

          {/* Code Output */}
          <div className="col-span-12 lg:col-span-8">
            <div className="bg-white rounded-2xl border border-[#e8d5c0] shadow-sm overflow-hidden h-full flex flex-col">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#e8d5c0] bg-[#faf7f2]">
                <span className="text-xs font-mono text-[#9c6b4e] uppercase tracking-widest">Output</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    className="flex items-center gap-1.5 text-xs text-[#9c6b4e] hover:text-[#c2410f] transition-colors px-2 py-1 rounded-lg hover:bg-[#f8f1e3]"
                  >
                    <RotateCcw className="size-3" /> New session
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-xs text-[#9c6b4e] hover:text-[#c2410f] transition-colors px-2 py-1 rounded-lg hover:bg-[#f8f1e3]"
                  >
                    {copied ? <CheckCheck className="size-3 text-green-600" /> : <Copy className="size-3" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <pre
                ref={codeRef}
                className="flex-1 p-5 text-sm font-mono text-[#3f2a1e] overflow-auto whitespace-pre-wrap leading-relaxed min-h-[500px]"
                style={{ background: "#fff" }}
              >
                {mutation.isPending ? (
                  <span className="text-[#c2410f] animate-pulse">
                    // Generating vibe-aligned code...{"\n"}// Energy: {vibe.energy}
                  </span>
                ) : (
                  code
                )}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
