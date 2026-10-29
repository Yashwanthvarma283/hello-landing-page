import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { chatWithFeatureAI } from "../_shared/ai-pool.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { progressSummary, totalSolved, totalProblems } = await req.json();

    try {
      const { content } = await chatWithFeatureAI("adaptive-path", {
        messages: [
          {
            role: "system",
            content: `You are a DSA study advisor. Given a student's topic-wise progress, provide a brief motivational insight (2-3 sentences) about their strengths, what to focus on next, and a study strategy tip. Be specific and actionable. Use markdown formatting.`
          },
          {
            role: "user",
            content: `Student has solved ${totalSolved}/${totalProblems} problems. Topic breakdown:\n${progressSummary}`
          }
        ],
      });
      const insight = content || "";
      return new Response(JSON.stringify({ insight }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (aiErr) {
      console.error("adaptive-path AI error:", aiErr);
      return new Response(JSON.stringify({ insight: null }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (e) {
    console.error("adaptive-path error:", e);
    return new Response(JSON.stringify({ insight: null }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
