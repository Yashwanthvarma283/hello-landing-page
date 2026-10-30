// Helpers that turn a LeetCode-style problem (starter code + examples) into
// runnable test cases keyed by the method's real parameter names.

export interface ParsedSignature {
  functionName: string;
  returnType: string;
  params: { name: string; type: string }[];
}

export function parseStarterSignature(code: string): ParsedSignature | null {
  const clean = String(code || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const m = clean.match(/(?:public|private|protected|static)\s+(?:static\s+)?([\w<>[\],\s]+?)\s+(\w+)\s*\(([^)]*)\)\s*\{/);
  if (!m) return null;
  const params = m[3].trim()
    ? m[3].split(/,(?![^<]*>)/).map((p) => p.trim().split(/\s+/)).filter((a) => a.length >= 2)
        .map((a) => ({ name: a[a.length - 1], type: a.slice(0, -1).join(' ') }))
    : [];
  return { returnType: m[1].trim(), functionName: m[2], params };
}

/** "nums = [2,7,11,15], target = 9" → { nums: "[2,7,11,15]", target: "9" } */
export function parseExampleInput(raw: string, paramNames: string[]): Record<string, string> {
  const inputs: Record<string, string> = {};
  const text = String(raw || '').trim();
  const parts = text.split(/,\s*(?=[a-zA-Z_]\w*\s*=)/);
  for (const part of parts) {
    const m = part.match(/^\s*([a-zA-Z_]\w*)\s*=\s*([\s\S]+?)\s*$/);
    if (m && paramNames.includes(m[1])) inputs[m[1]] = m[2];
  }
  if (Object.keys(inputs).length === 0 && paramNames.length === 1) {
    inputs[paramNames[0]] = text.replace(/^[a-zA-Z_]\w*\s*=\s*/, '');
  }
  return inputs;
}

export function examplesToTestCases(
  examples: { input: string; output: string }[],
  paramNames: string[],
): { inputs: Record<string, string>; expected: string }[] {
  return (examples || [])
    .map((ex) => ({ inputs: parseExampleInput(ex.input, paramNames), expected: String(ex.output ?? '').trim() }))
    .filter((tc) => tc.expected && Object.keys(tc.inputs).length === paramNames.length && paramNames.length > 0);
}
