import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  if (!isRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">Invalid or expired reset link.</p>
          <Button onClick={() => navigate('/')} variant="outline">Go to Login</Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center animate-fade-in">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-success" />
          <h2 className="text-lg font-bold text-foreground">Password Reset!</h2>
          <p className="text-sm text-muted-foreground mt-1">Sign in with your new password.</p>
          <Button onClick={() => navigate('/')} className="mt-4">Back to Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md animate-fade-in">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Set New Password</h2>

          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                className="pl-9"
                disabled={loading}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Confirm Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleReset()}
                placeholder="••••••••"
                className="pl-9"
                disabled={loading}
              />
            </div>
          </div>

          {error && <p className="mb-3 text-xs text-destructive">{error}</p>}

          <Button onClick={handleReset} className="w-full" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting...</> : 'Reset Password'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
