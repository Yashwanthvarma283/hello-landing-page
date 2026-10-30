import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiGatewayFetch } from "../_shared/ai-compat.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function callAI(req: Request, title: string, difficulty: string, topic: string) {
  const response = await aiGatewayFetch("problem-detail", req, {
      messages: [
        {
          role: "system",
          content: `You are an expert competitive programming problem writer AND a RUTHLESS adversarial test case designer. You create LeetCode-grade problems whose test cases together act as a complete acceptance gate — passing them all proves the solution is correct for ANY hidden judge input.

Generate complete LeetCode-style problem details for Java DSA problems with AT LEAST 3 and UP TO 5 toughest-possible test cases. EVERY test case MUST have non-empty inputs and an exact expected output. Never return an empty testCases array.

MANDATORY TEST COVERAGE (no duplicates, no overlap):
1. NORMAL CASE: Standard mid-size example matching the problem description.
2. EDGE CASE: Truly degenerate input — empty/single-element inputs, n=0/1, all identical, all zeros, or null-equivalent values allowed by constraints.
3. BOUNDARY CASE: Hit numeric and size LIMITS — Integer.MAX_VALUE / MIN_VALUE, overflow-prone sums/products, negatives if allowed, smallest AND largest legal n.
4. (optional) LARGE / STRESS CASE.
5. (optional) ADVERSARIAL CORNER CASE — duplicates, palindromes, sorted/reverse, ties, the problem's known pitfall.

QUALITY BAR:
- Mentally execute the optimal algorithm and write the EXACT output for every test.
- No two cases test the same scenario.
- Inputs are NEVER empty placeholders.

FORMAT RULES:
- Each test case input value must be a STRING. Arrays as "[1,2,3]", integers as "5", strings as "hello" (no extra quotes).
- The expected output must EXACTLY match what System.out.println() prints for a CORRECT Java solution:
  - Arrays / lists: Java toString format like "[1, 2, 3]" (spaces after commas)
  - 2D arrays: Arrays.deepToString format like "[[1, 2], [3, 4]]"
  - Boolean: "true" or "false"
  - Strings: just the string without quotes
- Input variable names MUST exactly match the parameter names declared in starterCode.

PROBLEM REQUIREMENTS:
- Description detailed and clear, matching the REAL LeetCode problem if it exists.
- Constraints list realistic limits.
- Include 2-3 examples with input, output, and explanation.
- Starter code: valid Java class with correct method signature.
- Function name, return type, and parameters must match starterCode exactly.`,
        },
        {
          role: "user",
          content: `Generate a complete LeetCode-style problem for: "${title}" (Difficulty: ${difficulty}, Topic: ${topic || "General"}).
Match the REAL LeetCode problem if it exists. Every example and test case MUST be about THIS exact problem ("${title}") — never a different problem. The keys of each test case "inputs" object MUST be exactly the parameter names of the method in starterCode, and examples must use the LeetCode format "nums = [2,7,11,15], target = 9". The description must read like LeetCode: a clear statement, then rely on the separate examples/constraints fields (do not repeat them inside the description). Include description, constraints, examples with explanations, starter code, and 3-5 high-quality test cases (every one MUST have inputs and an exact expected output).`,
        },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_problem_detail",
          description: "Return the complete problem detail with high-quality test cases",
          parameters: {
            type: "object",
            properties: {
              description: { type: "string" },
              constraints: { type: "array", items: { type: "string" } },
              examples: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    input: { type: "string" },
                    output: { type: "string" },
                    explanation: { type: "string" },
                  },
                  required: ["input", "output"],
                },
              },
              starterCode: { type: "string" },
              testCases: {
                type: "array",
                minItems: 3,
                maxItems: 5,
                items: {
                  type: "object",
                  properties: {
                    inputs: { type: "object" },
                    expected: { type: "string" },
                    category: { type: "string" },
                  },
                  required: ["inputs", "expected"],
                },
              },
              functionName: { type: "string" },
              returnType: { type: "string" },
              params: {
                type: "array",
                items: {
                  type: "object",
                  properties: { name: { type: "string" }, type: { type: "string" } },
                  required: ["name", "type"],
                },
              },
              hints: { type: "array", items: { type: "string" } },
              approach: { type: "string" },
            },
            required: ["description", "constraints", "examples", "starterCode", "testCases", "functionName", "returnType", "params"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "return_problem_detail" } },
    });

  if (!response.ok) {
    const status = response.status;
    const t = await response.text().catch(() => "");
    let msg = `AI error ${status}`; try { msg = JSON.parse(t).error || msg; } catch {}
    const err: any = new Error(msg);
    err.status = status;
    err.body = t;
    throw err;
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("AI returned no tool call");
  return JSON.parse(toolCall.function.arguments);
}

function paramsFromStarter(code: string): { name: string; type: string }[] {
  const clean = String(code || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const m = clean.match(/(?:public|private|protected|static|\s)+[\w<>\[\],\s]+?\s+\w+\s*\(([^)]*)\)\s*\{/);
  if (!m || !m[1].trim()) return [];
  return m[1].split(/,(?![^<]*>)/).map((p) => p.trim().split(/\s+/)).filter((a) => a.length >= 2)
    .map((a) => ({ name: a[a.length - 1], type: a.slice(0, -1).join(' ') }));
}

/** Keep only test cases whose input keys are exactly the method parameters (fixes irrelevant/broken cases). */
function alignToParams(cases: any[], paramNames: string[]): any[] {
  if (!paramNames.length) return cases;
  return cases.map((tc) => {
    const src = tc.inputs || {};
    const lower: Record<string, any> = {};
    for (const [k, v] of Object.entries(src)) lower[k.toLowerCase()] = v;
    const vals = Object.values(src);
    const inputs: Record<string, string> = {};
    paramNames.forEach((name, i) => {
      const v = src[name] ?? lower[name.toLowerCase()] ?? (vals.length === paramNames.length ? vals[i] : undefined);
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        inputs[name] = typeof v === 'string' ? v : JSON.stringify(v);
      }
    });
    return Object.keys(inputs).length === paramNames.length ? { ...tc, inputs } : null;
  }).filter(Boolean);
}

function sanitizeDetail(detail: any) {
  detail = detail && typeof detail === 'object' ? detail : {};
  const starterParams = paramsFromStarter(detail.starterCode);
  if (starterParams.length) detail.params = starterParams;
  const paramNamesAll: string[] = Array.isArray(detail.params) ? detail.params.map((p: any) => p?.name).filter(Boolean) : [];
  // Strict validation: drop test cases with missing inputs/expected
  if (Array.isArray(detail.testCases)) {
    detail.testCases = detail.testCases.filter((tc: any) => {
      if (!tc || typeof tc !== "object") return false;
      if (!tc.inputs || typeof tc.inputs !== "object") return false;
      const hasInputs = Object.values(tc.inputs).some(
        (v) => v !== null && v !== undefined && String(v).trim() !== "",
      );
      const expectedField = tc.expected ?? tc.expectedOutput;
      const hasExpected = expectedField !== undefined && String(expectedField).trim() !== "";
      if (hasExpected && tc.expected === undefined) tc.expected = String(expectedField);
      return hasInputs && hasExpected;
    }).map((tc: any) => ({ ...tc, expected: String(tc.expected).trim() }));
    detail.testCases = alignToParams(detail.testCases, paramNamesAll).slice(0, 5);
  } else {
    detail.testCases = [];
  }

  // Fallback: derive test cases from examples
  if (detail.testCases.length < 3 && Array.isArray(detail.examples) && Array.isArray(detail.params)) {
    const paramNames: string[] = detail.params.map((p: any) => p?.name).filter(Boolean);
    const derived = detail.examples.map((ex: any) => {
      const raw = String(ex?.input ?? "");
      const inputs: Record<string, string> = {};
      const assignments = raw.split(/,\s*(?=[a-zA-Z_]\w*\s*=)/);
      let matched = 0;
      for (const part of assignments) {
        const m = part.match(/^\s*([a-zA-Z_]\w*)\s*=\s*([\s\S]+?)\s*$/);
        if (m && paramNames.includes(m[1])) {
          inputs[m[1]] = m[2];
          matched++;
        }
      }
      if (matched === 0 && paramNames.length === 1) {
        inputs[paramNames[0]] = raw.replace(/^[a-zA-Z_]\w*\s*=\s*/, "");
      }
      return { inputs, expected: String(ex?.output ?? "").trim(), category: "normal" };
    }).filter((tc: any) => Object.keys(tc.inputs).length > 0 && tc.expected);
    const seen = new Set(detail.testCases.map((tc: any) => JSON.stringify(tc.inputs)));
    for (const d of alignToParams(derived, paramNames)) {
      if (!seen.has(JSON.stringify(d.inputs))) { detail.testCases.unshift(d); seen.add(JSON.stringify(d.inputs)); }
    }
    detail.testCases = detail.testCases.slice(0, 5);
  }

  return detail;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, difficulty, topic, problem_key, force } = await req.json();

    // 1) Cache hit — return immediately
    if (problem_key && !force) {
      const { data: cached } = await adminClient
        .from("problem_test_cases")
        .select("*")
        .eq("problem_key", problem_key)
        .maybeSingle();

      if (cached && Array.isArray(cached.test_cases) && cached.test_cases.length >= 1) {
        const detail = {
          description: cached.description,
          constraints: cached.constraints || [],
          examples: cached.examples || [],
          starterCode: cached.starter_code,
          testCases: cached.test_cases,
          functionName: cached.function_name,
          returnType: cached.return_type,
          params: cached.params || [],
          hints: cached.hints || [],
        };
        return new Response(JSON.stringify({ detail, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2) Generate, with one retry if test cases come back empty
    let detail = sanitizeDetail(await callAI(req, title, difficulty, topic));
    if (detail.testCases.length === 0) {
      detail = sanitizeDetail(await callAI(req, title, difficulty, topic));
    }

    // 3) Write to shared cache (best-effort) using service role
    if (problem_key && detail.testCases.length > 0) {
      try {
        // Get the calling user from JWT to set generated_by (RLS allows admin-bypass via service role anyway)
        const authHeader = req.headers.get("Authorization") || "";
        let userId: string | null = null;
        try {
          const token = authHeader.replace("Bearer ", "");
          const payload = JSON.parse(atob(token.split(".")[1] || ""));
          userId = payload?.sub || null;
        } catch { /* unauthenticated is fine */ }

        await adminClient.from("problem_test_cases").upsert({
          problem_key,
          title: title || "",
          difficulty: difficulty || "Medium",
          topic: topic || "",
          description: detail.description || "",
          examples: detail.examples || [],
          constraints: detail.constraints || [],
          hints: detail.hints || [],
          starter_code: detail.starterCode || "",
          function_name: detail.functionName || "solve",
          return_type: detail.returnType || "void",
          params: detail.params || [],
          test_cases: detail.testCases || [],
          generated_by: userId,
        }, { onConflict: "problem_key" });
      } catch (cacheErr) {
        console.error("cache write failed:", cacheErr);
      }
    }

    return new Response(JSON.stringify({ detail, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    const status = e?.status || 500;
    if (status === 429) {
      return new Response(JSON.stringify({ error: "Rate limited. Please try again." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (status === 402) {
      return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("generate-problem-detail error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
