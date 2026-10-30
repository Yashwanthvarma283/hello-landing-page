import { describe, it, expect } from 'vitest';
import { parseStarterSignature, examplesToTestCases } from '@/lib/leetcode-parse';

describe('leetcode-parse', () => {
  it('reads the method signature from starter code', () => {
    const sig = parseStarterSignature('class Solution {\n    public int[] twoSum(int[] nums, int target) {\n    }\n}');
    expect(sig).toEqual({ functionName: 'twoSum', returnType: 'int[]', params: [{ name: 'nums', type: 'int[]' }, { name: 'target', type: 'int' }] });
  });
  it('keys example test cases by real parameter names', () => {
    const tcs = examplesToTestCases([{ input: 'nums = [2,7,11,15], target = 9', output: '[0,1]' }], ['nums', 'target']);
    expect(tcs).toEqual([{ inputs: { nums: '[2,7,11,15]', target: '9' }, expected: '[0,1]' }]);
  });
  it('drops examples that do not match the parameters', () => {
    expect(examplesToTestCases([{ input: 'x = 1', output: '2' }], ['nums', 'target'])).toEqual([]);
  });
});
