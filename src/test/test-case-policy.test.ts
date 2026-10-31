import { describe, expect, it, vi, beforeEach } from 'vitest';
import { filterPracticeTests } from '../../supabase/functions/_shared/test-case-policy';
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
vi.mock('../lib/api', () => ({ API_BASE_URL: 'https://example.test' }));
import { generateTestCases } from '../lib/ai-backend';

const test = (nums: string, difficulty = 'easy') => ({ inputs: { nums, target: '9' }, expected: '[0, 1]', difficulty, category: 'normal' });
beforeEach(() => invoke.mockReset());
describe('DSA practice test rules', () => {
  it('never repeats existing or same-batch inputs, including array whitespace differences', () => {
    const result = filterPracticeTests([test('[2, 7]'), test('[4,5]'), test('[4, 5]')], [test('[2,7]')], ['nums', 'target']);
    expect(result.map(t => t.inputs.nums)).toEqual(['[4,5]']);
  });
  it('strictly accepts easy and medium but rejects hard and unspecified difficulty', () => {
    expect(filterPracticeTests([test('[2,7]', 'easy'), test('[4,5]', 'medium'), test('[1,8]', 'hard'), test('[0,9]', '')], [], ['nums', 'target'])).toHaveLength(2);
  });
  it('rejects stress scenarios and oversized inputs regardless of their difficulty label', () => {
    expect(filterPracticeTests([{ ...test('[2,7]'), category: 'stress' }, test(JSON.stringify(Array(100).fill(1))), test('[2147483647,7]')], [], ['nums', 'target'])).toEqual([]);
  });
  it('rejects tests with unrelated or missing parameter names', () => {
    expect(filterPracticeTests([{ ...test('[2,7]'), inputs: { values: '[2,7]', target: '9' } }, { ...test('[4,5]'), inputs: { nums: '[4,5]' } }], [], ['nums', 'target'])).toEqual([]);
  });
  it('permits valid empty string outputs', () => {
    expect(filterPracticeTests([{ inputs: { s: 'a' }, expected: '', difficulty: 'easy' }], [], ['s'])).toHaveLength(1);
  });
  it('preserves string whitespace because it can change the answer', () => {
    expect(filterPracticeTests([{ inputs: { s: ' a ' }, expected: '3', difficulty: 'easy' }], [{ inputs: { s: 'a' } }], ['s'])).toHaveLength(1);
  });
  it('supports repeated generation and sends the entire question and all existing tests every time', async () => {
    invoke.mockResolvedValueOnce({ data: { testCases: [test('[4,5]')] }, error: null })
      .mockResolvedValueOnce({ data: { testCases: [test('[4, 5]'), test('[1,8]')] }, error: null });
    const context = { constraints: ['Exactly one solution'], examples: [{ input: 'nums=[2,7], target=9', output: '[0,1]' }] };
    const first = await generateTestCases('class Solution {}', 'arr-19', 'Two Sum', 'Return two indices whose values sum to target.', [test('[2,7]')], ['nums', 'target'], context);
    const second = await generateTestCases('class Solution {}', 'arr-19', 'Two Sum', 'Return two indices whose values sum to target.', [...first, test('[2,7]')], ['nums', 'target'], context);
    expect(second.map(t => t.inputs.nums)).toEqual(['[1,8]']);
    expect(invoke).toHaveBeenLastCalledWith('generate-test-cases', { body: expect.objectContaining({ title: 'Two Sum', problemDescription: 'Return two indices whose values sum to target.', existingTestCases: [...first, test('[2,7]')], ...context }) });
  });
});