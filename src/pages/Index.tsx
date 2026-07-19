import { Clock } from 'lucide-react';
import { useUser } from '@/lib/user-context';
import Login from './Login';
import Dashboard from './Dashboard';
import GuestDashboard from './GuestDashboard';
import useNotificationReminders from '@/components/NotificationManager';
import AppShell from '@/components/AppShell';

const Index = () => {
  const { authUser, loading, isGuest, userStatus } = useUser();
  useNotificationReminders();

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-5 select-none">
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-2xl animate-pulse" />
          <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center shadow-xl">
            <span className="text-3xl font-black tracking-tight">J</span>
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          {'JavaArena'.split('').map((c, i) => (
            <span
              key={i}
              className="text-2xl sm:text-3xl font-black tracking-tight text-foreground"
              style={{ animation: `fadeUp 1.4s ease-in-out ${i * 0.08}s infinite alternate` }}
            >{c}</span>
          ))}
        </div>
        <style>{`@keyframes fadeUp{0%{opacity:.35;transform:translateY(2px)}100%{opacity:1;transform:translateY(-2px)}}`}</style>
      </div>
    );
  }

  // Guest mode - show limited dashboard
  if (isGuest) {
    return <GuestDashboard />;
  }

  if (!authUser) {
    return <Login />;
  }

  // Check user status
  if (userStatus === 'pending') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center animate-fade-in">
          <div className="rounded-2xl border border-border bg-card p-8" style={{ boxShadow: 'var(--shadow-lg)' }}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/20">
              <Clock className="h-7 w-7 text-warning" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Account Pending Approval</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your account is awaiting admin approval. You'll receive access once an administrator approves your request.
            </p>
            <button
              onClick={async () => {
                const { signOut } = await import('@/lib/supabase');
                await signOut();
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (userStatus === 'blocked') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center animate-fade-in">
          <div className="rounded-2xl border border-destructive/30 bg-card p-8">
            <h2 className="text-lg font-semibold text-destructive mb-2">Account Blocked</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your account has been blocked by an administrator. Please contact support if you believe this is an error.
            </p>
            <button
              onClick={async () => {
                const { signOut } = await import('@/lib/supabase');
                await signOut();
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (userStatus === 'temporarily_banned') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center animate-fade-in">
          <div className="rounded-2xl border border-warning/30 bg-card p-8">
            <h2 className="text-lg font-semibold text-warning mb-2">Temporarily Banned</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Your account has been temporarily suspended. Please try again later or contact support.
            </p>
            <button
              onClick={async () => {
                const { signOut } = await import('@/lib/supabase');
                await signOut();
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppShell bare hideMobileNav>
      <Dashboard />
    </AppShell>
  );
};

export default Index;
