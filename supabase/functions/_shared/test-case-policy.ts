export interface PracticeTestCase {
  inputs: Record<string, string>;
  expected: string;
  difficulty?: 'easy' | 'medium';
  category?: string;
}

function canonicalValue(value: string): string {
  try { return JSON.stringify(JSON.parse(value)); } catch { return value; }
}

export function inputSignature(inputs: Record<string, string>): string {
  return JSON.stringify(Object.keys(inputs).sort().map(key => [key, canonicalValue(inputs[key])]));
}

// A deliberately small practice budget, not a replacement for the question's constraints.
function isPracticeSized(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(value);
    const small = (item: unknown): boolean => {
      if (Array.isArray(item)) return item.length <= 20 && item.every(small);
      if (typeof item === 'number') return Number.isFinite(item) && Math.abs(item) <= 10000;
      if (typeof item === 'string') return item.length <= 80;
      return item === null || typeof item === 'boolean';
    };
    return small(parsed);
  } catch { return value.length <= 80; }
}

export function filterPracticeTests(
  candidates: unknown[], existing: Array<{ inputs: Record<string, string> }>, paramNames: string[],
): PracticeTestCase[] {
  const seen = new Set(existing.map(test => inputSignature(test.inputs)));
  const accepted: PracticeTestCase[] = [];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const test = candidate as Record<string, unknown>;
    if (test.difficulty !== 'easy' && test.difficulty !== 'medium') continue;
    if (typeof test.category === 'string' && /hard|stress|large|adversarial|killer|overflow/i.test(test.category)) continue;
    if (!test.inputs || typeof test.inputs !== 'object' || Array.isArray(test.inputs)) continue;
    const entries = Object.entries(test.inputs);
    if (!entries.length || entries.some(([, value]) => typeof value !== 'string' || !isPracticeSized(value))) continue;
    const inputs = Object.fromEntries(entries) as Record<string, string>;
    if (paramNames.length && (entries.length !== paramNames.length || paramNames.some(name => !(name in inputs)))) continue;
    const expected = test.expected ?? test.expectedOutput;
    if (typeof expected !== 'string') continue;
    const signature = inputSignature(inputs);
    if (seen.has(signature)) continue;
    seen.add(signature);
    accepted.push({ inputs, expected, difficulty: test.difficulty, category: String(test.category || 'normal') });
  }
  return accepted;
}