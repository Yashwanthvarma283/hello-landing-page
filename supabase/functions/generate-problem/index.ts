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
      req,
      messages: [
        { role: "system", content: `You are a senior LeetCode problem setter. Write ORIGINAL Java DSA problems in exact LeetCode style.

FORMAT RULES:
- title: short LeetCode-style title (e.g. "Longest Balanced Substring"), no numbering.
- description: the problem statement only, in LeetCode voice: "Given an integer array \\`nums\\` and an integer \\`k\\`, return ...". Use \\`backticks\\` for variable names. Define every term, state what to return, mention tie-breaking / "You may assume ..." rules. 2-5 short paragraphs separated by \n\n. Do NOT put examples or constraints inside the description.
- examples: 2-3 examples. input uses LeetCode format exactly like "nums = [2,7,11,15], target = 9" (parameter names identical to the method signature). output is the exact return value like "[0,1]", "true", "3", "\"abc\"". explanation is one or two sentences showing why.
- constraints: LeetCode-style bounds, e.g. "1 <= nums.length <= 10^5", "-10^9 <= nums[i] <= 10^9", "s consists of lowercase English letters.", "Only one valid answer exists."
- starterCode: "class Solution {\n    public <ReturnType> <methodName>(<params>) {\n        \n    }\n}" — only the empty method, no solution, no main.
- The examples' outputs MUST be correct for the described problem. Double-check them.
- difficulty must equal the requested difficulty; topic must equal the requested topic.` },
        { role: "user", content: `Create a ${difficulty} LeetCode-style Java problem on the topic "${topic}". Make it a genuine ${difficulty} problem for that topic.` },
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
