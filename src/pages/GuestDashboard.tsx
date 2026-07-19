import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Play, Brain, Loader2, FlaskConical, Bug, Zap, CloudOff, MessageSquare, LogIn, Square } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import CodeEditor from '@/components/CodeEditor';
import AIChatPanel from '@/components/AIChatPanel';
import ConsolePanel, { ConsoleEntry } from '@/components/ConsolePanel';
import ExecutionStatus from '@/components/ExecutionStatus';
import CodeSnippets from '@/components/CodeSnippets';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@/lib/user-context';
import { useTheme } from '@/lib/theme-context';
import { executeJavaCode, stopExecution, type ExecutionStatus as ExecStatusType } from '@/lib/executor';
import { Moon, Sun, BookOpen } from 'lucide-react';

const DEFAULT_GUEST_CODE = `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, Guest! Welcome to JavaArena");
        
        // Try writing your Java code here
        // Note: Your code won't be saved in Guest Mode
        int[] arr = {5, 3, 8, 1, 2};
        
        // Bubble Sort
        for (int i = 0; i < arr.length - 1; i++) {
            for (int j = 0; j < arr.length - i - 1; j++) {
                if (arr[j] > arr[j + 1]) {
                    int temp = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = temp;
                }
            }
        }
        
        System.out.print("Sorted: ");
        for (int num : arr) {
            System.out.print(num + " ");
        }
    }
}`;

const GuestDashboard = () => {
  const navigate = useNavigate();
  const { exitGuestMode } = useUser();
  const { theme, toggleTheme } = useTheme();
  const [code, setCode] = useState(DEFAULT_GUEST_CODE);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [execStatus, setExecStatus] = useState<ExecStatusType>('ready');
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [consoleFullscreen, setConsoleFullscreen] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(288);
  const [bottomTab, setBottomTab] = useState<'console' | 'snippets'>('console');

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleRun();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const addConsoleEntry = (type: ConsoleEntry['type'], text: string) => {
    setConsoleEntries(prev => [...prev, {
      type, text,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
    }]);
  };

  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setExecStatus('sending');
    setConsoleCollapsed(false);
    setBottomTab('console');
    addConsoleEntry('system', '▶ Compiling and running...');
    const startTime = Date.now();
    try {
      const result = await executeJavaCode(code, (status) => setExecStatus(status));
      const elapsed = Date.now() - startTime;
      if (result.success) {
        if (result.output) addConsoleEntry('output', result.output);
        addConsoleEntry('info', `✓ Execution completed in ${elapsed}ms`);
      } else {
        if (result.error) addConsoleEntry('error', result.error);
        if (result.status.description !== 'Compilation Error') {
          addConsoleEntry('system', `Status: ${result.status.description}`);
        }
      }
    } catch (err: any) {
      addConsoleEntry('error', err?.message || 'Execution failed');
      setExecStatus('failed');
    }
    setIsRunning(false);
  };

  const handleLogin = () => {
    exitGuestMode();
    navigate('/');
  };

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = consoleHeight;
    const onMouseMove = (ev: MouseEvent) => {
      setConsoleHeight(Math.max(80, Math.min(600, startHeight + (startY - ev.clientY))));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [consoleHeight]);

  return (
    <div className="flex h-[100dvh] flex-col bg-background md:h-screen">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-2 sm:px-4 py-2 gap-1 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
          <span className="text-sm font-semibold tracking-tight text-foreground mr-1 hidden sm:inline">JavaArena</span>
          <div className="h-4 w-px bg-border hidden sm:block" />

          <span className="flex items-center gap-1.5 rounded-full bg-warning/15 border border-warning/30 px-2.5 py-1 text-[11px] font-medium text-warning">
            <CloudOff className="h-3 w-3" /> Guest Mode
          </span>

          <div className="h-4 w-px bg-border hidden sm:block" />

          <Button onClick={handleRun} disabled={isRunning} size="sm" className="hidden h-8 gap-1 sm:inline-flex sm:gap-1.5 text-xs font-medium shrink-0 rounded-lg">
            {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run
          </Button>
          {isRunning && (
            <Button onClick={() => { stopExecution(); setIsRunning(false); setExecStatus('stopped' as any); }} size="sm" variant="destructive" className="hidden h-8 gap-1 text-xs font-medium shrink-0 rounded-lg sm:inline-flex">
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
          )}

          <Button variant="outline" size="sm" className="hidden h-8 gap-1.5 text-xs shrink-0 rounded-lg sm:inline-flex" disabled>
            <CloudOff className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Save (Disabled)</span>
          </Button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button onClick={toggleTheme} size="icon" variant="ghost" className="h-8 w-8 rounded-lg" title="Toggle theme">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <div className="h-4 w-px bg-border mx-0.5" />
          <Button onClick={handleLogin} size="sm" className="h-8 gap-1.5 text-xs font-medium rounded-lg">
            <LogIn className="h-3.5 w-3.5" />
            Login
          </Button>
          <Button onClick={handleLogin} size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-medium rounded-lg hidden sm:flex">
            Sign Up
          </Button>
        </div>
      </div>

      {/* Guest banner */}
      <div className="shrink-0 bg-warning/10 border-b border-warning/20 px-3 sm:px-4 py-1.5 text-center">
        <p className="text-[11px] text-warning font-medium">
          ⚡ Guest Mode — Code execution works, but nothing is saved. <button onClick={handleLogin} className="underline hover:text-foreground">Create an account</button> to save your progress.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden flex-col">
        {/* Editor */}
        <div className={`min-h-0 overflow-hidden ${consoleFullscreen ? 'hidden' : 'flex-1'}`}>
          <CodeEditor code={code} onChange={setCode} />
        </div>

        {!consoleFullscreen && (
          <div className="flex shrink-0 items-center gap-1 sm:gap-2 border-t border-border bg-card px-2 sm:px-4 py-2 overflow-x-auto scrollbar-none">
            <Button onClick={handleRun} disabled={isRunning} size="sm" className="h-8 gap-1.5 px-3 sm:px-4 text-xs font-medium rounded-lg shrink-0">
              {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {isRunning ? 'Running...' : 'Run'}
            </Button>
            {isRunning && (
              <Button onClick={() => { stopExecution(); setIsRunning(false); setExecStatus('stopped' as any); }} size="sm" variant="destructive" className="h-8 gap-1.5 px-3 text-xs font-medium rounded-lg shrink-0">
                <Square className="h-3.5 w-3.5" /> Stop
              </Button>
            )}
            <div className="min-w-0 shrink">
              <ExecutionStatus status={execStatus} />
            </div>
          </div>
        )}

        <div
          onMouseDown={handleDividerMouseDown}
          className="resize-handle hidden h-1 cursor-row-resize border-t border-border hover:bg-foreground/10 transition-colors sm:block"
        />

        {/* Bottom tabs */}
        <div
          className={`shrink-0 border-t border-border ${consoleFullscreen ? 'flex-1' : ''}`}
          style={consoleFullscreen ? {} : { height: consoleCollapsed ? 36 : `min(${consoleHeight}px, 42dvh)` }}
        >
          <div className="flex items-center border-b border-border bg-card px-1 overflow-x-auto scrollbar-none">
            {(['console', 'snippets'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => { setBottomTab(tab); setConsoleCollapsed(false); }}
                className={`px-3 py-2 text-[11px] font-medium tracking-wide transition-colors whitespace-nowrap relative ${
                  bottomTab === tab
                    ? 'text-foreground tab-active'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'console' ? 'Console' : 'Templates'}
              </button>
            ))}
          </div>

          <div className="flex h-[calc(100%-32px)]">
            {bottomTab === 'console' && (
              <div className="flex-1 overflow-hidden">
                <ConsolePanel
                  entries={consoleEntries}
                  isRunning={isRunning}
                  onClear={() => setConsoleEntries([])}
                  isCollapsed={consoleCollapsed}
                  onToggleCollapse={() => setConsoleCollapsed(c => !c)}
                  isFullscreen={consoleFullscreen}
                  onToggleFullscreen={() => setConsoleFullscreen(f => !f)}
                />
              </div>
            )}

            {bottomTab === 'snippets' && (
              <div className="flex-1 overflow-hidden">
                <CodeSnippets onInsert={(snippet) => setCode(prev => prev + snippet)} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestDashboard;
