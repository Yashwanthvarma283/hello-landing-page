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

    const { content } = await chatWithFeatureAI("code-review", {
      messages: [
        {
          role: "system",
          content: `You are a code quality reviewer. Analyze the given Java code and return a JSON object with:
{
  "overallScore": <1-10>,
  "categories": [
    {"name": "Readability", "score": <1-10>, "feedback": "..."},
    {"name": "Edge Cases", "score": <1-10>, "feedback": "..."},
    {"name": "Efficiency", "score": <1-10>, "feedback": "..."},
    {"name": "Best Practices", "score": <1-10>, "feedback": "..."}
  ],
  "suggestions": ["suggestion 1", "suggestion 2", ...],
  "summary": "Markdown summary of the review"
}
Return ONLY valid JSON, no markdown fences.`
        },
        { role: "user", content: `Review this Java code:\n\n${code}` }
      ],
      responseFormat: 'json',
    });

    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch {
      return new Response(JSON.stringify({
        overallScore: 5,
        categories: [{ name: "General", score: 5, feedback: content }],
        suggestions: [],
        summary: content
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    console.error("code-review error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
