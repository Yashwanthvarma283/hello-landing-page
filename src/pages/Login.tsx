import { useState } from 'react';
import { Loader2, Mail, Lock, User, ArrowLeft, ArrowRight, Users, MailCheck, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthLayout, AuthCard, AuthHeading, AuthAlert } from '@/components/auth/AuthLayout';
import { AuthField } from '@/components/auth/AuthField';
import { signUp, signIn, supabase } from '@/lib/supabase';
import { useUser } from '@/lib/user-context';
import { useNavigate } from 'react-router-dom';
import { EmailConfirmationNotice } from '@/components/EmailConfirmationNotice';
import { isEmailUnconfirmed } from '@/lib/auth-errors';
import { lovable } from '@/integrations/lovable/index';

const Login = () => {
  const { enterGuestMode } = useUser();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
        extraParams: { prompt: 'select_account' },
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      // The shared user context checks approval after the helper sets the session.
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setConfirmationEmail('');
    if (!email.trim()) { setError('Email is required'); return; }

    if (mode === 'forgot') {
      setLoading(true);
      try {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) throw resetError;
        setResetSent(true);
      } catch (err: any) {
        setError(err?.message || 'Failed to send reset email');
      }
      setLoading(false);
      return;
    }

    if (!password.trim()) { setError('Password is required'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }

    if (mode === 'signup') {
      const trimmedUsername = username.trim();
      if (!trimmedUsername) { setError('Username is required'); return; }
      if (trimmedUsername.length < 3) { setError('Username must be at least 3 characters'); return; }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) { setError('Username can only contain letters, numbers, and underscores'); return; }
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        await signUp(email.trim(), password, username.trim(), 'user');
        setSignupSuccess(true);
      } else {
        await signIn(email.trim(), password);
      }
    } catch (err: any) {
      if (isEmailUnconfirmed(err)) setConfirmationEmail(email.trim());
      else setError(err?.message || 'Authentication failed. Please try again.');
    }
    setLoading(false);
  };

  const switchMode = (next: 'login' | 'signup' | 'forgot') => {
    setMode(next); setError(''); setResetSent(false); setSignupSuccess(false); setConfirmationEmail('');
  };
  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !loading) handleSubmit(); };
  const busy = loading || googleLoading;
  const heading = mode === 'forgot'
    ? { title: 'Reset your password', subtitle: "Enter your account email and we'll send you a reset link." }
    : mode === 'signup'
      ? { title: 'Create your account', subtitle: 'Start practising DSA in Java in under a minute.' }
      : { title: 'Welcome back', subtitle: 'Sign in to continue your practice.' };

  return (
    <AuthLayout>
      <AuthCard>
        {mode === 'forgot' && !resetSent && (
          <button type="button" onClick={() => switchMode('login')} className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </button>
        )}

        {signupSuccess ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10"><MailCheck className="h-6 w-6 text-success" /></div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Check your inbox</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">We sent a confirmation link to <span className="font-medium text-foreground">{email.trim()}</span>. After you confirm, an admin will review and approve your access.</p>
            <div className="mt-5 text-left"><EmailConfirmationNotice key={email.trim()} email={email.trim()} /></div>
            <Button variant="outline" onClick={() => switchMode('login')} className="mt-4 h-10 w-full rounded-xl">Back to sign in</Button>
          </div>
        ) : resetSent ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10"><MailCheck className="h-6 w-6 text-success" /></div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Check your email</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">If an account exists for <span className="font-medium text-foreground">{email.trim()}</span>, you'll receive a password reset link. Check your inbox and spam folder.</p>
            <Button variant="outline" onClick={() => switchMode('login')} className="mt-5 h-10 w-full rounded-xl">Back to sign in</Button>
            <button type="button" onClick={() => { setResetSent(false); }} className="mt-3 text-xs text-muted-foreground hover:text-foreground">Didn't get it? Try again</button>
          </div>
        ) : (
          <form noValidate onSubmit={e => { e.preventDefault(); if (!loading) handleSubmit(); }}>
            {mode !== 'forgot' && (
              <div className="mb-5 grid grid-cols-2 rounded-xl bg-secondary p-1 text-sm font-medium min-[600px]:mb-4" role="tablist">
                {(['login', 'signup'] as const).map(m => (
                  <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => switchMode(m)} disabled={busy}
                    className={`h-8 rounded-lg transition-all ${mode === m ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground'}`}>
                    {m === 'login' ? 'Sign in' : 'Sign up'}
                  </button>
                ))}
              </div>
            )}

            <AuthHeading {...heading} />

            {mode !== 'forgot' && (
              <>
                <Button type="button" variant="outline" onClick={handleGoogle} disabled={busy} className="google-auth-button mb-4 h-11 w-full rounded-xl min-[600px]:mb-3 min-[600px]:h-10">
                  {googleLoading ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : (
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                        <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
                        <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
                      </svg>
                  )}
                  {googleLoading ? 'Connecting…' : mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}
                </Button>
                <div className="mb-4 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground min-[600px]:mb-3"><span className="h-px flex-1 bg-border" />or continue with email<span className="h-px flex-1 bg-border" /></div>
              </>
            )}

            {mode === 'signup' && (
              <AuthField label="Username" icon={User} value={username} onChange={e => { setUsername(e.target.value); setError(''); }} placeholder="e.g. dev_coder" autoComplete="username" disabled={loading} hint="3+ characters: letters, numbers and underscores." />
            )}
            <AuthField label="Email" icon={Mail} type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} onKeyDown={mode === 'forgot' ? onEnter : undefined} placeholder="you@example.com" autoComplete="email" disabled={loading} />
            {mode !== 'forgot' && (
              <AuthField
                label="Password" icon={Lock} type="password" value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }} onKeyDown={onEnter}
                placeholder="••••••••" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} disabled={loading}
                hint={mode === 'signup' ? 'At least 6 characters.' : undefined}
                action={mode === 'login' ? <button type="button" onClick={() => switchMode('forgot')} className="text-xs font-medium text-muted-foreground hover:text-foreground" disabled={loading}>Forgot password?</button> : undefined}
              />
            )}

            {error && <AuthAlert>{error}</AuthAlert>}
            {mode === 'login' && confirmationEmail && confirmationEmail === email.trim() && (
              <div className="mb-4"><EmailConfirmationNotice key={confirmationEmail} email={confirmationEmail} /></div>
            )}

            <Button type="submit" className="group mt-1 h-11 w-full rounded-xl text-[14px] font-semibold min-[600px]:h-10" disabled={busy}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {mode === 'forgot' ? 'Sending…' : mode === 'signup' ? 'Creating account…' : 'Signing in…'}</>
              ) : (
                <span className="flex items-center gap-2">
                  {mode === 'forgot' ? 'Send reset link' : mode === 'signup' ? 'Create account' : 'Sign in'}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </Button>

            {mode === 'login' && (
              <Button type="button" onClick={enterGuestMode} variant="ghost" className="mt-2 h-10 w-full gap-2 rounded-xl text-[13px] font-medium text-muted-foreground hover:text-foreground" disabled={busy}>
                <Users className="h-4 w-4" /> Continue as guest
              </Button>
            )}

            {mode === 'signup' && (
              <p className="mt-4 text-center text-xs text-muted-foreground">New accounts are reviewed by an admin before first sign-in.</p>
            )}
          </form>
        )}

        {mode === 'login' && !signupSuccess && (
          <div className="mt-5 border-t border-border/60 pt-4 text-center min-[600px]:mt-4 min-[600px]:pt-3">
            <button type="button" onClick={() => navigate('/admin-login')} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground" disabled={loading}>
              <ShieldCheck className="h-3.5 w-3.5" /> Admin portal
            </button>
          </div>
        )}
      </AuthCard>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground/70 min-[600px]:mt-3">
        <Lock className="h-3 w-3" /> Your problems and solutions are saved securely in the cloud.
      </p>
    </AuthLayout>
  );
};

export default Login;
