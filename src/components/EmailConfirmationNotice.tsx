import { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export function EmailConfirmationNotice({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const resend = async () => {
    if (sending) return;
    setSending(true);
    setError('');
    setSent(false);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: window.location.origin },
      });
      if (resendError) throw resendError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send confirmation email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mb-4 space-y-3 rounded-lg border border-border bg-secondary/30 p-4" role="status">
      <p className="text-sm font-medium text-foreground">Confirm your email to sign in</p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Admin approval does not confirm your email. Open the confirmation link in your inbox or spam folder, then sign in again.
      </p>
      <Button variant="outline" className="w-full gap-2" disabled={sending || sent} onClick={resend}>
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {sending ? 'Sending…' : sent ? 'Confirmation email requested' : 'Resend confirmation email'}
      </Button>
      {sent && <p className="text-xs text-muted-foreground">Check your inbox and spam folder. Use the newest confirmation link.</p>}
      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
    </div>
  );
}