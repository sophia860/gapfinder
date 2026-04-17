/**
 * Eval harness for the gap-validation pipeline.
 *
 * Two modes:
 *   1. SCHEMA mode (default, no network): loads scripts/eval-ideas.json and
 *      asserts that each entry parses against `GapReportSchema` and that
 *      `expected_verdict` is one of the allowed values. This is what runs in
 *      CI and what protects you against accidental schema drift between
 *      `src/lib/ai/gap-report.ts` and the JSON schema in the edge function.
 *
 *   2. LIVE mode (set GAPFRIEND_EVAL_LIVE=1 plus a project id and Supabase
 *      auth env): invokes the deployed `gapfriend-validate` edge function
 *      against each idea, collects the verdicts, and prints an accuracy
 *      table vs. the expected verdict. Use this whenever you change a
 *      prompt to make sure the rubric still classifies the calibration set
 *      the same way.
 *
 * Run with:
 *   bun run scripts/eval-gap-validate.ts
 *   GAPFRIEND_EVAL_LIVE=1 SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_USER_JWT=… \
 *     GAPFRIEND_EVAL_PROJECT=… bun run scripts/eval-gap-validate.ts
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GapReportSchema, VerdictSchema } from "../src/lib/ai/gap-report.ts";

interface EvalIdea {
  id: string;
  idea: string;
  expected_verdict: "build" | "kill" | "iterate";
  notes?: string;
}

const here = dirname(fileURLToPath(import.meta.url));
const ideas: EvalIdea[] = JSON.parse(readFileSync(join(here, "eval-ideas.json"), "utf8"));

function schemaCheck(): number {
  let failed = 0;
  for (const i of ideas) {
    const v = VerdictSchema.safeParse(i.expected_verdict);
    if (!v.success) {
      console.error(`✗ ${i.id}: invalid expected_verdict ${i.expected_verdict}`);
      failed++;
    }
    if (!i.idea || i.idea.length < 10) {
      console.error(`✗ ${i.id}: idea too short`);
      failed++;
    }
  }
  console.log(`schema check: ${ideas.length - failed}/${ideas.length} ok`);
  return failed;
}

async function liveCheck(): Promise<number> {
  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const jwt = process.env.SUPABASE_USER_JWT;
  const projectId = process.env.GAPFRIEND_EVAL_PROJECT;
  if (!url || !anon || !jwt || !projectId) {
    console.error(
      "live mode needs SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_USER_JWT, GAPFRIEND_EVAL_PROJECT",
    );
    return 1;
  }

  let correct = 0;
  let drift = 0;
  for (const i of ideas) {
    const resp = await fetch(`${url}/functions/v1/gapfriend-validate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        apikey: anon,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ projectId, idea: i.idea }),
    });
    const body = await resp.json().catch(() => null);
    if (!resp.ok || !body?.report) {
      console.error(`✗ ${i.id}: ${resp.status} ${JSON.stringify(body)}`);
      continue;
    }
    const report = body.report;
    const parse = GapReportSchema.safeParse({
      problem_clarity: report.problem_clarity,
      evidence_of_demand: report.evidence_of_demand,
      competitor_density: report.competitor_density,
      differentiation_angle: report.differentiation_angle,
      verdict: report.verdict,
      verdict_reasoning: report.verdict_reasoning,
      next_steps: report.next_steps,
      citations: report.citations ?? [],
    });
    if (!parse.success) {
      drift++;
      console.warn(`! ${i.id}: schema drift`, parse.error.flatten());
    }
    const ok = report.verdict === i.expected_verdict;
    if (ok) correct++;
    console.log(
      `${ok ? "✓" : "✗"} ${i.id.padEnd(28)} expected=${i.expected_verdict.padEnd(7)} got=${report.verdict}`,
    );
  }
  console.log(`\nlive accuracy: ${correct}/${ideas.length}; schema drift: ${drift}`);
  return ideas.length - correct;
}

const failed = schemaCheck();
let liveFailed = 0;
if (process.env.GAPFRIEND_EVAL_LIVE === "1") {
  liveFailed = await liveCheck();
}
process.exit(failed + liveFailed > 0 ? 1 : 0);
