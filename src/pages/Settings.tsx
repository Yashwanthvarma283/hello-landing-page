import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  User, Lock, Palette, Github, Loader2, Save, LogOut, Bell, Moon, Sun, Shield, Code2, RotateCcw, Keyboard
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
import { cn } from '@/lib/utils';
import { useEditorSettings, updateEditorSettings, resetEditorSettings, type EditorSettings } from '@/lib/editor-settings';
import { JAVA_LIVE_TEMPLATES } from '@/lib/java-completions';

const SECTIONS = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'editor', label: 'Code editor', icon: Code2 },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'integrations', label: 'Integrations', icon: Github },
] as const;

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium">{title}</div>
        {hint && <div className="text-[12px] text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {description && <CardDescription className="text-[12px]">{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { authUser, profile, setProfile } = useUser();
  const { theme, toggleTheme } = useTheme();
  const editor = useEditorSettings();
  const [params, setParams] = useSearchParams();
  const active = (SECTIONS.find(x => x.id === params.get('section'))?.id) ?? 'account';
  const setEditor = (patch: Partial<EditorSettings>) => updateEditorSettings(patch);

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
    <AppShell title="Settings" subtitle="Manage your account, editor and preferences">
      <div className="max-w-5xl mx-auto grid md:grid-cols-[200px,1fr] gap-6 animate-in fade-in duration-300">
        <nav aria-label="Settings sections" className="flex md:flex-col gap-1 overflow-x-auto md:sticky md:top-4 md:self-start">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setParams({ section: id }, { replace: true })}
              className={cn('flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] whitespace-nowrap text-left transition-colors',
                active === id ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground')}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
          <Separator className="my-2 hidden md:block" />
          <button onClick={handleLogout} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-destructive hover:bg-destructive/10 whitespace-nowrap">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </nav>

        <div className="space-y-4 min-w-0">
          {active === 'account' && (<>
            <Section title="Profile" description="How you appear to other users.">
              <div className="grid sm:grid-cols-[1fr,auto] gap-2 items-end pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="username" className="text-[12px] text-muted-foreground">Username</Label>
                  <Input id="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="your_username" className="h-9" />
                </div>
                <Button onClick={saveUsername} disabled={savingProfile || !username.trim()} className="h-9 gap-1.5">
                  {savingProfile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                </Button>
              </div>
              <div className="text-[12px] text-muted-foreground mt-3">Signed in as <span className="font-mono text-foreground">{authUser?.email}</span></div>
            </Section>
            <Section title="Password" description="Use at least 6 characters.">
              <div className="grid sm:grid-cols-2 gap-2 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="newpw" className="text-[12px] text-muted-foreground">New password</Label>
                  <Input id="newpw" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confpw" className="text-[12px] text-muted-foreground">Confirm password</Label>
                  <Input id="confpw" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-9" />
                </div>
              </div>
              <Button onClick={changePassword} disabled={changingPassword || !newPassword} className="h-9 gap-1.5 mt-3">
                {changingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />} Update password
              </Button>
            </Section>
          </>)}

          {active === 'appearance' && (
            <Section title="Theme">
              <Row title={`${theme === 'dark' ? 'Dark' : 'Light'} mode`} hint="Switch the look of the whole app.">
                <div className="flex items-center gap-2">{theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}<Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} /></div>
              </Row>
              <div className="text-[12px] text-muted-foreground pt-3">
                Visit the <button className="underline" onClick={() => navigate('/store')}>Store</button> to equip premium themes.
              </div>
            </Section>
          )}

          {active === 'editor' && (<>
            <Section title="Typing assistance" description="Applies to every code editor in the app.">
              <Row title="Keyword suggestions" hint="Show Java keywords, classes and words while you type.">
                <Switch aria-label="Keyword suggestions" checked={editor.suggestions} onCheckedChange={v => setEditor({ suggestions: v })} />
              </Row>
              <Row title="IntelliJ shortcuts" hint="Type sout, psvm, fori… and press Tab to expand.">
                <Switch aria-label="IntelliJ shortcuts" checked={editor.liveTemplates} onCheckedChange={v => setEditor({ liveTemplates: v })} />
              </Row>
              <Row title="Auto-close brackets and quotes" hint={'Insert the closing ) ] } " automatically.'}>
                <Switch aria-label="Auto-close brackets and quotes" checked={editor.autoCloseBrackets} onCheckedChange={v => setEditor({ autoCloseBrackets: v })} />
              </Row>
            </Section>
            <Section title="Display">
              <Row title="Font size" hint="Ctrl + mouse wheel also zooms inside the editor.">
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="Smaller font" onClick={() => setEditor({ fontSize: Math.max(11, editor.fontSize - 1) })}>−</Button>
                  <span className="w-10 text-center text-[13px] tabular-nums">{editor.fontSize}px</span>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0" aria-label="Larger font" onClick={() => setEditor({ fontSize: Math.min(22, editor.fontSize + 1) })}>+</Button>
                </div>
              </Row>
              <Row title="Line numbers"><Switch aria-label="Line numbers" checked={editor.lineNumbers} onCheckedChange={v => setEditor({ lineNumbers: v })} /></Row>
              <Row title="Word wrap" hint="Wrap long lines instead of scrolling sideways."><Switch aria-label="Word wrap" checked={editor.wordWrap} onCheckedChange={v => setEditor({ wordWrap: v })} /></Row>
              <Row title="Minimap" hint="Code overview on the right edge."><Switch aria-label="Minimap" checked={editor.minimap} onCheckedChange={v => setEditor({ minimap: v })} /></Row>
              <Row title="Sticky scroll" hint="Keep the current class and method visible at the top."><Switch aria-label="Sticky scroll" checked={editor.stickyScroll} onCheckedChange={v => setEditor({ stickyScroll: v })} /></Row>
              <div className="pt-3">
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => { resetEditorSettings(); toast.success('Editor settings reset'); }}>
                  <RotateCcw className="h-3.5 w-3.5" /> Reset to defaults
                </Button>
              </div>
            </Section>
          </>)}

          {active === 'shortcuts' && (<>
            <Section title="Editor shortcuts">
              {[['Ctrl + Enter', 'Run code'], ['Ctrl + S', 'Save'], ['Ctrl + Shift + T', 'Run tests'], ['Ctrl + Shift + E', 'Explain code with AI'], ['Ctrl + Space', 'Show suggestions'], ['Ctrl + /', 'Toggle comment'], ['Alt + ↑ / ↓', 'Move line'], ['Shift + Alt + ↓', 'Duplicate line'], ['Ctrl + D', 'Select next match'], ['Ctrl + F', 'Find']].map(([k, d]) => (
                <Row key={k} title={d}><kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-[11px]">{k}</kbd></Row>
              ))}
            </Section>
            <Section title="IntelliJ shortcuts" description={editor.liveTemplates ? 'Type the abbreviation, then press Tab or Enter.' : 'Turned off — enable them in Code editor settings.'}>
              <div className="grid sm:grid-cols-2 gap-x-6 pt-1">
                {JAVA_LIVE_TEMPLATES.map(t => (
                  <div key={t.key} className="flex items-center gap-3 py-2 border-b border-border/40">
                    <code className="w-14 shrink-0 font-mono text-[12px] font-semibold text-primary">{t.key}</code>
                    <span className="text-[12px] text-muted-foreground truncate">{t.description}</span>
                  </div>
                ))}
              </div>
            </Section>
          </>)}

          {active === 'notifications' && (
            <Section title="Notifications">
              {[
                { key: 'notif_solved', label: 'Problem solved toasts', hint: 'A message when you solve a problem.', val: notifSolved, setter: setNotifSolved },
                { key: 'notif_streak', label: 'Streak reminders', hint: 'Reminders to keep your daily streak.', val: notifStreak, setter: setNotifStreak },
              ].map(p => (
                <Row key={p.key} title={p.label} hint={p.hint}>
                  <Switch aria-label={p.label} checked={p.val} onCheckedChange={(v) => { p.setter(v); saveNotif(p.key, v); }} />
                </Row>
              ))}
            </Section>
          )}

          {active === 'integrations' && (
            <Section title="GitHub" description="Push your solutions to a repository.">
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ghtoken" className="text-[12px] text-muted-foreground">Personal access token</Label>
                  <Input id="ghtoken" type="password" value={ghToken} onChange={e => setGhToken(e.target.value)} placeholder="ghp_…" className="h-9 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ghrepo" className="text-[12px] text-muted-foreground">Repository</Label>
                  <Input id="ghrepo" value={ghRepo} onChange={e => setGhRepo(e.target.value)} placeholder="username/repo-name" className="h-9 font-mono" />
                </div>
                <Row title="Auto-push after solve"><Switch aria-label="Auto-push after solve" checked={ghAutoPush} onCheckedChange={setGhAutoPush} /></Row>
                <Button onClick={saveGitHub} disabled={ghSaving} className="h-9 gap-1.5">
                  {ghSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save GitHub settings
                </Button>
              </div>
            </Section>
          )}
        </div>
      </div>
    </AppShell>
  );
}
