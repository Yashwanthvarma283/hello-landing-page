import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `You are a precise Java program execution tracer, like Python Tutor but for Java.

Given Java source code (and optional stdin), simulate execution EXACTLY and emit a step-by-step trace.

Rules:
- One step per executed statement / meaningful state change, in real execution order (loops repeat steps).
- "line" is the 1-based line number in the given source that is ABOUT to execute at that step.
- "frames" is the call stack, innermost LAST. Each frame: { "name": "methodName", "locals": { "var": "value" } }.
  Values are short display strings ("5", "\\"abc\\"", "true", "null", "→arr1" for references to heap objects).
- "heap" lists live objects (arrays, lists, maps, custom objects): { "id": "arr1", "type": "int[5]", "value": "[1, 2, 3, 4, 5]" }.
- "stdout" is the CUMULATIVE printed output up to and including that step.
- "note" is one short sentence explaining what happens at this step (max 120 chars).
- Include a final step with event "return" or "exception" (set "error" text for exceptions).
- Cap at 220 steps. If the program would run longer, stop and set "truncated": true.
- Never invent code that is not present. If the code cannot compile, return zero steps and set "compileError".

Return ONLY valid JSON, no markdown, matching:
{
  "steps": [ { "line": 1, "event": "step|call|return|print|exception", "frames": [...], "heap": [...], "stdout": "", "note": "", "error": "" } ],
  "stdout": "final full output",
  "truncated": false,
  "compileError": "",
  "summary": "2-3 sentence plain-English summary of what the program does"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { code, stdin } = await req.json();
    if (!code || typeof code !== "string") throw new Error("code is required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const numbered = code
      .split("\n")
      .map((l: string, i: number) => `${i + 1}: ${l}`)
      .join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Trace this Java program.${stdin ? `\n\nSTDIN:\n${stdin}` : ""}\n\nSOURCE (line numbers prefixed, do not count the prefix as code):\n${numbered}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const status = response.status === 429 || response.status === 402 ? response.status : 500;
      const msg =
        response.status === 429
          ? "Rate limited, try again in a moment."
          : response.status === 402
          ? "AI credits exhausted."
          : "AI error while tracing.";
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    let raw: string = data?.choices?.[0]?.message?.content ?? "{}";
    raw = raw.trim();
    if (raw.startsWith("```")) raw = raw.replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/, "");

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const s = raw.indexOf("{");
      const e = raw.lastIndexOf("}");
      parsed = s !== -1 && e > s ? JSON.parse(raw.slice(s, e + 1)) : { steps: [] };
    }

    const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
    return new Response(
      JSON.stringify({
        steps,
        stdout: parsed.stdout ?? (steps.length ? steps[steps.length - 1]?.stdout ?? "" : ""),
        truncated: !!parsed.truncated,
        compileError: parsed.compileError || "",
        summary: parsed.summary || "",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("visualize-trace error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
