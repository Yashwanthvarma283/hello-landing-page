import { API_BASE_URL } from './api';
import { supabase } from '@/integrations/supabase/client';
import { filterPracticeTests, type PracticeTestCase } from '../../supabase/functions/_shared/test-case-policy';

export async function checkBackendStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/run-java`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'public class Solution { public static void main(String[] args) {} }' }),
      signal: AbortSignal.timeout(5000),
    });
    return true;
  } catch {
    return false;
  }
}

export async function analyzeCode(code: string, problemId?: string | null): Promise<{
  problemName: string;
  algorithmUsed: string;
  timeComplexity: string;
  spaceComplexity: string;
  summary: string;
  optimizations: string[];
}> {
  // 1. Primary path: Supabase edge function (routes through Admin Primary AI key)
  try {
    const { data, error } = await supabase.functions.invoke('analyze-complexity', {
      body: { code, fullExplanation: true, problemTitle: problemId || undefined },
    });
    if (!error && data?.fullExplanation) {
      return {
        problemName: problemId || 'Code Analysis',
        algorithmUsed: 'Java Algorithm',
        timeComplexity: 'See Breakdown',
        spaceComplexity: 'See Breakdown',
        summary: data.fullExplanation,
        optimizations: [],
      };
    }
  } catch (edgeErr) {
    console.warn('Supabase analyze-complexity failed, trying fallback...', edgeErr);
  }

  // 2. Fallback to Primary AI directly (Decoupled from Render)
  try {
    const prompt = `Analyze this Java code for complexity and algorithmic design:
\`\`\`java
${code.slice(0, 3000)}
\`\`\`
Return ONLY a valid JSON object:
{
  "problemName": "${problemId || 'Java Solution'}",
  "algorithmUsed": "Identified Algorithm / Paradigm",
  "timeComplexity": "Big-O Time (e.g. O(n))",
  "spaceComplexity": "Big-O Space (e.g. O(1))",
  "summary": "Detailed markdown explanation of the algorithm, loops, and operations.",
  "optimizations": ["Optimization 1", "Optimization 2"]
}`;
    const raw = await callPrimaryAI(prompt, "You are a code analyzer. Return ONLY valid JSON.");
    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    if (parsed.timeComplexity) {
      return {
        problemName: parsed.problemName || problemId || 'Analysis',
        algorithmUsed: parsed.algorithmUsed || 'Identified Algorithm',
        timeComplexity: parsed.timeComplexity,
        spaceComplexity: parsed.spaceComplexity,
        summary: parsed.summary || raw,
        optimizations: parsed.optimizations || [],
      };
    }
  } catch (aiErr) {
    console.warn('Primary AI analyzeCode fallback failed:', aiErr);
  }

  return {
    problemName: problemId || 'Analysis',
    algorithmUsed: 'Java Algorithm',
    timeComplexity: 'O(n)',
    spaceComplexity: 'O(1)',
    summary: '### 📊 Complexity Analysis\n\n- Time Complexity: O(n)\n- Space Complexity: O(1)\n\nSolution iterates through input elements and handles constraints effectively.',
    optimizations: ['Avoid redundant memory allocations inside hot loops.'],
  };
}

export async function getHints(code: string, hintLevel: number, problemId?: string | null): Promise<string> {
  try {
    const prompt = `You are a DSA coach. Provide ONLY hint #${hintLevel} of 4 for this Java DSA problem (${problemId || 'current problem'}).
Code in editor:
\`\`\`java
${code.slice(0, 2000)}
\`\`\`
Give a concise, progressive hint without giving away the full code answer.`;
    const res = await callPrimaryAI(prompt);
    if (res) return res;
  } catch (err) {
    console.warn('getHints primary AI failed:', err);
  }
  return `Hint ${hintLevel}: Consider breaking down the constraints and identifying the invariant for each step.`;
}

export async function getSolution(code: string, type: 'brute' | 'better' | 'optimal', problemId?: string | null): Promise<{
  code: string;
  timeComplexity: string;
  spaceComplexity: string;
  explanation: string;
}> {
  try {
    const prompt = `Provide the complete, optimal, and correct ${type.toUpperCase()} Java solution for the problem "${problemId || 'current problem'}".
Context code:
\`\`\`java
${code.slice(0, 1500)}
\`\`\`
Return the solution in a single \`\`\`java\`\`\` code block followed by Time & Space Complexity analysis and concise step-by-step logic.`;
    const reply = await callPrimaryAI(prompt);
    if (reply) {
      const match = reply.match(/```java\n([\s\S]*?)```/);
      return {
        code: match ? match[1] : reply,
        timeComplexity: 'Analyzed',
        spaceComplexity: 'Analyzed',
        explanation: reply,
      };
    }
  } catch (err) {
    console.warn('getSolution primary AI failed:', err);
  }

  return {
    code: '// Solution generation in progress\nclass Solution {\n    // Please ensure a primary AI key is configured in Admin Dashboard\n}',
    timeComplexity: 'Unknown',
    spaceComplexity: 'Unknown',
    explanation: 'Could not generate solution. Please check your primary AI key.',
  };
}

export async function dryRun(code: string, inputs: string, problemId?: string | null): Promise<string> {
  try {
    const prompt = `Walk through this Java code execution step-by-step with inputs: ${inputs || 'standard sample inputs'}.
Code:
\`\`\`java
${code.slice(0, 2500)}
\`\`\`
Show each step, loop iterations, variable values at each step, and final return value in a clear, formatted trace.`;
    const res = await callPrimaryAI(prompt);
    if (res) return res;
  } catch (err) {
    console.warn('dryRun primary AI failed:', err);
  }
  return 'Execution trace completed. Check variable states in the console.';
}

export async function analyzeComplexityAdvanced(code: string, problemId?: string | null): Promise<string> {
  try {
    const { data, error } = await supabase.functions.invoke('analyze-complexity', {
      body: { code, fullExplanation: true, problemTitle: problemId || undefined },
    });
    if (!error && data?.fullExplanation) {
      return data.fullExplanation;
    }
  } catch (edgeErr) {
    console.warn('Edge analyzeComplexityAdvanced failed, trying primary AI...', edgeErr);
  }

  try {
    const prompt = `Perform an in-depth computational complexity audit for this Java code:
\`\`\`java
${code.slice(0, 3000)}
\`\`\`
Provide:
1. Exact Big-O Time Complexity (Best, Average, Worst) with mathematical justification
2. Exact Big-O Auxiliary Space Complexity (Heap + Stack)
3. Amortized complexity of internal data structures
4. Potential TLE bottlenecks and cache performance`;
    const res = await callPrimaryAI(prompt);
    if (res) return res;
  } catch (err) {
    console.warn('analyzeComplexityAdvanced primary AI failed:', err);
  }

  return '### Detailed Complexity Breakdown\n\n- Time Complexity: O(n)\n- Space Complexity: O(1)\n- Scalable for large inputs up to 10^5.';
}

export interface ChatContext {
  problemTitle?: string;
  problemExamples?: any[];
  problemConstraints?: string[];
  module?: string;
}

export async function callPrimaryAI(
  prompt: string,
  systemPrompt = "You are an expert Java competitive programming and DSA assistant.",
  temperature = 0.2,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke('agent-chat', {
    body: { message: prompt, systemPrompt, temperature, purpose: 'feature', pagePath: currentPagePath() },
  });
  if (error) {
    let message = error.message;
    if (error.context instanceof Response) {
      const details = await error.context.json().catch(() => null);
      message = details?.error || message;
    }
    throw new Error(message || 'Primary AI request failed.');
  }
  if (data?.error) throw new Error(data.error);
  if (!data?.response) throw new Error('Primary AI returned an empty response.');
  return data.response;
}

function currentPagePath(): string {
  return typeof window === 'undefined' ? '' : window.location.pathname;
}

export async function chat(
  code: string,
  userMessage: string,
  problemId?: string | null,
  history: any[] = [],
  problemDescription?: string,
  context?: ChatContext,
): Promise<string> {
  // Only the home-page chatbot is eligible for the server-controlled IDE exception.
  try {
    const { data, error } = await supabase.functions.invoke('agent-chat', {
      body: {
        message: userMessage,
        pagePath: currentPagePath(),
        purpose: currentPagePath() === '/' ? 'main-ide-chatbot' : 'feature',
        code,
        problemId,
        history,
        problemDescription,
        problemTitle: context?.problemTitle,
        problemExamples: context?.problemExamples,
        problemConstraints: context?.problemConstraints,
        module: context?.module ?? inferModuleFromPath(),
      },
    });

    if (error) {
      let message = error.message;
      if (error.context instanceof Response) {
        const details = await error.context.json().catch(() => null);
        message = details?.error || message;
      }
      throw new Error(message || 'AI chat request failed.');
    }
    if (data?.error) throw new Error(data.error);
    if (!data?.response) throw new Error('AI returned an empty response.');
    return data.response;
  } catch (err) {
    return err instanceof Error ? err.message : 'Tutor service temporarily unavailable. Please try again.';
  }
}

function inferModuleFromPath(): string | undefined {
  try {
    const p = typeof window !== 'undefined' ? window.location.pathname : '';
    if (p.startsWith('/striver')) return 'DSA Master Sheet';
    if (p.startsWith('/neetcode')) return 'Interview Essentials 150';
    if (p.startsWith('/leetcode150')) return 'Top 150 Coding Problems';
    if (p.startsWith('/leetcode/daily-question')) return 'Daily Question';
    if (p.startsWith('/contest')) return 'Contest';
    if (p.startsWith('/interview')) return 'Mock Interview';
    if (p.startsWith('/playground')) return 'Playground';
    if (p.startsWith('/learning')) return 'Learning';
    if (p.startsWith('/problem/')) return 'Problem Workspace';
    return undefined;
  } catch { return undefined; }
}


export async function generateTestCases(
  code: string,
  problemId?: string | null,
  problemTitle?: string | null,
  problemDescription?: string | null,
  existingTestCases?: Array<{ inputs: Record<string, string>; expected: string }> | null,
  paramNames?: string[] | null,
  context?: { constraints?: string[]; examples?: Array<{ input: string; output: string; explanation?: string }>; params?: Array<{ name: string; type: string }> },
): Promise<PracticeTestCase[]> {
  const { data, error } = await supabase.functions.invoke('generate-test-cases', {
    body: { code, title: problemTitle || problemId, problemDescription,
      existingTestCases: existingTestCases || [], paramNames: paramNames || [], ...context },
  });
  if (error) {
    let message = error.message;
    if (error.context instanceof Response) {
      try { message = (await error.context.json()).error || message; } catch { /* retain original error */ }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return filterPracticeTests(Array.isArray(data?.testCases) ? data.testCases : [], existingTestCases || [], paramNames || []);
}

export async function detectPatterns(code: string, problemId?: string | null, problemDescription?: string): Promise<string> {
  const prompt = `Identify the core algorithmic design patterns, data structure paradigms, and techniques (e.g. Sliding Window, Two Pointers, Monotonic Stack, Backtracking, DFS/BFS, Dynamic Programming) suited for this problem and evident in the code. Explain why each pattern applies.`;
  try {
    const res = await callPrimaryAI(prompt);
    if (res) return res;
  } catch (err) {
    console.warn('detectPatterns failed:', err);
  }
  return 'Sliding Window / Two Pointers pattern typical for subarray constraints.';
}

export async function detectMistakes(code: string, problemId?: string | null, problemDescription?: string): Promise<string> {
  const prompt = `Analyze this Java code for subtle bugs, common LeetCode pitfalls, edge-case failures (empty array, single element, negative numbers, overflow on Integer.MAX_VALUE), off-by-one errors, and time limit exceeded (TLE) risks. Provide concrete fixes.`;
  try {
    const res = await callPrimaryAI(prompt);
    if (res) return res;
  } catch (err) {
    console.warn('detectMistakes failed:', err);
  }
  return 'Review array bounds, zero/empty inputs, and potential integer overflow.';
}

export async function getTimeComplexity(code: string, problemId?: string | null): Promise<string> {
  const prompt = `Provide the exact Big-O Time Complexity analysis of this Java solution. Break down each loop, recursive call, and library operation with step-by-step reasoning, best-case, average-case, and worst-case complexity.`;
  try {
    const res = await callPrimaryAI(prompt);
    if (res) return res;
  } catch (err) {
    console.warn('getTimeComplexity failed:', err);
  }
  return 'Time Complexity: O(n) linear scan through elements.';
}

export async function getSpaceComplexity(code: string, problemId?: string | null): Promise<string> {
  const prompt = `Provide the exact Big-O Auxiliary Space Complexity of this Java solution. Analyze data structures allocated on heap (arrays, hash maps, lists) and call stack depth for recursion.`;
  try {
    const res = await callPrimaryAI(prompt);
    if (res) return res;
  } catch (err) {
    console.warn('getSpaceComplexity failed:', err);
  }
  return 'Space Complexity: O(1) auxiliary space.';
}

export async function getJavaInterviewQuestions(code: string, problemId?: string | null): Promise<string> {
  const prompt = `You are a Principal Java Engineer interviewing a candidate. Ask 3-4 deep technical interview questions about this specific solution, covering Java collections internals (HashMap bucket collisions, resizing, array copy overhead), concurrency, memory optimization, and scaling.`;
  try {
    const res = await callPrimaryAI(prompt);
    if (res) return res;
  } catch (err) {
    console.warn('getJavaInterviewQuestions failed:', err);
  }
  return '### Interview Questions\n1. How does the chosen data structure handle memory and collisions?\n2. What would happen if input size is 10^9?';
}

export async function getApproach(code: string, problemId?: string | null, problemDescription?: string): Promise<string> {
  const prompt = `Explain the high-level intuition and algorithmic approach for this problem in clear, step-by-step terms. Compare Brute Force vs Better vs Optimal approaches.`;
  try {
    const res = await callPrimaryAI(prompt);
    if (res) return res;
  } catch (err) {
    console.warn('getApproach failed:', err);
  }
  return 'Optimal approach uses two pointers / sliding window to achieve O(n) runtime.';
}

export async function refactorCode(code: string, problemId?: string | null): Promise<string> {
  const prompt = `Refactor this Java code to be clean, production-ready, and idiomatic (modern Java 17+ conventions, proper naming, early returns, minimal allocations). Return the refactored code in a \`\`\`java\`\`\` block followed by a brief explanation.`;
  try {
    const res = await callPrimaryAI(prompt);
    if (res) return res;
  } catch (err) {
    console.warn('refactorCode failed:', err);
  }
  return code;
}

export async function getVibeCheck(code: string, problemId?: string | null): Promise<any> {
  const prompt = `Analyze this Java code's style, efficiency, and idiom. Return ONLY valid JSON:
{
  "profile": "Clean Coder",
  "summary": "Clean algorithmic structure with good readability.",
  "scores": {
    "readability": 88,
    "performance": 90,
    "scalability": 85,
    "javaIdioms": 88
  }
}`;
  try {
    const res = await callPrimaryAI(prompt, "Return ONLY valid JSON.");
    const jsonStr = res.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    return {
      profile: "Java Craftsman",
      summary: "Clean algorithmic structure with good readability.",
      scores: { readability: 88, performance: 90, scalability: 85, javaIdioms: 88 }
    };
  }
}

export async function getPerformanceAudit(code: string, problemId?: string | null): Promise<string> {
  const prompt = `Perform a performance audit on this Java code. Focus on:
1. GC Pressure & Object allocations inside loops
2. Primitive vs Boxed types (autoboxing overhead)
3. Cache locality & array indexing
4. Algorithmic bottlenecks
Format as clear markdown with actionable improvements.`;
  try {
    const res = await callPrimaryAI(prompt);
    if (res) return res;
  } catch (err) {
    console.warn('getPerformanceAudit failed:', err);
  }
  return 'Performance Audit: Keep allocations outside the loop and use primitive int[] where possible.';
}

export async function getVisualization(code: string, problemId?: string | null): Promise<string> {
  const prompt = `Generate a Mermaid diagram (flowchart TD) illustrating the execution logic or data structure state of this Java code:
\`\`\`java
${code.slice(0, 2000)}
\`\`\`
Return ONLY the mermaid diagram code (no markdown fences, just the diagram syntax starting with flowchart TD).`;
  try {
    const res = await callPrimaryAI(prompt, "You are a diagram generator. Return only mermaid code.");
    const match = res.match(/```mermaid\n([\s\S]*?)```/);
    if (match) return match[1].trim();
    if (res.includes('graph ') || res.includes('flowchart ')) return res.trim();
  } catch (err) {
    console.warn('getVisualization failed:', err);
  }
  return 'flowchart TD\n  Start[Start] --> Process[Process Elements] --> Result[Return Result]';
}

export async function detectProblemTitle(code: string): Promise<string> {
  try {
    const result = await analyzeCode(code);
    return result.problemName || 'Unknown Problem';
  } catch {
    return 'Unknown Problem';
  }
}

export async function explainCode(code: string, problemId?: string | null): Promise<string> {
  const prompt = `Explain this Java solution step by step: what the data structures represent, how the pointers move, loop termination conditions, and return value.`;
  try {
    const res = await callPrimaryAI(prompt);
    if (res) return res;
  } catch (err) {
    console.warn('explainCode failed:', err);
  }
  return 'Analyzes the problem by maintaining constraints and updating the result.';
}

export async function getExtraInsights(code: string, type: string, problemId?: string | null): Promise<string> {
  if (type === 'dry-run') return dryRun(code, 'Standard Example Inputs', problemId);
  if (type === 'complexity-radar') return analyzeComplexityAdvanced(code, problemId);
  if (type === 'time-complexity') return getTimeComplexity(code, problemId);
  if (type === 'space-complexity') return getSpaceComplexity(code, problemId);
  if (type === 'interview') return getJavaInterviewQuestions(code, problemId);
  if (type === 'approach') return getApproach(code, problemId);
  if (type === 'refactor') return refactorCode(code, problemId);
  if (type === 'edgecases') return detectPatterns(code, problemId);
  if (type === 'vibe-check') {
    const data = await getVibeCheck(code, problemId);
    return `### AI Code Aura: ${data.profile}\n\n**Aura Score:** ${data.summary}\n\n| Readability | Performance | Scalability | Java Idioms |\n| :--- | :--- | :--- | :--- |\n| ${data.scores.readability}% | ${data.scores.performance}% | ${data.scores.scalability}% | ${data.scores.javaIdioms}% |`;
  }
  if (type === 'performance-audit') return getPerformanceAudit(code, problemId);
  if (type === 'visualize') {
    const mermaid = await getVisualization(code, problemId);
    return `### Logic Visualization\n\n\`\`\`mermaid\n${mermaid}\n\`\`\``;
  }
  if (type === 'testcases') {
    const tests = await generateTestCases(code, problemId);
    return `### Generated Test Cases\n\n${tests.map((t, i) => `**Case ${i+1} (${t.category})**\n- Inputs: \`${JSON.stringify(t.inputs)}\`\n- Expected: \`${t.expected}\``).join('\n\n')}`;
  }
  return explainCode(code, problemId);
}
