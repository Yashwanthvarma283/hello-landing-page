import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ResetPassword from '@/pages/ResetPassword';

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), unsubscribe: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {
  ...mocks,
  onAuthStateChange: () => ({ data: { subscription: { unsubscribe: mocks.unsubscribe } } }),
} } }));
describe('password recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '#type=recovery';
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'recovery-user' } }, error: null });
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });
  afterEach(() => { cleanup(); window.location.hash = ''; });
  const open = () => render(<MemoryRouter><ResetPassword /></MemoryRouter>);
  it('rejects an invalid recovery session even when the URL says recovery', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Expired') });
    open();
    await screen.findByText('Invalid or expired reset link.');
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it('updates the password without requesting the old password and signs out', async () => {
    open();
    const fields = await screen.findAllByPlaceholderText('••••••••');
    fields.forEach(field => fireEvent.change(field, { target: { value: 'NewStrongPassword2026' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() => expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'NewStrongPassword2026' }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
  });
  it('does not submit mismatched passwords', async () => {
    open();
    const fields = await screen.findAllByPlaceholderText('••••••••');
    fireEvent.change(fields[0], { target: { value: 'NewStrongPassword2026' } });
    fireEvent.change(fields[1], { target: { value: 'DifferentPassword2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});