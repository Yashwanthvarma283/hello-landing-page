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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { code, title, difficulty, problem_key, problemDescription } = await req.json();

    const response = await aiGatewayFetch("test-case-generation", req, {
        messages: [
          {
            role: "system",
            content: `You are a RUTHLESS adversarial test case generator for Java DSA problems. Your goal is to BREAK incorrect solutions. Generate exactly 5 test cases that act as a complete acceptance gate — if a solution passes ALL 5, it is provably correct for ANY hidden judge input.

MANDATORY COVERAGE (one test per category, no duplicates):
1. NORMAL CASE: Standard mid-size example matching the problem description.
2. EDGE CASE: Truly degenerate input — empty array/string, single element, n=0/1, all identical elements, all zeros, or null-equivalent inputs allowed by constraints.
3. BOUNDARY CASE: Hit numeric and size LIMITS — Integer.MAX_VALUE / MIN_VALUE, overflow-prone sums/products, negative numbers if allowed, and the smallest AND largest legal n. Designed to expose off-by-one and integer overflow bugs.
4. LARGE / STRESS CASE: A LARGE input near the upper constraint (e.g. n in the thousands) with a NON-TRIVIAL structure that brute-force O(n²) or naive recursion would still answer correctly but slowly. The expected output must still be exact and computable. Designed to catch sloppy logic, not just timeout.
5. ADVERSARIAL CORNER CASE: A deliberately TRICKY input crafted to defeat common wrong solutions — duplicates, negatives, palindromes, already-sorted/reverse-sorted, cycles, repeated keys, ties, unicode/whitespace strings, max-depth recursion shapes, or whatever the problem's known pitfall is. This is the "killer" test.

QUALITY BAR — REJECT YOUR OWN OUTPUT IF:
- Any two cases test the same underlying scenario.
- The expected output was guessed; you MUST mentally execute the optimal algorithm and write the EXACT output.
- Inputs are empty or trivially identical.

CRITICAL FORMAT: Each test case must have MULTIPLE INPUT VARIABLES matching the function parameters EXACTLY by name.

Example for: public static int[] twoSum(int[] nums, int target)
{
  "inputs": { "nums": "[2,7,11,15]", "target": "9" },
  "expectedOutput": "[0, 1]",
  "category": "normal"
}

All input values must be STRING representations. Arrays as "[1,2,3]", integers as "5", strings as "hello".
Expected output must EXACTLY match what System.out.println() would produce in Java for the CORRECT solution:
- Arrays: "[1, 2, 3]" (Arrays.toString format — spaces after commas)
- 2D arrays: "[[1, 2], [3, 4]]" (Arrays.deepToString format)
- Booleans: "true" or "false"
- Strings: just the string without extra quotes`
          },
          {
            role: "user",
            content: `Generate 5 high-quality test cases (normal, edge, boundary, large input, corner) for this Java function:
${title ? `Problem Title: ${title}\n` : ''}${difficulty ? `Difficulty: ${difficulty}\n` : ''}${problemDescription ? `Problem Description: ${problemDescription}\n` : ''}
Code:
${code}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_test_cases",
              description: "Return 5 high-quality test cases: normal, edge, boundary, large input, and corner case",
              parameters: {
                type: "object",
                properties: {
                  testCases: {
                    type: "array",
                    maxItems: 5,
                    items: {
                      type: "object",
                      properties: {
                        inputs: {
                          type: "object",
                          description: "Map of parameter name to string value"
                        },
                        expectedOutput: { type: "string" },
                        category: { 
                          type: "string",
                          description: "Test category: normal, edge, boundary, large_input, or corner"
                        }
                      },
                      required: ["inputs", "expectedOutput"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["testCases"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_test_cases" } }
      });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(t || JSON.stringify({ error: "AI error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      const args = JSON.parse(toolCall.function.arguments);
      const validCases = (args.testCases || []).filter((tc: any) => {
        if (!tc || typeof tc !== "object") return false;
        if (!tc.inputs || typeof tc.inputs !== "object") return false;
        const hasInputs = Object.values(tc.inputs).some(
          (v) => v !== null && v !== undefined && String(v).trim() !== ""
        );
        const hasExpected = tc.expectedOutput && String(tc.expectedOutput).trim() !== "";
        return hasInputs && hasExpected;
      }).slice(0, 5);

      // Best-effort: merge into shared cache so other users benefit
      if (problem_key && validCases.length > 0) {
        try {
          const normalized = validCases.map((tc: any) => ({
            inputs: tc.inputs,
            expected: tc.expectedOutput,
            category: tc.category || "normal",
          }));
          const { data: existing } = await adminClient
            .from("problem_test_cases")
            .select("id, test_cases")
            .eq("problem_key", problem_key)
            .maybeSingle();
          if (existing) {
            // ALWAYS update the cache with the new generated cases, but prepend them to existing ones
            // Actually, let's just REPLACE them if the user is explicitly generating new ones, 
            // or merge them and deduplicate. For now, let's just merge.
            const existingCases = Array.isArray((existing as any).test_cases) ? (existing as any).test_cases : [];
            const merged = [...existingCases, ...normalized].slice(-20); // Keep last 20
            await adminClient.from("problem_test_cases").update({ test_cases: merged }).eq("id", (existing as any).id);
          } else {
            const authHeader = req.headers.get("Authorization") || "";
            let userId: string | null = null;
            try {
              const token = authHeader.replace("Bearer ", "");
              const payload = JSON.parse(atob(token.split(".")[1] || ""));
              userId = payload?.sub || null;
            } catch {}
            await adminClient.from("problem_test_cases").insert({
              problem_key,
              title: title || "",
              difficulty: difficulty || "Medium",
              test_cases: normalized,
              generated_by: userId,
            });
          }
        } catch (cacheErr) {
          console.error("test-cases cache write failed:", cacheErr);
        }
      }

      return new Response(JSON.stringify({ testCases: validCases }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = data.choices?.[0]?.message?.content || "[]";
    const parsed = JSON.parse(content);
    return new Response(JSON.stringify({ testCases: Array.isArray(parsed) ? parsed : [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-test-cases error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
