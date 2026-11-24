import { useState } from 'react';
import { Loader2, Mail, Lock, ArrowLeft, ArrowRight, Shield, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthLayout, AuthCard, AuthHeading, AuthAlert } from '@/components/auth/AuthLayout';
import { AuthField } from '@/components/auth/AuthField';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { EmailConfirmationNotice } from '@/components/EmailConfirmationNotice';
import { isEmailUnconfirmed } from '@/lib/auth-errors';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');

  const handleSubmit = async () => {
    setError('');
    setConfirmationEmail('');
    if (!email.trim()) { setError('Email is required'); return; }
    if (!password.trim()) { setError('Password is required'); return; }

    setLoading(true);
    try {
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Login failed');

      // Check if user has admin role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleError) throw new Error('Failed to verify admin access');
      if (!roleData) {
        await supabase.auth.signOut();
        throw new Error('Access denied. You do not have admin privileges.');
      }

      navigate('/admin');
    } catch (err: any) {
      if (isEmailUnconfirmed(err)) setConfirmationEmail(email.trim());
      else setError(err?.message || 'Authentication failed.');
    }
    setLoading(false);
  };

  const mark = <Shield className="h-8 w-8 text-background min-[600px]:h-11 min-[600px]:w-11" />;
  return (
    <AuthLayout inShell mark={mark} title="Admin Portal" tagline="Restricted area for JavaLabs administrators"
      highlights={['Approve and manage member accounts', 'Manage AI keys and usage analytics', 'Coins, store and platform settings']}>
      <AuthCard>
        <button type="button" onClick={() => navigate('/')} className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to main sign in
        </button>
        <AuthHeading title="Admin sign in" subtitle="Use the credentials of an account with admin access." />
        <form noValidate onSubmit={e => { e.preventDefault(); if (!loading) handleSubmit(); }}>
          <AuthField label="Admin email" icon={Mail} type="email" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="admin@example.com" autoComplete="email" disabled={loading} />
          <AuthField label="Password" icon={Lock} type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} placeholder="••••••••" autoComplete="current-password" disabled={loading} />
          {error && <AuthAlert>{error}</AuthAlert>}
          {confirmationEmail && confirmationEmail === email.trim() && (
            <div className="mb-4"><EmailConfirmationNotice key={confirmationEmail} email={confirmationEmail} /></div>
          )}
          <Button type="submit" className="group mt-1 h-11 w-full rounded-xl text-[14px] font-semibold min-[600px]:h-10" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying access…</> : (
              <span className="flex items-center gap-2">Sign in to admin <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>
            )}
          </Button>
        </form>
        <div className="mt-5 border-t border-border/60 pt-4 text-center min-[600px]:mt-4 min-[600px]:pt-3">
          <button type="button" onClick={() => navigate('/admin/signup')} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            <UserPlus className="h-3.5 w-3.5" /> Request admin access
          </button>
        </div>
      </AuthCard>
      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70 min-[600px]:mt-3"><Lock className="h-3 w-3" /> Every admin sign-in is verified against assigned roles.</p>
    </AuthLayout>
  );
};

export default AdminLogin;
