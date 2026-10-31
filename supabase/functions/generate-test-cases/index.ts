import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { aiGatewayFetch, extractJSON } from "../_shared/ai-compat.ts";
import { getUserIdFromRequest } from "../_shared/ai-pool.ts";
import { filterPracticeTests, type PracticeTestCase } from "../_shared/test-case-policy.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    if (!await getUserIdFromRequest(req)) return new Response(JSON.stringify({ error: "Sign in to generate tests." }), { status: 401, headers });
    const body = await req.json();
    const { code, title, problemDescription } = body;
    if (!title || !problemDescription) return new Response(JSON.stringify({ error: "Load the complete question before generating tests." }), { status: 400, headers });
    const cleanCode = String(code || "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const sig = cleanCode.match(/(?:public|private|protected|static|\s)+[\w<>\[\],\s]+?\s+(\w+)\s*\(([^)]*)\)\s*\{/);
    const paramNames: string[] = Array.isArray(body.paramNames) && body.paramNames.length
      ? body.paramNames.filter((p: unknown) => typeof p === "string")
      : sig && sig[2].trim() ? sig[2].split(/,(?![^<]*>)/).map((p: string) => p.trim().split(/\s+/).pop() || "").filter(Boolean) : [];
    if (!paramNames.length) return new Response(JSON.stringify({ error: "The question needs a valid method signature before generating tests." }), { status: 400, headers });
    const existing = Array.isArray(body.existingTestCases) ? body.existingTestCases.filter((t: any) => t?.inputs && typeof t.inputs === "object") : [];
    const accepted: PracticeTestCase[] = [];
    for (let attempt = 0; attempt < 3 && accepted.length < 3; attempt++) {
      const response = await aiGatewayFetch("test-case-generation", req, {
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `Generate practice tests ONLY for the supplied question. Return JSON {"testCases":[{"inputs":{"parameter":"value"},"expected":"exact output","difficulty":"easy or medium","category":"normal or simple_edge"}]}.
Strictly EASY or MEDIUM cases only, even for a hard question. No hard, adversarial, stress, overflow, maximum-size or huge-number cases. Prefer straightforward small inputs. Arrays have at most 20 entries per dimension; strings at most 80 characters; numbers have absolute value at most 10000. These practice limits do not override the question constraints: satisfy BOTH. Never use empty/null/negative inputs unless explicitly legal.
Match ALL parameter names and types exactly. Values must be strings using Java input representations. Compute exact expected outputs independently from the question, never from the user's unfinished code. Arrays use Java Arrays.toString spacing; booleans are lowercase. Do not repeat any excluded input or another input in this batch. When only finitely many legal inputs exist and all are excluded, return an empty testCases array rather than inventing invalid cases.` },
          { role: "user", content: JSON.stringify({
            question: { title, description: problemDescription, constraints: body.constraints || [], examples: body.examples || [], params: body.params || [], signature: sig?.[0] || code },
            paramNames, excludedTests: [...existing, ...accepted], requestedCount: 3 - accepted.length,
            variation: crypto.randomUUID(),
          }) },
        ],
      });
      if (!response.ok) return new Response(await response.text(), { status: response.status, headers });
      const data = await response.json();
      const parsed = extractJSON(data.choices?.[0]?.message?.content || "{}");
      const candidates = Array.isArray(parsed) ? parsed : parsed.testCases;
      const filtered = filterPracticeTests(Array.isArray(candidates) ? candidates : [], [...existing, ...accepted], paramNames);
      if (!filtered.length) continue;
      // A separate semantic check prevents accepting syntactically valid tests for the wrong question.
      const review = await aiGatewayFetch("test-case-validation", req, {
        temperature: 0, response_format: { type: "json_object" },
        messages: [
          { role: "system", content: 'Independently verify every proposed test against the question and its constraints. Compute the answer yourself, verify exact output and Java parameter types. Reject unrelated, ambiguous, invalid, hard, stress, overflow or adversarial tests. Only ordinary EASY/MEDIUM practice tests are allowed. Return JSON {"validIndices":[zero-based indices of fully correct tests]}. Never trust the proposed expected values.' },
          { role: "user", content: JSON.stringify({ title, problemDescription, constraints: body.constraints || [], params: body.params || [], examples: body.examples || [], tests: filtered }) },
        ],
      });
      if (!review.ok) return new Response(await review.text(), { status: review.status, headers });
      const reviewData = await review.json();
      const verdict = extractJSON(reviewData.choices?.[0]?.message?.content || "{}");
      const validIndices = new Set(Array.isArray(verdict.validIndices) ? verdict.validIndices.filter(Number.isInteger) : []);
      accepted.push(...filtered.filter((_, index) => validIndices.has(index)).slice(0, 3 - accepted.length));
    }
    return new Response(JSON.stringify({ testCases: accepted, ...(accepted.length ? {} : { error: "No new valid easy/medium tests were found. Try again; existing tests were kept." }) }), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Test generation failed." }), { status: 500, headers });
  }
});
