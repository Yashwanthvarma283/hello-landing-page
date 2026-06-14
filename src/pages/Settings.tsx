import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  User, Lock, Palette, Github, Loader2, Save, LogOut, Bell, Moon, Sun, Shield
} from 'lucide-react';
import AppShell from '@/components/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useUser } from '@/lib/user-context';
import { useTheme } from '@/lib/theme-context';
import { supabase } from '@/integrations/supabase/client';
import { signOut } from '@/lib/supabase';

export default function Settings() {
  const navigate = useNavigate();
  const { authUser, profile, setProfile } = useUser();
  const { theme, toggleTheme } = useTheme();

  const [username, setUsername] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [ghToken, setGhToken] = useState('');
  const [ghRepo, setGhRepo] = useState('');
  const [ghAutoPush, setGhAutoPush] = useState(false);
  const [ghSaving, setGhSaving] = useState(false);

  const [notifSolved, setNotifSolved] = useState(true);
  const [notifStreak, setNotifStreak] = useState(true);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setGhToken(profile.github_token || '');
      setGhRepo(profile.github_repo || '');
      setGhAutoPush(!!profile.github_auto_push);
    }
    setNotifSolved(localStorage.getItem('notif_solved') !== 'false');
    setNotifStreak(localStorage.getItem('notif_streak') !== 'false');
  }, [profile]);

  const saveUsername = async () => {
    if (!authUser || !username.trim()) return;
    setSavingProfile(true);
    try {
      await supabase.rpc('admin_reset_username', { target_user_id: authUser.id, new_username: username.trim() });
      if (profile) setProfile({ ...profile, username: username.trim() });
      toast.success('Username updated');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update');
    } finally { setSavingProfile(false); }
  };

  const changePassword = async () => {
    if (!authUser || newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setChangingPassword(true);
    try {
      await supabase.rpc('admin_reset_password', { target_user_id: authUser.id, new_password: newPassword });
      toast.success('Password updated');
      setNewPassword(''); setConfirmPassword('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update');
    } finally { setChangingPassword(false); }
  };

  const saveGitHub = async () => {
    if (!authUser) return;
    setGhSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        github_token: ghToken, github_repo: ghRepo, github_auto_push: ghAutoPush,
      }).eq('id', authUser.id);
      if (error) throw error;
      if (profile) setProfile({ ...profile, github_token: ghToken, github_repo: ghRepo, github_auto_push: ghAutoPush });
      toast.success('GitHub settings saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally { setGhSaving(false); }
  };

  const saveNotif = (key: string, val: boolean) => {
    localStorage.setItem(key, String(val));
    toast.success('Preference saved');
  };

  const handleLogout = async () => { await signOut(); navigate('/'); };

  return (
    <AppShell title="Settings" subtitle="Manage your account, appearance, and integrations">
      <div className="max-w-3xl mx-auto space-y-4 animate-in fade-in duration-300">

        {/* Profile */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><User className="h-4 w-4" /> Profile</CardTitle>
            <CardDescription className="text-[12px]">How you appear to other users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-[1fr,auto] gap-2 items-end">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Username</Label>
                <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="your_username" className="h-9" />
              </div>
              <Button onClick={saveUsername} disabled={savingProfile || !username.trim()} className="h-9 gap-1.5">
                {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
              </Button>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Signed in as <span className="font-mono text-foreground">{authUser?.email}</span>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Palette className="h-4 w-4" /> Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                <div>
                  <div className="text-[13px] font-medium">{theme === 'dark' ? 'Dark' : 'Light'} mode</div>
                  <div className="text-[11px] text-muted-foreground">Toggle the global theme.</div>
                </div>
              </div>
              <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              Visit the <button className="underline" onClick={() => navigate('/store')}>Store</button> to equip premium themes.
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Bell className="h-4 w-4" /> Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { key: 'notif_solved', label: 'Problem solved toasts', val: notifSolved, setter: setNotifSolved },
              { key: 'notif_streak', label: 'Streak reminders', val: notifStreak, setter: setNotifStreak },
            ].map(p => (
              <div key={p.key} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div className="text-[13px]">{p.label}</div>
                <Switch checked={p.val} onCheckedChange={(v) => { p.setter(v); saveNotif(p.key, v); }} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Lock className="h-4 w-4" /> Security</CardTitle>
            <CardDescription className="text-[12px]">Change your password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">New password</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Confirm</Label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-9" />
              </div>
            </div>
            <Button onClick={changePassword} disabled={changingPassword || !newPassword} className="h-9 gap-1.5">
              {changingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />} Update password
            </Button>
          </CardContent>
        </Card>

        {/* GitHub */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><Github className="h-4 w-4" /> GitHub Integration</CardTitle>
            <CardDescription className="text-[12px]">Push your solutions to a repository.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Personal access token</Label>
              <Input type="password" value={ghToken} onChange={e => setGhToken(e.target.value)} placeholder="ghp_…" className="h-9 font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Repository</Label>
              <Input value={ghRepo} onChange={e => setGhRepo(e.target.value)} placeholder="username/repo-name" className="h-9 font-mono" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
              <div className="text-[13px]">Auto-push after solve</div>
              <Switch checked={ghAutoPush} onCheckedChange={setGhAutoPush} />
            </div>
            <Button onClick={saveGitHub} disabled={ghSaving} className="h-9 gap-1.5">
              {ghSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save GitHub settings
            </Button>
          </CardContent>
        </Card>

        {/* Sign out */}
        <Card className="border-destructive/30">
          <CardContent className="pt-5 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Sign out</div>
              <div className="text-[11px] text-muted-foreground">You can sign back in any time.</div>
            </div>
            <Button variant="destructive" onClick={handleLogout} className="h-9 gap-1.5">
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </CardContent>
        </Card>

      </div>
    </AppShell>
  );
}
