import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chatWithFeatureAI } from "../_shared/ai-pool.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { difficulty, topic } = await req.json();

    const result = await chatWithFeatureAI("problem-generation", {
      messages: [
        { role: "system", content: "You are a coding problem generator. Generate unique, well-structured Java DSA problems." },
        { role: "user", content: `Generate a ${difficulty} difficulty Java DSA problem about "${topic}". Include a clear title, description, examples with input/output, constraints, and starter code with only the function signature.` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "return_problem",
          description: "Return the generated problem",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              examples: { type: "array", items: { type: "object", properties: { input: { type: "string" }, output: { type: "string" }, explanation: { type: "string" } }, required: ["input", "output"] } },
              constraints: { type: "array", items: { type: "string" } },
              starterCode: { type: "string" },
              difficulty: { type: "string" },
              topic: { type: "string" },
            },
            required: ["title", "description", "examples", "constraints", "starterCode", "difficulty", "topic"],
            additionalProperties: false,
          },
        },
      }],
      toolChoice: { type: "function", function: { name: "return_problem" } },
    });

    let problem: any = null;
    const toolCall = result.raw?.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      problem = JSON.parse(toolCall.function.arguments);
    } else if (result.content) {
      try { problem = JSON.parse(result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()); } catch { problem = null; }
    }

    if (problem) {
      return new Response(JSON.stringify({ problem }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Failed to generate problem" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-problem error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
