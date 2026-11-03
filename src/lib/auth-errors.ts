export function isEmailUnconfirmed(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const authError = error as { code?: string; message?: string };
  return authError.code === 'email_not_confirmed' ||
    authError.message?.toLowerCase() === 'email not confirmed';
}