import { z } from "zod";

/**
 * Structured "gap report" returned by the gapfriend-validate edge function.
 *
 * The shape here is the source of truth: it is mirrored as a JSON Schema in
 * `supabase/functions/gapfriend-validate/index.ts` (used as the LLM tool
 * parameters to enforce structured output) and is stored, column-per-section,
 * in `public.gap_reports`. Keep them in sync.
 */

export const ScoreSchema = z.object({
  score: z.number().int().min(1).max(5),
  reasoning: z.string().min(1).max(800),
});
export type Score = z.infer<typeof ScoreSchema>;

export const EvidenceOfDemandSchema = ScoreSchema.extend({
  signals: z.array(z.string().min(1).max(300)).max(8).default([]),
});
export type EvidenceOfDemand = z.infer<typeof EvidenceOfDemandSchema>;

export const CompetitorDensitySchema = ScoreSchema.extend({
  examples: z.array(z.string().min(1).max(200)).max(8).default([]),
});
export type CompetitorDensity = z.infer<typeof CompetitorDensitySchema>;

export const VerdictSchema = z.enum(["build", "kill", "iterate"]);
export type Verdict = z.infer<typeof VerdictSchema>;

export const CitationSchema = z.object({
  source: z.string().min(1).max(40), // e.g. 'reddit', 'hackernews'
  url: z.string().url(),
  snippet: z.string().min(1).max(600),
});
export type Citation = z.infer<typeof CitationSchema>;

export const GapReportSchema = z.object({
  problem_clarity: ScoreSchema,
  evidence_of_demand: EvidenceOfDemandSchema,
  competitor_density: CompetitorDensitySchema,
  differentiation_angle: ScoreSchema,
  verdict: VerdictSchema,
  verdict_reasoning: z.string().min(20).max(1000),
  next_steps: z.array(z.string().min(3).max(200)).length(3),
  citations: z.array(CitationSchema).max(20).default([]),
});
export type GapReport = z.infer<typeof GapReportSchema>;
