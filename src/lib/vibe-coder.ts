// Vibe Coder — shared types and client-side helpers
// The actual graph runs in the Edge Function; this file owns the type contract
// and any client utilities (query keys, formatters, etc.)

// ─── Types ────────────────────────────────────────────────────────────────────

export type EnergyMode = "calm" | "creative" | "execution";

export interface VibeProfile {
  energy: EnergyMode;
  /** Tailwind-compatible hex palette e.g. ["#e8d5c0", "#c2410f"] */
  colors: string[];
  /** Font stack preferences e.g. ["serif", "monospace"] */
  fonts: string[];
  /** Short adjectives that define the brand voice */
  tone_keywords: string[];
  /** Previously generated patterns to reinforce consistency */
  past_patterns: string[];
}

export interface CodingSession {
  id: string;
  project_id: string;
  checkpoint_id: string;
  session_vibe_snapshot: {
    vibeProfile: VibeProfile;
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  };
  created_at: string;
}

export interface ProjectVibe {
  id: string;
  project_id: string;
  vibe_profile: VibeProfile;
  updated_at: string;
}

export interface VibeCoderRequest {
  projectId: string;
  prompt: string;
  checkpointId: string | null;
  vibeProfile: VibeProfile;
}

export interface VibeCoderResponse {
  code: string;
  newCheckpointId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const DEFAULT_VIBE_PROFILE: VibeProfile = {
  energy: "calm",
  colors: ["#e8d5c0", "#c2410f", "#3f2a1e", "#f8f1e3"],
  fonts: ["serif", "monospace"],
  tone_keywords: ["warm", "editorial", "minimal", "sustainable"],
  past_patterns: [],
};

export const ENERGY_LABELS: Record<EnergyMode, { label: string; desc: string }> = {
  calm: { label: "Calm & Sustainable", desc: "Steady, considered, zero noise" },
  creative: { label: "Creative Flow", desc: "Generative, exploratory, warm" },
  execution: { label: "Quiet Execution", desc: "Sharp, decisive, minimal" },
};

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const vibeQueryKeys = {
  vibeProfile: (projectId: string) => ["project_vibes", projectId] as const,
  lastSession: (projectId: string) => ["coding_sessions_last", projectId] as const,
  allSessions: (projectId: string) => ["coding_sessions", projectId] as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extracts the last assistant message from a session snapshot */
export function getLastGeneratedCode(snapshot: CodingSession["session_vibe_snapshot"]): string | null {
  const last = snapshot?.messages?.filter((m) => m.role === "assistant").at(-1);
  return last?.content ?? null;
}

/** Formats a checkpoint ID for display */
export function formatCheckpointId(id: string): string {
  const parts = id.split("-");
  return parts.length >= 3 ? `session #${parts.slice(-1)[0].slice(0, 6)}` : id.slice(0, 12);
}
