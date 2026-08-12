import { useNavigate } from 'react-router-dom';
import { Play, Save, Zap, Settings, LogOut, Loader2, BookOpen, Moon, Sun, Cloud, User, Github, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/lib/theme-context';
import { HeaderMenu } from '@/components/AppShell';

interface ToolbarProps {
  onRun: () => void;
  onSave: () => void;
  onAnalyze: () => void;
  onSettings: () => void;
  onLogout: () => void;
  onGitHubPush?: () => void;
  username: string;
  isRunning: boolean;
  isSaving: boolean;
  isPushing?: boolean;
  runDisabled?: boolean;
  aiEnabled: boolean;
  onAIToggle: (enabled: boolean) => void;
  isAutoSaving?: boolean;
  codeIsDirty?: boolean;
  leftMobileActions?: React.ReactNode;
  rightMobileActions?: React.ReactNode;
}

const Toolbar = ({ 
  onRun, onSave, onAnalyze, onSettings, onLogout, onGitHubPush, 
  username, isRunning, isSaving, isPushing, runDisabled, aiEnabled, 
  onAIToggle, isAutoSaving, codeIsDirty, leftMobileActions, rightMobileActions 
}: ToolbarProps) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-2 sm:px-4 py-2 gap-1 overflow-x-auto scrollbar-none">
      <HeaderMenu />
      <div className="h-4 w-px bg-border mx-1" />
      <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
        <div className="md:hidden flex items-center shrink-0">
          {leftMobileActions}
        </div>
        <span className="text-sm font-semibold tracking-tight text-foreground mr-1 hidden sm:inline">JavaArena</span>



        <Button onClick={onSave} disabled={isSaving} size="sm" variant="outline" className="h-8 gap-1 sm:gap-1.5 text-xs font-medium shrink-0 rounded-lg">
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">Save</span>
        </Button>

        {onGitHubPush && (
          <Button 
            onClick={onGitHubPush} 
            disabled={isPushing} 
            size="sm" 
            variant="outline" 
            className="h-8 gap-1 sm:gap-1.5 text-xs font-medium shrink-0 rounded-lg text-primary border-primary/20 hover:bg-primary/5"
          >
            {isPushing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Github className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Sync</span>
          </Button>
        )}

        <span className="text-[11px] text-muted-foreground items-center gap-1.5 ml-1 shrink-0 hidden md:flex">
          {isAutoSaving ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>
          ) : codeIsDirty ? (
            <span className="flex items-center gap-1 text-warning">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Unsaved
            </span>
          ) : (
            <span className="flex items-center gap-1 text-success">
              <Cloud className="h-3 w-3" /> Saved
            </span>
          )}
        </span>

        <div className="h-4 w-px bg-border ml-1 hidden sm:block" />

        <Button onClick={onAnalyze} disabled={!aiEnabled} size="sm" variant="ghost" className="h-8 gap-1 sm:gap-1.5 text-xs font-medium shrink-0">
          <Zap className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">AI</span>
        </Button>

        <div className="items-center gap-2 rounded-lg border border-border bg-secondary/50 px-2.5 py-1 shrink-0 hidden md:flex">
          <Label htmlFor="ai-toggle" className="text-[11px] font-medium text-muted-foreground cursor-pointer select-none">
            AI
          </Label>
          <Switch
            id="ai-toggle"
            checked={aiEnabled}
            onCheckedChange={onAIToggle}
            className="h-4 w-8 [&>span]:h-3 [&>span]:w-3 data-[state=checked]:[&>span]:translate-x-4"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button onClick={toggleTheme} size="icon" variant="ghost" className="h-8 w-8 rounded-lg hidden sm:inline-flex" title="Toggle theme">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <div className="h-4 w-px bg-border mx-0.5 hidden sm:block" />
        <Button onClick={() => navigate('/profile')} size="icon" variant="ghost" className="h-8 w-8 rounded-lg hidden sm:inline-flex" title="Profile">
          <User className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground font-medium px-1 hidden lg:inline">{username}</span>
        <Button onClick={onSettings} size="icon" variant="ghost" className="h-8 w-8 rounded-lg hidden sm:inline-flex">
          <Settings className="h-4 w-4" />
        </Button>
        <Button onClick={onLogout} size="icon" variant="ghost" className="h-8 w-8 rounded-lg hidden sm:inline-flex">
          <LogOut className="h-4 w-4" />
        </Button>
        <div className="lg:hidden flex items-center shrink-0 ml-1">
          {rightMobileActions}
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
