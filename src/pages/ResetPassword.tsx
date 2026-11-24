import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthLayout, AuthCard, AuthHeading, AuthAlert } from '@/components/auth/AuthLayout';
import { AuthField } from '@/components/auth/AuthField';
import { supabase } from '@/integrations/supabase/client';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);

  useEffect(() => {
    let active = true;
    const recoveryHash = new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';
    const validateRecovery = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (active) {
        setIsRecovery(!error && !!data.user);
        setCheckingLink(false);
      }
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Defer auth calls until the auth event's internal lock is released.
        setTimeout(() => { if (active) void validateRecovery(); }, 0);
      }
    });
    // getSession waits for URL token processing; the user is then validated remotely.
    supabase.auth.getSession().then(() => {
      if (!active) return;
      if (recoveryHash) void validateRecovery();
      else setCheckingLink(false);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const handleReset = async () => {
    if (!isRecovery || checkingLink || loading) return;
    setError('');
    if (!password) { setError('Password is required'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      setSuccess(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password');
    }
    setLoading(false);
  };

  if (checkingLink) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 aria-label="Checking reset link" className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <AuthLayout tagline="Secure your account with a new password">
      <AuthCard>
        {!isRecovery ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10"><AlertTriangle className="h-6 w-6 text-destructive" /></div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Invalid or expired reset link.</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Reset links can be used once and expire after a short time. Request a new one from the sign-in page.</p>
            <Button onClick={() => navigate('/')} variant="outline" className="mt-5 h-10 w-full rounded-xl">Go to sign in</Button>
          </div>
        ) : success ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10"><CheckCircle2 className="h-6 w-6 text-success" /></div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Password updated</h2>
            <p className="mt-2 text-sm text-muted-foreground">Sign in with your new password.</p>
            <Button onClick={() => navigate('/')} className="mt-5 h-10 w-full rounded-xl">Back to Sign In</Button>
          </div>
        ) : (
          <form noValidate onSubmit={e => { e.preventDefault(); if (!loading) handleReset(); }}>
            <AuthHeading title="Set a new password" subtitle="Choose a strong password you haven't used before." />
            <AuthField label="New password" icon={Lock} type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} placeholder="••••••••" autoComplete="new-password" disabled={loading} hint="At least 6 characters." />
            <AuthField label="Confirm password" icon={Lock} type="password" value={confirmPassword} onChange={e => { setConfirmPassword(e.target.value); setError(''); }} placeholder="••••••••" autoComplete="new-password" disabled={loading} />
            {error && <AuthAlert>{error}</AuthAlert>}
            <Button type="submit" className="mt-1 h-11 w-full rounded-xl text-[14px] font-semibold min-[600px]:h-10" disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…</> : 'Update password'}
            </Button>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  );
};

export default ResetPassword;
