// Drop-in replacement for the old `fetch(ai.gateway.lovable.dev/...)` calls.
// Routes every request through the admin primary key (ai-pool.ts) so usage is
// logged, and converts forced function-calls into JSON mode, which is far more
// reliable across providers (Groq often fails with `tool_use_failed`).
// The returned Response mimics an OpenAI chat-completions response, so the
// existing parsing code (`choices[0].message.tool_calls[0].function.arguments`) keeps working.

import { chatWithFeatureAI, streamWithFeatureAI } from './ai-pool.ts';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** Extract the first JSON object/array from model text (handles ```json fences and chatter). */
export function extractJSON(text: string): any {
  if (!text) throw new Error('Empty AI response');
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const start = cleaned.search(/[\[{]/);
  if (start < 0) throw new Error('AI response contained no JSON');
  const open = cleaned[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
  }
  throw new Error('AI response JSON was incomplete');
}

function errorResponse(e: unknown): Response {
  const msg = e instanceof Error ? e.message : String(e);
  const status = /rate limit/i.test(msg) ? 429 : 500;
  return new Response(JSON.stringify({ error: msg }), { status, headers: JSON_HEADERS });
}

/**
 * Call AI via the admin primary key with an OpenAI-style body.
 * `body.model` is ignored (the admin's configured model is used).
 */
export async function aiGatewayFetch(feature: string, req: Request, body: any): Promise<Response> {
  const messages = [...(body.messages ?? [])];
  const maxTokens = body.max_tokens ?? 8000;
  const temperature = body.temperature ?? 0.2;

  try {
    if (body.stream) {
      const s = await streamWithFeatureAI(feature, { req, messages, maxTokens, temperature });
      return new Response(s.body, { headers: { 'Content-Type': 'text/event-stream' } });
    }

    const forcedName: string | undefined = body.tool_choice?.function?.name;
    const tool = forcedName
      ? (body.tools ?? []).find((t: any) => t?.function?.name === forcedName)
      : undefined;

    if (tool) {
      const schema = JSON.stringify(tool.function.parameters ?? {});
      messages.push({
        role: 'system',
        content:
          `Respond with ONLY one valid JSON object (no markdown, no prose) that conforms to this JSON Schema:\n${schema}\n` +
          'Every required field must be present. All string values must be valid JSON strings (escape newlines as \\n).',
      });
      let lastErr: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await chatWithFeatureAI(feature, { req, messages, maxTokens, temperature, responseFormat: 'json' });
        try {
          const parsed = extractJSON(r.content);
          return new Response(JSON.stringify({
            choices: [{ message: { role: 'assistant', content: null, tool_calls: [{
              type: 'function', function: { name: forcedName, arguments: JSON.stringify(parsed) },
            }] } }],
          }), { headers: JSON_HEADERS });
        } catch (e) { lastErr = e; }
      }
      throw lastErr;
    }

    const r = await chatWithFeatureAI(feature, {
      req, messages, maxTokens, temperature,
      ...(body.response_format?.type === 'json_object' ? { responseFormat: 'json' as const } : {}),
    });
    return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content: r.content } }] }), {
      headers: JSON_HEADERS,
    });
  } catch (e) {
    console.error(`[${feature}] AI error:`, e);
    return errorResponse(e);
  }
}
