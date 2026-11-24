import { useState } from 'react';
import { Code2, Terminal, Cpu, Loader2, Mail, Lock, User, ArrowLeft, ArrowRight, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signUp, signIn, supabase } from '@/lib/supabase';
import { useUser } from '@/lib/user-context';
import { useNavigate } from 'react-router-dom';
import logoMark from '@/assets/javaarena-logo.png';
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 min-[600px]:h-dvh min-[600px]:min-h-0 min-[600px]:overflow-hidden min-[600px]:py-4 min-[1024px]:px-10">
      <div className="w-full max-w-[400px] animate-in-up min-[600px]:grid min-[600px]:max-w-[1100px] min-[600px]:grid-cols-2 min-[600px]:items-center min-[600px]:gap-8 min-[1024px]:gap-16">
        {/* Logo */}
        <div className="mb-10 text-center min-[600px]:mb-0">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground shadow-md transition-transform hover:scale-105 duration-300 min-[600px]:h-24 min-[600px]:w-24">
            <img src={logoMark} alt="JavaLabs logo" width={1024} height={1024} className="h-9 w-9 invert dark:invert-0 min-[600px]:h-14 min-[600px]:w-14" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance text-foreground">JavaLabs</h1>
          <p className="mt-2 text-[15px] text-muted-foreground leading-relaxed">Your AI-powered DSA practice environment</p>
        </div>

        {/* Card */}
        <div className="min-w-0">
        <div className="surface-elevated p-8 rounded-2xl min-[600px]:p-4 min-[1024px]:p-6">
          {/* Feature badges */}
          <div className="mb-8 flex items-center justify-center gap-3 text-[11px] font-medium tracking-wide text-muted-foreground min-[600px]:mb-4 min-[600px]:gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1">
              <Terminal className="h-3 w-3" /> Java
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1">
              <Cpu className="h-3 w-3" /> AI
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1">
              <Code2 className="h-3 w-3" /> Monaco
            </span>
          </div>

          <h2 className="mb-6 text-center text-[17px] font-semibold tracking-tight text-foreground min-[600px]:mb-4">
            {mode === 'forgot' ? 'Reset Password' : mode === 'signup' ? 'Create Account' : 'Welcome Back'}
          </h2>

          {mode === 'forgot' && (
            <button onClick={() => { setMode('login'); setError(''); setResetSent(false); }} className="mb-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-3 w-3" /> Back to sign in
            </button>
          )}

          {signupSuccess ? (
            <div className="rounded-xl bg-success/10 p-5 text-center">
              <p className="text-sm font-medium text-success">Account Created!</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Please check your email to verify your account. After verification, an admin will review and approve your access.
              </p>
              <div className="mt-4"><EmailConfirmationNotice key={email.trim()} email={email.trim()} /></div>
              <button
                onClick={() => { setSignupSuccess(false); setMode('login'); }}
                className="mt-3 text-xs font-medium text-foreground hover:underline"
              >
                Back to Sign In
              </button>
            </div>
          ) : resetSent ? (
            <div className="rounded-xl bg-success/10 p-5 text-center">
              <p className="text-sm font-medium text-success">Reset link sent!</p>
              <p className="mt-1.5 text-xs text-muted-foreground">If an account exists for this email, you’ll receive a password reset link. Check your inbox and spam folder.</p>
              <Button variant="link" onClick={() => { setMode('login'); setResetSent(false); setError(''); }} className="mt-3">Back to Sign In</Button>
            </div>
          ) : (
            <>
              {mode !== 'forgot' && (
                <>
                  <Button variant="outline" onClick={handleGoogle} disabled={loading || googleLoading} className="google-auth-button mb-4 h-11 w-full rounded-xl min-[600px]:mb-3 min-[600px]:h-10">
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
                  <div className="mb-5 flex items-center gap-3 text-xs text-muted-foreground min-[600px]:mb-3"><span className="h-px flex-1 bg-border" />or with email<span className="h-px flex-1 bg-border" /></div>
                </>
              )}
              {mode === 'signup' && (
                <div className="mb-4 min-[600px]:mb-3">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Username</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                    <Input value={username} onChange={e => { setUsername(e.target.value); setError(''); }} placeholder="e.g. dev_coder" className="h-11 rounded-xl pl-10 font-mono text-sm bg-secondary/30 focus:bg-background border-border/60 transition-colors" disabled={loading} />
                  </div>
                </div>
              )}

              <div className="mb-4 min-[600px]:mb-3">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                  <Input type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="you@example.com" className="h-11 rounded-xl pl-10 text-sm bg-secondary/30 focus:bg-background border-border/60 transition-colors" disabled={loading} />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div className="mb-6 min-[600px]:mb-4">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
                    <Input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} onKeyDown={e => e.key === 'Enter' && !loading && handleSubmit()} placeholder="••••••••" className="h-11 rounded-xl pl-10 text-sm bg-secondary/30 focus:bg-background border-border/60 transition-colors" disabled={loading} />
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-4 rounded-lg bg-destructive/10 px-3 py-2">
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}
              {mode === 'login' && confirmationEmail && confirmationEmail === email.trim() && (
                <EmailConfirmationNotice key={confirmationEmail} email={confirmationEmail} />
              )}

              <Button onClick={handleSubmit} className="w-full h-11 rounded-xl text-[14px] font-semibold tracking-wide transition-all duration-200" disabled={loading || googleLoading}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {mode === 'forgot' ? 'Sending...' : mode === 'signup' ? 'Creating...' : 'Signing In...'}</>
                ) : (
                  <span className="flex items-center gap-2">
                    {mode === 'forgot' ? 'Send Reset Link' : mode === 'signup' ? 'Create Account' : 'Sign In'}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                )}
              </Button>

              {/* Guest Mode Button */}
              {mode === 'login' && (
                <Button
                  onClick={enterGuestMode}
                  variant="outline"
                  className="w-full h-11 rounded-xl text-[14px] font-medium mt-3 gap-2 border-border/80 hover:bg-secondary/50 transition-colors"
                  disabled={loading}
                >
                  <Users className="h-4 w-4" />
                  Continue as Guest
                </Button>
              )}

              <div className="mt-5 flex flex-col items-center gap-2 min-[600px]:mt-3">
                {mode === 'login' && (
                  <button onClick={() => { setMode('forgot'); setError(''); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors" disabled={loading}>
                    Forgot password?
                  </button>
                )}
                <button
                  onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setError(''); setSignupSuccess(false); }}
                  className="text-xs font-medium text-foreground hover:underline"
                  disabled={loading}
                >
                  {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                </button>
                {mode === 'login' && (
                  <button
                    onClick={() => navigate('/admin-login')}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    disabled={loading}
                  >
                    Admin Login →
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-5 text-center text-[11px] text-muted-foreground/60 min-[600px]:mt-3">
          Your problems and solutions are saved securely in the cloud.
        </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
