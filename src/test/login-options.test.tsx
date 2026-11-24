import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '@/pages/Login';

const mocks = vi.hoisted(() => ({ google: vi.fn(), reset: vi.fn() }));
vi.mock('@/integrations/lovable/index', () => ({ lovable: { auth: { signInWithOAuth: mocks.google } } }));
vi.mock('@/lib/supabase', () => ({ signUp: vi.fn(), signIn: vi.fn(), supabase: { auth: { resetPasswordForEmail: mocks.reset } } }));
vi.mock('@/lib/user-context', () => ({ useUser: () => ({ enterGuestMode: vi.fn() }) }));
vi.mock('@/components/EmailConfirmationNotice', () => ({ EmailConfirmationNotice: () => null }));

describe('login options', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.google.mockResolvedValue({ redirected: true }); mocks.reset.mockResolvedValue({ error: null }); });
  afterEach(cleanup);
  const open = () => render(<MemoryRouter><Login /></MemoryRouter>);
  it('starts Google login using the public same-origin callback', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
    await waitFor(() => expect(mocks.google).toHaveBeenCalledWith('google', { redirect_uri: window.location.origin, extraParams: { prompt: 'select_account' } }));
  });
  it('starts Google signup through the same account provider', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: "Don't have an account? Sign up" }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign up with Google' }));
    await waitFor(() => expect(mocks.google).toHaveBeenCalledWith('google', expect.objectContaining({ redirect_uri: window.location.origin })));
  });
  it('sends recovery mail to the entered email with the password reset destination', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'learner@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));
    await waitFor(() => expect(mocks.reset).toHaveBeenCalledWith('learner@example.com', { redirectTo: `${window.location.origin}/reset-password` }));
  });
});