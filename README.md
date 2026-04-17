# GapFriend

An AI co-pilot for solo founders, freelancers, and small teams: find market gaps, kill bad ideas early, and turn good ones into a tiny business.

Stack: TanStack Start (React 19) + Supabase (Postgres + Edge Functions + Auth) + Lovable AI Gateway, deployed to Cloudflare Workers via the `@cloudflare/vite-plugin`.

## Local development

```bash
npm install
npm run dev      # vite dev server
npm run build    # production build
npm run lint     # eslint + prettier
```

## AI gap-validation pipeline

The `Validate this idea` panel in the project dashboard calls the
`gapfriend-validate` Supabase Edge Function, which returns a structured
[`GapReport`](src/lib/ai/gap-report.ts) (problem clarity, evidence of demand,
competitor density, differentiation angle, kill/iterate/build verdict, three
concrete next steps, and citations). Reports are persisted in
`public.gap_reports` for auditability.

The pipeline lives in three places that **must stay in sync** (Deno cannot
import across the Vite `@/` alias, so the schema and prompt are mirrored):

| Concern                     | Source of truth                                  |
| --------------------------- | ------------------------------------------------ |
| TypeScript / Zod schema     | `src/lib/ai/gap-report.ts`                       |
| Prompt + rubric + few-shots | `src/lib/ai/prompts.ts`                          |
| Mirror used by the model    | `supabase/functions/gapfriend-validate/index.ts` |

### Optional v2: RAG (retrieval-augmented evidence)

The `Pull web signals first` button calls `gapfriend-ingest-evidence`, which
fetches a small batch of public-web signals from Reddit
(`https://www.reddit.com/search.json`) and Hacker News Algolia
(`https://hn.algolia.com/api/v1/search`), embeds them with
`openai/text-embedding-3-small`, and stores them in
`public.evidence_snippets` (a `pgvector(1536)` column). The next call to
`gapfriend-validate` runs a top-k cosine search via the `match_evidence`
RPC and feeds the matching snippets into the prompt as grounded evidence —
the model is then instructed to cite the snippets it actually used.

> Google Trends has no free official API, so we substituted Hacker News here.
> If you want Trends data, plug in SerpAPI in `fetchSources` inside
> `supabase/functions/gapfriend-ingest-evidence/index.ts`.

## Environment variables

Client-side (Vite-exposed; safe to commit):

| Variable                        | Where  |
| ------------------------------- | ------ |
| `VITE_SUPABASE_URL`             | `.env` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` |
| `VITE_SUPABASE_PROJECT_ID`      | `.env` |

Server-only (Edge Functions; **must NOT** be `VITE_`-prefixed and must NOT
be committed). For deployed Supabase, set them with
`supabase secrets set`; for `supabase functions serve` locally, put them in
`supabase/.env` (gitignored):

| Variable                                            | Used by                     | Purpose                                              |
| --------------------------------------------------- | --------------------------- | ---------------------------------------------------- |
| `LOVABLE_API_KEY`                                   | All `gapfriend-*` functions | Bearer token for `https://ai.gateway.lovable.dev/v1` |
| `SUPABASE_URL`                                      | All `gapfriend-*` functions | Auto-injected by Supabase in production              |
| `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`) | All `gapfriend-*` functions | Auto-injected by Supabase in production              |

```bash
# Set the AI key on the deployed project
supabase secrets set LOVABLE_API_KEY=sk-…

# Or, for local function dev
echo 'LOVABLE_API_KEY=sk-…' >> supabase/.env
supabase functions serve gapfriend-validate
```

The browser **never** sees `LOVABLE_API_KEY`; all model calls happen inside
the Edge Function and only the structured report is returned to the client.

## Cost & rate limiting

Per-user and per-project limits are enforced inside `gapfriend-validate` and
backed by the `public.ai_usage` ledger:

- **Per-user:** 20 AI requests / sliding hour (hard cap, 429 on overflow).
- **Per-project:** soft lifetime token cap of 500,000 tokens (402 when hit).
- Every call writes a row to `ai_usage` with `prompt_tokens`,
  `completion_tokens`, `total_tokens`, and the function name, so you can
  query usage per user, per project, or per day.
- Every report's `raw_request` and `raw_response` are stored in
  `gap_reports` so prompts can be audited and replayed for evals.

## Eval harness

`scripts/eval-ideas.json` is a calibration set of 15 ideas with expected
verdicts (`build` / `kill` / `iterate`). `scripts/eval-gap-validate.ts`
runs in two modes:

```bash
# Schema-only (default; no network). Catches drift between the Zod schema
# in src/lib/ai/gap-report.ts and the JSON schema in the edge function.
bun run scripts/eval-gap-validate.ts

# Live mode: invokes the deployed gapfriend-validate function for each
# idea and prints per-idea verdict accuracy.
GAPFRIEND_EVAL_LIVE=1 \
  SUPABASE_URL=… SUPABASE_ANON_KEY=… SUPABASE_USER_JWT=… \
  GAPFRIEND_EVAL_PROJECT=<uuid> \
  bun run scripts/eval-gap-validate.ts
```

Run live mode whenever you change a prompt to make sure the rubric still
classifies the calibration set the same way.
