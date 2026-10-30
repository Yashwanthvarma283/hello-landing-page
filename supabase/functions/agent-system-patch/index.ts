import { chatWithFeatureAI } from '../_shared/ai-pool.ts';
// Drafts a system-level patch *proposal* when the agent classifies an error as SYSTEM.
// CRITICAL: this function NEVER applies a patch. It writes a proposal row to
// `system_patch_proposals` for human admin review.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};


async function callAI(messages: any[], req?: Request): Promise<{ content: string; keyIndex: number }> {
  const r = await chatWithFeatureAI('agent-system-patch', { messages, req });
  return { content: r.content, keyIndex: 0 };
}

const SYSTEM_PROMPT = `You are a senior TypeScript / Deno engineer auditing an autonomous test agent for a Java DSA platform.

You will be given:
- An error classification (always SYSTEM)
- A short error summary
- Recent agent log entries

Your job: propose a SAFE, MINIMAL patch to one of these likely culprits:
  - src/lib/test-runner.ts          (browser-side Java test harness wrapper)
  - supabase/functions/agent-groq/index.ts        (AI code-gen edge function)
  - supabase/functions/agent-generate-tests/index.ts  (AI test-case generator)

Strict rules:
- Output a JSON object with exactly these keys: target_files (string[]), explanation (string, max 400 chars), diff (string).
- The diff MUST be in unified diff format (--- / +++ / @@ hunks). Use minimal hunks; do NOT include an entire file.
- Touch ONLY the files listed above. Never propose changes to package.json, lockfiles, schemas, or RLS.
- The patch must be defensive: add try/catch, null guards, fallbacks, retries — never weaken validation.
- If you cannot identify a confident root cause, return { "target_files": [], "explanation": "Insufficient signal to propose a safe patch.", "diff": "" }.
- NO markdown, NO commentary outside the JSON.`;

interface Body {
  problem_key?: string;
  error_type: string;
  error_summary: string;
  recent_logs?: Array<{ ts: number; level: string; message: string }>;
}

function extractJson(text: string): any | null {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(trimmed); } catch {}
  const m = trimmed.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json() as Body;
    if (!body.error_summary) {
      return new Response(JSON.stringify({ error: 'error_summary required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Identify the calling user (admin) via the forwarded auth header.
    const authHeader = req.headers.get('Authorization') ?? '';
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Resolve user id from JWT
    let proposedBy: string | null = null;
    if (authHeader.startsWith('Bearer ')) {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: authHeader, apikey: ANON_KEY },
      });
      if (userRes.ok) {
        const u = await userRes.json();
        proposedBy = u?.id ?? null;
      }
    }
    if (!proposedBy) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const logsBlock = (body.recent_logs ?? [])
      .map((l) => `[${l.level}] ${l.message}`)
      .join('\n')
      .slice(0, 2000);

    const userMsg = `Error type: ${body.error_type}
Error summary: ${body.error_summary}

Recent logs:
${logsBlock || '(none)'}

Return the JSON object now.`;

    let parsed: any = null;
    let keyIndex = 0;
    try {
      const { content, keyIndex: ki } = await callAI([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ], req);
      keyIndex = ki;
      parsed = extractJson(content);
    } catch (e) {
      // even if AI fails, still record a proposal so the admin sees the SYSTEM event
      parsed = { target_files: [], explanation: `AI draft failed: ${(e as Error).message}`, diff: '' };
    }
    if (!parsed) parsed = { target_files: [], explanation: 'AI returned malformed JSON.', diff: '' };

    // Insert proposal via service role (admin-only RLS verified above by JWT id)
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/system_patch_proposals`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        proposed_by: proposedBy,
        problem_key: body.problem_key ?? null,
        error_type: body.error_type,
        error_summary: body.error_summary,
        target_files: parsed.target_files ?? [],
        diff: parsed.diff ?? '',
        explanation: parsed.explanation ?? '',
        context_snippet: logsBlock,
        status: 'pending',
      }),
    });

    if (!insertRes.ok) {
      const t = await insertRes.text();
      throw new Error(`Failed to persist proposal: ${insertRes.status} ${t.slice(0, 200)}`);
    }
    const inserted = await insertRes.json();
    const proposalId = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;

    return new Response(JSON.stringify({ proposalId, keyUsed: keyIndex }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
