import { describe, it, expect } from 'vitest';
import { completionGroups, JAVA_LIVE_TEMPLATES } from '@/lib/java-completions';

describe('editor completions', () => {
  it('includes IntelliJ shortcuts like sout and psvm', () => {
    const keys = JAVA_LIVE_TEMPLATES.map((t) => t.key);
    expect(keys).toEqual(expect.arrayContaining(['sout', 'psvm', 'fori', 'iter', 'soutv']));
    expect(JAVA_LIVE_TEMPLATES.find((t) => t.key === 'sout')!.body).toContain('System.out.println(');
  });
  it('turning shortcuts off removes them but keeps suggestions', () => {
    const g = completionGroups({ suggestions: true, liveTemplates: false });
    expect(g.templates).toHaveLength(0);
    expect(g.keywords.length).toBeGreaterThan(0);
  });
  it('turning suggestions off removes keyword suggestions but keeps shortcuts', () => {
    const g = completionGroups({ suggestions: false, liveTemplates: true });
    expect(g.keywords).toHaveLength(0);
    expect(g.classes).toHaveLength(0);
    expect(g.templates.length).toBeGreaterThan(0);
  });
});
