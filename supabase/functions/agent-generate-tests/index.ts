import { chatWithFeatureAI } from '../_shared/ai-pool.ts';
// Generates problem metadata + test cases for a single problem and caches into problem_test_cases.
// Used by the agent dashboard to backfill tests for problems that don't yet have them.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};


async function callAI(messages: any[], req?: Request): Promise<string> {
  const r = await chatWithFeatureAI('agent-generate-tests', { messages, req });
  return r.content;
}

const SYSTEM = `You generate test metadata for a Java DSA coding problem. Output ONLY a single JSON object with this exact shape:

{
  "function_name": "string",
  "return_type": "Java type, e.g. int, int[], boolean, String, ListNode, TreeNode, List<Integer>, void",
  "params": [ { "name": "string", "type": "Java type" } ],
  "starter_code": "complete Java starter Solution class with the empty method (return default value)",
  "test_cases": [ { "inputs": { "<paramName>": "JSON-string value" }, "expected": "expected stdout text" } ],
  "examples": [ { "input": "human-readable", "output": "human-readable", "explanation": "optional" } ],
  "description": "one-paragraph problem description",
  "constraints": ["string", ...],
  "hints": ["string", ...]
}

Rules:
- Provide 4-6 diverse test_cases including edge cases.
- inputs values must be JSON-encoded strings: arrays as "[1,2,3]", strings as "\\"hello\\"", numbers as "5", booleans as "true". Each value is a STRING.
- expected must match the format Java's System.out would print (e.g. arrays print as "[1, 2, 3]" via Arrays.toString).
- starter_code must be a valid "class Solution { ... }" with imports. The method body should just return the default (0, null, false, etc.) — DO NOT solve it.
- Do NOT include any text outside the JSON object.`;

interface ReqBody { problem_key: string; title: string; difficulty?: string; topic?: string; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return new Response(JSON.stringify({ error: 'Missing auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes?.user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json() as ReqBody;
    if (!body.problem_key || !body.title) {
      return new Response(JSON.stringify({ error: 'problem_key and title required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Already cached?
    const { data: existing } = await supabase
      .from('problem_test_cases')
      .select('*')
      .eq('problem_key', body.problem_key)
      .maybeSingle();
    if (existing && Array.isArray(existing.test_cases) && existing.test_cases.length > 0) {
      return new Response(JSON.stringify({ cached: true, data: existing }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userMsg = `Title: ${body.title}\nDifficulty: ${body.difficulty || 'Medium'}\nTopic: ${body.topic || 'general'}\n\nGenerate the JSON now.`;
    const raw = await callAI([
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userMsg },
    ], req);

    let parsed: any;
    try { parsed = JSON.parse(raw); }
    catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) throw new Error('AI returned non-JSON');
      parsed = JSON.parse(m[0]);
    }

    const row = {
      problem_key: body.problem_key,
      title: body.title,
      difficulty: body.difficulty || 'Medium',
      topic: body.topic || '',
      function_name: parsed.function_name || 'solve',
      return_type: parsed.return_type || 'void',
      params: parsed.params || [],
      starter_code: parsed.starter_code || '',
      test_cases: parsed.test_cases || [],
      examples: parsed.examples || [],
      description: parsed.description || '',
      constraints: parsed.constraints || [],
      hints: parsed.hints || [],
      generated_by: userRes.user.id,
    };

    const { data: upserted, error: upErr } = await supabase
      .from('problem_test_cases')
      .upsert(row, { onConflict: 'problem_key' })
      .select()
      .single();
    if (upErr) {
      // Fall back: just return parsed without caching
      return new Response(JSON.stringify({ cached: false, data: row, warning: upErr.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ cached: false, data: upserted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
