import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiGatewayFetch } from "../_shared/ai-compat.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { algorithm, code } = await req.json();

    const prompt = code
      ? `Explain this Java code step by step. Show what happens at each line, trace through variables, and explain the algorithm used:\n\n${code}`
      : `Teach me the "${algorithm}" algorithm/data structure for Java DSA preparation. Include:
1. **Concept Overview** - What it is and when to use it
2. **How It Works** - Step-by-step explanation with visual ASCII diagrams
3. **Java Implementation** - Clean, commented code
4. **Complexity Analysis** - Time and space complexity
5. **Common Patterns** - Typical problems that use this
6. **Practice Tips** - How to identify when to use this approach
7. **Example Walkthrough** - Trace through a concrete example

Use clear formatting with headers, code blocks, and diagrams.`;

    const response = await aiGatewayFetch("learning-mode", req, {
        messages: [
          { role: "system", content: "You are an expert DSA tutor. Explain algorithms clearly with visual diagrams (ASCII art), step-by-step traces, and Java code examples. Make explanations beginner-friendly but thorough." },
          { role: "user", content: prompt },
        ],
        stream: true,
      });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(await response.text(), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("learn-algorithm error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
