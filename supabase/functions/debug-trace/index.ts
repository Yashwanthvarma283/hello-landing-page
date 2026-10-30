import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chatWithFeatureAI } from "../_shared/ai-pool.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { code } = await req.json();

    const stream = await streamWithFeatureAI("debug-trace", {
      req,
      messages: [
        {
          role: "system",
          content: `You are a code execution tracer. Given Java code, simulate its execution step by step.

For EACH step, show:
1. The line being executed
2. What variables change and their new values
3. A brief explanation

Format each step as:
### Step N
**Line:** \`code line here\`
**Variables:** \`varName\` = \`value\`, \`varName2\` = \`value2\`
**Explanation:** What happens at this step

For array/pointer problems, show visual representations like:
\`[1, 2, 3, 4, 5]\`
\` ^left    ^right\`

Be thorough but concise. Show every meaningful state change.`
        },
        {
          role: "user",
          content: `Trace through this Java code step by step, showing how variables change at each line:\n\n${code}`
        }
      ],
    });

    return new Response(stream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("debug-trace error:", e);
    const status = e instanceof Error && e.message.startsWith('RATE_LIMIT') ? 429 : 500;
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
