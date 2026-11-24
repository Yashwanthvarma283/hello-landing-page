import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AuthLayout, AuthCard, AuthHeading } from '@/components/auth/AuthLayout';
import { AuthField } from '@/components/auth/AuthField';
import { toast } from 'sonner';
import { Shield, ArrowLeft, User, Mail, Lock, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function AdminSignup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      // Sign up via Supabase Auth — the handle_new_user trigger will
      // create a profile with status='pending' (unless email is whitelisted)
      const { error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { 
            username: formData.name,
            requested_role: 'admin'
          },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw new Error(error.message);

      toast.success('Signup request submitted! Your account is pending admin approval. Please check your email to verify your address.');
      navigate('/admin-login');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const set = (k: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => setFormData(f => ({ ...f, [k]: e.target.value }));
  return (
    <AuthLayout inShell mark={<Shield className="h-8 w-8 text-background min-[600px]:h-11 min-[600px]:w-11" />} title="Admin Portal" tagline="Request administrator access to JavaLabs"
      highlights={['Requests are reviewed by an existing admin', 'Confirm your email before signing in', 'Access is granted only after approval']}>
      <AuthCard>
        <button type="button" onClick={() => navigate('/admin-login')} className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to admin sign in
        </button>
        <AuthHeading title="Request admin access" subtitle="Tell us who you are. An admin will review your request." />
        <form onSubmit={handleSubmit}>
          <AuthField label="Full name" icon={User} value={formData.name} onChange={set('name')} placeholder="Your name" autoComplete="name" required disabled={loading} />
          <AuthField label="Work email" icon={Mail} type="email" value={formData.email} onChange={set('email')} placeholder="you@example.com" autoComplete="email" required disabled={loading} />
          <div className="grid gap-x-3 min-[1024px]:grid-cols-2">
            <AuthField label="Password" icon={Lock} type="password" value={formData.password} onChange={set('password')} placeholder="Min. 6 characters" autoComplete="new-password" required disabled={loading} />
            <AuthField label="Confirm password" icon={Lock} type="password" value={formData.confirmPassword} onChange={set('confirmPassword')} placeholder="Repeat password" autoComplete="new-password" required disabled={loading} />
          </div>
          <Button type="submit" className="mt-1 h-11 w-full rounded-xl text-[14px] font-semibold min-[600px]:h-10" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</> : 'Submit request'}
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
