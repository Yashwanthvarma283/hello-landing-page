import { afterEach, expect, it, vi } from 'vitest';
import { registerOfflineSupport } from '@/lib/register-sw';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('bypasses cached update scripts and checks for a new published version', async () => {
  vi.stubEnv('PROD', true);
  const update = vi.fn().mockResolvedValue(undefined);
  const register = vi.fn().mockResolvedValue({ update });
  const serviceWorker = { controller: null, register, addEventListener: vi.fn() };
  vi.stubGlobal('navigator', { serviceWorker });
  registerOfflineSupport();
  window.dispatchEvent(new Event('load'));
  await Promise.resolve();
  expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/', updateViaCache: 'none' });
  expect(update).toHaveBeenCalledOnce();
});