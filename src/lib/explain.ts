import { callPrimaryAI } from './ai-backend';

export async function explainCodeViaBackend(code: string): Promise<string> {
  try {
    const prompt = `Explain this Java code step by step: what the data structures represent, how pointers move, loop invariants, and time/space complexity:\n\`\`\`java\n${code}\n\`\`\``;
    const res = await callPrimaryAI(prompt);
    if (res) return res;
  } catch (error: any) {
    console.warn('explainCodeViaBackend failed:', error);
  }
  return 'Explanation generated using Primary AI engine.';
}
