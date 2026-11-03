import { describe, expect, it } from 'vitest';
import { isEmailUnconfirmed } from '@/lib/auth-errors';

describe('email confirmation recovery', () => {
  it('identifies the hosted auth confirmation error code', () => {
    expect(isEmailUnconfirmed({ code: 'email_not_confirmed' })).toBe(true);
  });
  it('supports older errors that only include the message', () => {
    expect(isEmailUnconfirmed(new Error('Email not confirmed'))).toBe(true);
  });
  it('does not offer confirmation recovery for incorrect credentials', () => {
    expect(isEmailUnconfirmed({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe(false);
    expect(isEmailUnconfirmed(null)).toBe(false);
  });
});