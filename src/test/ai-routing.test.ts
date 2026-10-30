import { beforeEach, describe, expect, it, vi } from 'vitest';
import { primaryModel, usePrimaryForChat } from '../../supabase/functions/_shared/ai-routing';
import { findPrimaryKey } from '../lib/primary-key';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
vi.mock('../lib/api', () => ({ API_BASE_URL: 'https://example.test' }));
import { callPrimaryAI, chat } from '../lib/ai-backend';

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue({ data: { response: 'Answer from selected provider' }, error: null });
  window.history.replaceState({}, '', '/');
});

describe('Admin primary AI routing', () => {
  it('does not label an unselected first key as primary', () => {
    expect(findPrimaryKey([{ id: 'groq', is_primary: false }])).toBeUndefined();
    expect(findPrimaryKey([{ id: 'first', is_primary: false }, { id: 'selected', is_primary: true }])?.id).toBe('selected');
  });
  it('keeps the default provider available only to the home main IDE', () => {
    expect(usePrimaryForChat('/', 'main-ide-chatbot', false)).toBe(false);
    expect(usePrimaryForChat('/', 'feature', false)).toBe(true);
    expect(usePrimaryForChat(undefined, undefined, false)).toBe(true);
  });

  it.each(['/problem/two-sum', '/playground', '/learning', '/admin', '/modules', '/generate'])(
    'uses primary AI on %s even if the IDE flag is supplied', async (path) => {
      expect(usePrimaryForChat(path, 'main-ide-chatbot', false)).toBe(true);
      window.history.replaceState({}, '', path);
      await chat('class Solution {}', 'Explain this');
      expect(invoke).toHaveBeenCalledWith('agent-chat', expect.objectContaining({
        body: expect.objectContaining({ purpose: 'feature', pagePath: path }),
      }));
    },
  );

  it('honors the global home IDE primary override', () => {
    expect(usePrimaryForChat('/', 'main-ide-chatbot', true)).toBe(true);
  });

  it('uses the model configured by the admin', () => {
    expect(primaryModel('llama-3.3-70b-versatile', 'Primary')).toBe('llama-3.3-70b-versatile');
    expect(() => primaryModel('', 'Primary')).toThrow('No model configured');
  });

  it('marks only home chat as main IDE', async () => {
    await chat('', 'Hello');
    expect(invoke).toHaveBeenCalledWith('agent-chat', expect.objectContaining({
      body: expect.objectContaining({ pagePath: '/', purpose: 'main-ide-chatbot' }),
    }));
  });

  it('keeps feature requests primary-only even from home and preserves their prompt', async () => {
    await callPrimaryAI('Generate test cases', 'Return JSON only', 0.2);
    expect(invoke).toHaveBeenCalledExactlyOnceWith('agent-chat', {
      body: { message: 'Generate test cases', systemPrompt: 'Return JSON only', temperature: 0.2, purpose: 'feature', pagePath: '/' },
    });
  });

  it('does not switch providers after a primary feature error', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('No primary AI key configured') });
    await expect(callPrimaryAI('Explain code')).rejects.toThrow('No primary AI key configured');
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});