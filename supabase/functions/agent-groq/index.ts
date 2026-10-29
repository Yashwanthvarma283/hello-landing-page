// Groq agent edge function with API key rotation.
// Two modes: 'generate' (write Java solution) and 'fix' (repair Java code given an error).
// Rotates through GROQ_API_KEY_1..5; on 429/401 falls back to next key.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';
const LOVABLE_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const LOVABLE_MODEL = 'google/gemini-3.8-flash';

function getKeys(): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const k = Deno.env.get(`GROQ_API_KEY_${i}`);
    if (k) keys.push(k);
  }
  return keys;
}

// Rotate starting offset based on time so concurrent invocations don't all start on key 1.
let rotationCursor = 0;

async function callGroq(messages: any[], temperature = 0.2): Promise<{ content: string; keyIndex: number }> {
  const keys = getKeys();
  if (keys.length === 0) throw new Error('No GROQ_API_KEY_* secrets configured');

  let lastErr = '';
  const startOffset = rotationCursor++ % keys.length;
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (startOffset + attempt) % keys.length;
    const key = keys[idx];
    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature,
          max_tokens: 2048,
        }),
      });
      if (res.status === 429 || res.status === 401 || res.status === 403) {
        lastErr = `Key #${idx + 1} -> HTTP ${res.status}`;
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        lastErr = `HTTP ${res.status}: ${text.slice(0, 200)}`;
        continue;
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content ?? '';
      return { content, keyIndex: idx + 1 };
    } catch (e) {
      lastErr = (e as Error).message;
    }
  }
  throw new Error(`All Groq keys failed: ${lastErr}`);
}

async function callLovable(messages: any[], temperature = 0.2): Promise<string> {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) throw new Error('LOVABLE_API_KEY not configured');

  const res = await fetch(LOVABLE_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: LOVABLE_MODEL, messages, temperature, max_tokens: 4096 }),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error('RATE_LIMIT: Too many requests, please wait a moment and try again.');
    if (res.status === 402) throw new Error('CREDITS: AI credits exhausted. Please top up to keep using the AI features.');
    throw new Error(`Lovable AI HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

async function callAI(messages: any[], temperature = 0.2): Promise<{ content: string; keyIndex: number; provider: string }> {
  try {
    const content = await callLovable(messages, temperature);
    if (content) return { content, keyIndex: 0, provider: 'lovable' };
    throw new Error('Empty response from Lovable AI');
  } catch (primaryErr) {
    const msg = (primaryErr as Error).message || '';
    try {
      const groq = await callGroq(messages, temperature);
      return { ...groq, provider: 'groq' };
    } catch (fallbackErr) {
      throw new Error(`${msg} (Groq fallback also failed: ${(fallbackErr as Error).message})`);
    }
  }
}

function stripCodeFence(text: string): string {
  // Remove ```java ... ``` or ``` ... ``` fences, keep inner
  const fence = text.match(/```(?:java|Java|JAVA)?\s*\n([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  return text.trim();
}

const GEN_SYSTEM = `You are an expert Java programmer. Solve the problem optimally. Return only Java code.

Strict rules:
- Output a single Java class named exactly "Solution".
- Implement the requested method signature exactly as given.
- Do NOT include a main method. Do NOT include package statements. Do NOT add explanations or markdown.
- You may use java.util.*, java.math.*, java.io.* via fully-qualified names or imports at the top.
- The code must compile and produce correct results for typical test cases.`;

const FIX_SYSTEM = `You are a Java debugging expert. Fix the Java code based on the exact error reported. Return only corrected Java code.

Strict rules:
- Keep the same class name "Solution" and the same method signature.
- Do NOT include a main method. Do NOT add explanations or markdown.
- Read the error carefully and fix ONLY that issue.
- If the error class is CODE_COMPILE: fix syntax, type, symbol, or structural Java errors shown in the compiler output.
- If the error class is RUNTIME: fix NullPointerException, ArrayIndexOutOfBounds, StackOverflow, or other runtime exceptions.
- If the error class is LOGIC: rethink the algorithm to produce the correct output.
- If the error class is TIMEOUT: optimize the algorithm time complexity.
- Output the FULL corrected Solution class.`;


interface GenerateBody {
  mode: 'generate';
  title: string;
  description?: string;
  difficulty?: string;
  starterCode: string;
  examples?: Array<{ input?: string; output?: string; explanation?: string }>;
}

interface FixBody {
  mode: 'fix';
  title: string;
  starterCode: string;
  currentCode: string;
  errorOutput: string;
  errorType?: string;
  failingTest?: { input: string; expected: string; actual: string };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  try {
    const body = await req.json() as GenerateBody | FixBody;
    let messages: any[];
    if (body.mode === 'generate') {
      const examples = (body.examples || []).slice(0, 3).map((e, i) =>
        `Example ${i + 1}:\nInput: ${e.input ?? ''}\nOutput: ${e.output ?? ''}${e.explanation ? `\nExplanation: ${e.explanation}` : ''}`
      ).join('\n\n');
      const userMsg = `Problem: ${body.title}
Difficulty: ${body.difficulty ?? 'Medium'}

Description:
${body.description ?? '(none provided — infer from title)'}

${examples ? `Examples:\n${examples}\n\n` : ''}Starter code (match this signature exactly):
\`\`\`java
${body.starterCode}
\`\`\`

Return only the complete Solution class.`;
      messages = [
        { role: 'system', content: GEN_SYSTEM },
        { role: 'user', content: userMsg },
      ];
    } else if (body.mode === 'fix') {
      const failBlock = body.failingTest
        ? `Failing test:\nInput: ${body.failingTest.input}\nExpected: ${body.failingTest.expected}\nActual: ${body.failingTest.actual}\n\n`
        : '';
      const errorTypeLabel = body.errorType || 'UNKNOWN';
      const errorGuidance = {
        CODE_COMPILE: 'Fix all Java compilation errors shown below. The code cannot compile - do not change logic, only fix syntax/type errors.',
        RUNTIME: 'Fix the runtime exception shown below. Make the code handle edge cases and not throw exceptions.',
        LOGIC: 'The code compiles and runs but produces wrong output. Fix the algorithm logic.',
        TIMEOUT: 'The code is too slow. Optimize the algorithm to reduce time complexity.',
        SYSTEM: 'There was a system/infrastructure error. Ensure the code is self-contained and correct.',
      }[errorTypeLabel] || 'Fix the error in the code.';

      const userMsg = `Problem: ${body.title}
Error Type: ${errorTypeLabel}
Task: ${errorGuidance}

Original starter signature:
\`\`\`java
${body.starterCode}
\`\`\`

Current (broken) code:
\`\`\`java
${body.currentCode}
\`\`\`

Full error output (DO NOT ignore any line):
${body.errorOutput}

${failBlock}Return only the complete corrected Solution class.`;
      messages = [
        { role: 'system', content: FIX_SYSTEM },
        { role: 'user', content: userMsg },
      ];
    } else {
      return new Response(JSON.stringify({ error: 'Invalid mode' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { content, keyIndex, provider } = await callAI(messages, body.mode === 'fix' ? 0.1 : 0.2);
    const code = stripCodeFence(content);
    return new Response(JSON.stringify({ code, keyUsed: keyIndex, provider }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
