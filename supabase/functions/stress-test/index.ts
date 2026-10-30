import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiGatewayFetch } from "../_shared/ai-compat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { code, testCases } = await req.json();

    const existingTests = testCases?.map((tc: any) => `Input: ${tc.input}, Expected: ${tc.expected_output}`).join('\n') || 'None';

    const response = await aiGatewayFetch("stress-test", req, {
        messages: [
          {
            role: "system",
            content: "You generate stress test cases to find edge cases in Java code. Generate a SMALL set of diverse, tricky test cases (maximum 5) including: empty inputs, single elements, large numbers, negative numbers, duplicates, sorted/reverse-sorted inputs, boundary values, and cases designed to break common wrong approaches. Prefer the most informative cases over quantity."
          },
          {
            role: "user",
            content: `Generate up to 5 diverse, high-signal stress test cases for this Java function. Existing tests:\n${existingTests}\n\nCode:\n${code}\n\nGenerate cases that test edge cases and could break incorrect solutions. Focus on quality and variety, not quantity.`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "return_stress_tests",
            description: "Return stress test cases",
            parameters: {
              type: "object",
              properties: {
                testCases: {
                  type: "array",
                  maxItems: 5,
                  items: {
                    type: "object",
                    properties: {
                      variableName: { type: "string" },
                      input: { type: "string" },
                      expectedOutput: { type: "string" },
                      category: { type: "string", enum: ["edge", "boundary", "large", "negative", "empty", "duplicate", "random"] }
                    },
                    required: ["variableName", "input", "expectedOutput", "category"],
                    additionalProperties: false
                  }
                }
              },
              required: ["testCases"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "return_stress_tests" } },
      });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Payment required." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(await response.text(), { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      const args = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ testCases: args.testCases }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ testCases: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stress-test error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
