import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Play, Brain, Loader2, FlaskConical, Square, FolderOpen, MessageSquare, Save, Code2 } from 'lucide-react';
import { useAutosave } from '@/hooks/use-autosave';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import ProblemExplorer from '@/components/ProblemExplorer';
import CodeEditor from '@/components/CodeEditor';
import AIChatPanel from '@/components/AIChatPanel';
import ConsolePanel, { ConsoleEntry } from '@/components/ConsolePanel';
import TestCasePanel, { TestResult } from '@/components/TestCasePanel';
import TestResultsTable from '@/components/TestResultsTable';
import DailyChallenge from '@/components/DailyChallenge';
import NotesPanel from '@/components/NotesPanel';
import StreakPanel from '@/components/StreakPanel';
import Toolbar from '@/components/Toolbar';
import ExecutionStatus from '@/components/ExecutionStatus';
import ProblemTimer from '@/components/ProblemTimer';
import SolutionComparison from '@/components/SolutionComparison';
import SettingsDialog from '@/components/SettingsDialog';
import { useUser } from '@/lib/user-context';
import {
  DbProblem, DbTestCase, fetchProblems, updateProblem, signOut, DEFAULT_CODE,
  fetchTestCases, insertTestCase, updateTestCase, deleteTestCase,
} from '@/lib/supabase';
import { executeJavaCode, stopExecution, type ExecutionStatus as ExecStatusType } from '@/lib/executor';
import { detectProblemTitle, generateTestCases } from '@/lib/ai-backend';
import { supabase } from '@/integrations/supabase/client';
import { API_BASE_URL } from '@/lib/api';
import { isMainClassStyle } from '@/lib/test-runner';
import { getGitHubSettings, pushFileToGitHub } from '@/lib/github';

const Dashboard = () => {
  const { authUser, profile } = useUser();
  const userId = authUser?.id || '';
  const username = profile?.username || authUser?.email?.split('@')[0] || 'User';

  const [problems, setProblems] = useState<DbProblem[]>([]);
  const [activeProblem, setActiveProblem] = useState<DbProblem | null>(null);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [execStatus, setExecStatus] = useState<ExecStatusType>('ready');
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [consoleFullscreen, setConsoleFullscreen] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(288);
  const [isPushing, setIsPushing] = useState(false);
  
  // Interactive stdin — promise-based so handleRun waits for user input
  const [waitingForInput, setWaitingForInput] = useState(false);
  const stdinResolverRef = useRef<((val: string) => void) | null>(null);

  // Test case state
  const [testCases, setTestCases] = useState<DbTestCase[]>([]);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [bottomTab, setBottomTab] = useState<'console' | 'tests' | 'results' | 'notes' | 'solutions' | 'streak' | 'daily'>('console');

  // Mobile navigation state
  const [mobileTab, setMobileTab] = useState<'explorer' | 'editor' | 'results' | 'ai'>('editor');

  // Execution analytics
  const [execTimeMs, setExecTimeMs] = useState<number | null>(null);
  const [timeComplexity, setTimeComplexity] = useState<string | null>(null);
  const [spaceComplexity, setSpaceComplexity] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [optimizationPossible, setOptimizationPossible] = useState(false);
  const [isAnalyzingComplexity, setIsAnalyzingComplexity] = useState(false);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'Enter') { e.preventDefault(); handleRun(); }
        if (e.key === 's') { e.preventDefault(); handleSave(); }
        if (e.shiftKey && e.key === 'E') { e.preventDefault(); handleExplain(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  useEffect(() => {
    if (userId) {
      fetchProblems(userId).then(setProblems).catch(() => {});
    }
  }, [userId]);

  useEffect(() => {
    if (activeProblem) {
      fetchTestCases(activeProblem.id).then(setTestCases).catch(() => {});
      setTestResults([]);
    } else {
      setTestCases([]);
      setTestResults([]);
    }
  }, [activeProblem?.id]);

  const refreshProblems = useCallback(async () => {
    if (!userId) return;
    try { setProblems(await fetchProblems(userId)); } catch {}
  }, [userId]);

  const autosaveCode = useCallback(async (val: string, problemId?: string) => {
    if (!problemId || !userId) return;
    await updateProblem(problemId, { code: val });
  }, [userId]);

  const { isDirty: codeIsDirty, isSaving: isAutoSaving, lastSaved, resetSavedValue, triggerSave } = useAutosave(code, autosaveCode, {
    delay: 1000,
    maxDelay: 2000,
    enabled: !!activeProblem && !!userId,
    key: activeProblem?.id,
  });

  const handleSelectProblem = (problem: DbProblem) => {
    if (activeProblem && codeIsDirty) {
      triggerSave();
    }
    setActiveProblem(problem);
    setCode(problem.code);
    resetSavedValue(problem.code);
  };

  const addConsoleEntry = (type: ConsoleEntry['type'], text: string) => {
    setConsoleEntries(prev => [...prev, {
      type, text,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
    }]);
  };

  /** Called by ConsolePanel when the user presses Enter in the stdin bar */
  const handleStdinSubmit = (val: string) => {
    addConsoleEntry('stdin', val);
    stdinResolverRef.current?.(val);
    stdinResolverRef.current = null;
  };

  /** Shows the yellow input bar and waits for one line of input */
  const waitForUserInput = (): Promise<string> =>
    new Promise(resolve => {
      setWaitingForInput(true);
      stdinResolverRef.current = (val: string) => {
        setWaitingForInput(false);
        resolve(val);
      };
    });

  /** Collects all stdin lines interactively (empty line = done) */
  const collectStdinInteractively = async (): Promise<string> => {
    addConsoleEntry('system', '📥 Program is waiting for input. Type each value and press Enter. Click "Run Now" or press Enter on an empty line when finished.');
    const lines: string[] = [];
    while (true) {
      const val = await waitForUserInput();
      console.log(`Stdin line collected: [${val}]`);
      if (val === '') break;
      lines.push(val);
      // Optional: show a small confirmation that it was added
    }
    const finalStdin = lines.join('\n');
    console.log(`All stdin collected. Total lines: ${lines.length}. Final string: ${JSON.stringify(finalStdin)}`);
    return finalStdin;
  };


  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setExecStatus('sending');
    setConsoleCollapsed(false);
    setBottomTab('console');
    setMobileTab('results');
    setExecTimeMs(null);

    try {
      const usesScanner =
        /new\s+Scanner\s*\(/.test(code) ||
        /System\.in/.test(code) ||
        /BufferedReader/.test(code);
      const hasMain = /public\s+static\s+void\s+main\s*\(/.test(code);

      let stdin: string | undefined;
      if (hasMain && usesScanner) {
        stdin = await collectStdinInteractively();
        const lineCount = stdin ? stdin.split('\n').length : 0;
        addConsoleEntry('system', `▶ Running with ${lineCount} input line(s)...`);
      } else {
        addConsoleEntry('system', '▶ Compiling and running...');
      }

      const startTime = Date.now();
      console.log('Final Stdin to send:', JSON.stringify(stdin));
      const result = await executeJavaCode(code, (status) => setExecStatus(status), stdin);
      const elapsed = Date.now() - startTime;
      console.log('Execution result:', result);
      if ((result as any).stdin_received !== undefined) {
        console.log('Backend confirmed receiving stdin:', (result as any).stdin_received);
      }
      setExecTimeMs(elapsed);

      if (result.success) {
        if (result.output) addConsoleEntry('output', result.output);
        addConsoleEntry('info', `✓ Execution completed in ${elapsed}ms`);
        if (aiEnabled) {
          setIsAnalyzingComplexity(true);
          supabase.functions.invoke('analyze-complexity', { body: { code, executionTimeMs: elapsed } })
            .then(({ data }) => {
              if (data) {
                setTimeComplexity(data.timeComplexity || null);
                setSpaceComplexity(data.spaceComplexity || null);
                setSuggestion(data.suggestion || null);
                setOptimizationPossible(data.optimizationPossible || false);
              }
            })
            .catch(() => {})
            .finally(() => setIsAnalyzingComplexity(false));
        }
      } else {
        if (result.output) addConsoleEntry('output', result.output);
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


  const handleRunTests = async () => {
    if (isRunningTests || testCases.length === 0) return;
    setIsRunningTests(true);
    setTestResults([]);
    setBottomTab('console');
    setMobileTab('results');
    addConsoleEntry('system', `▶ Running ${testCases.length} test(s)...`);

    const { runAllTests } = await import('@/lib/test-runner');

    const tcInputs = testCases.map(tc => ({
      inputs: (tc.inputs && Object.keys(tc.inputs).length > 0)
        ? tc.inputs
        : { [tc.variable_name || 'arr']: tc.input || '' },
      expected: tc.expected_output.trim(),
    }));

    const results = await runAllTests(code, tcInputs, setExecStatus, (idx, r) => {
      addConsoleEntry(
        r.status === 'PASSED' ? 'info' : 'error',
        `Test ${r.test} ${r.status}${r.status === 'FAILED' ? ` (expected: ${r.expected}, got: ${r.actual})` : ''}`
      );
    });

    const passed = results.filter(r => r.status === 'PASSED').length;
    addConsoleEntry('system', `\nExecution finished. ${passed}/${results.length} tests passed.`);
    setTestResults(results);
    setBottomTab('results');
    setExecStatus('complete');
    setIsRunningTests(false);
  };

  const handleAddTestCase = async (inputs: Record<string, string>, expectedOutput: string) => {
    if (!activeProblem || !userId) { toast.error('Select a problem first'); return; }
    try {
      const tc = await insertTestCase(userId, activeProblem.id, inputs, expectedOutput);
      setTestCases(prev => [...prev, tc]);
    } catch { toast.error('Failed to add test case'); }
  };

  const handleUpdateTestCase = async (id: string, inputs: Record<string, string>, expectedOutput: string) => {
    try {
      await updateTestCase(id, { inputs, expected_output: expectedOutput });
      setTestCases(prev => prev.map(tc => tc.id === id ? { ...tc, inputs, expected_output: expectedOutput } : tc));
    } catch { toast.error('Failed to update'); }
  };

  const handleDeleteTestCase = async (id: string) => {
    try {
      await deleteTestCase(id);
      setTestCases(prev => prev.filter(tc => tc.id !== id));
    } catch { toast.error('Failed to delete'); }
  };

  const handleGenerateAITests = async () => {
    if (!activeProblem || !userId) { toast.error('Select a problem first'); return; }
    setIsGeneratingTests(true);
    try {
      const currentTestCases = testCases.map(tc => ({
        inputs: tc.inputs as Record<string, string>,
        expected: tc.expected_output
      }));
      
      const generated = await generateTestCases(
        code,
        activeProblem.id,
        activeProblem.title,
        (activeProblem as any).description || '',
        currentTestCases
      );

      if (generated.length === 0) {
        toast.info('AI returned no new test cases');
        setIsGeneratingTests(false);
        return;
      }

      const newCases: DbTestCase[] = [];
      for (const tc of generated) {
        // Handle both API response formats
        const inputs = tc.inputs || tc.input || {};
        const expected = tc.expectedOutput || tc.expected || '';
        
        const saved = await insertTestCase(userId, activeProblem.id, inputs, expected);
        newCases.push(saved);
      }
      setTestCases(prev => [...prev, ...newCases]);
      toast.success(`Generated ${newCases.length} test cases`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to generate test cases');
    }
    setIsGeneratingTests(false);
  };

  const handleSave = async () => {
    if (!activeProblem) { toast.error('No problem selected'); return; }
    setIsSaving(true);
    try {
      if (activeProblem.title === 'New Problem' && aiEnabled) {
        try {
          const detectedTitle = await detectProblemTitle(code);
          if (detectedTitle && detectedTitle !== 'Unknown Problem') {
            await updateProblem(activeProblem.id, { title: detectedTitle, code });
            setActiveProblem(prev => prev ? { ...prev, title: detectedTitle, code } : null);
            toast.success(`Saved as "${detectedTitle}"`);
          } else {
            await updateProblem(activeProblem.id, { code });
            toast.success('Code saved');
          }
        } catch {
          await updateProblem(activeProblem.id, { code });
          toast.success('Code saved');
        }
      } else {
        await updateProblem(activeProblem.id, { code });
        toast.success('Code saved');
      }
      refreshProblems();
    } catch { toast.error('Failed to save'); }
    setIsSaving(false);
  };

  const handleExplain = () => {
    if (!aiEnabled) { toast.error('AI Assistant is disabled.'); return; }
    setIsExplaining(true);
    window.dispatchEvent(new CustomEvent('trigger-explain', { detail: { code } }));
    setTimeout(() => setIsExplaining(false), 1000);
  };

  const handleAnalyze = () => {
    if (!activeProblem) { toast.error('No problem selected'); return; }
    if (!aiEnabled) { toast.error('AI Assistant is disabled.'); return; }
    toast.info('Use the AI chat panel to analyze your code.');
  };

  const handleSaveNotes = useCallback(async (notes: string) => {
    if (!activeProblem) return;
    await supabase.from('problems').update({ notes } as any).eq('id', activeProblem.id);
    toast.success('Notes saved');
  }, [activeProblem]);

  const handleLogout = async () => {
    try { await signOut(); } catch {}
  };

  const handleGitHubPush = async () => {
    const gh = profile?.github_token ? {
      token: profile.github_token,
      repo: profile.github_repo || '',
      autoPush: !!profile.github_auto_push
    } : getGitHubSettings();

    if (!gh || !gh.token || !gh.repo) {
      toast.error('GitHub not configured. Visit Settings > Integrations.');
      return;
    }

    setIsPushing(true);
    const tid = toast.loading('Pushing to GitHub...');
    try {
      const sanitizedTitle = (activeProblem?.title || 'CustomProblem').replace(/[^a-zA-Z0-9]/g, '_');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `${sanitizedTitle}_${timestamp}.java`;
      const filePath = `Java Codes/${fileName}`;
      
      const res = await pushFileToGitHub(
        gh.token, 
        gh.repo, 
        filePath, 
        code, 
        `Custom Code: ${activeProblem?.title || 'Untitled'}`
      );
      
      toast.dismiss(tid);
      if (res.success) {
        toast.success('Successfully pushed to GitHub!');
        if (res.url) window.open(res.url, '_blank');
      } else {
        toast.error('Push failed: ' + res.error);
      }
    } catch (err: any) {
      toast.dismiss(tid);
      toast.error('Error: ' + err.message);
    }
    setIsPushing(false);
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

  const TAB_LABELS: Record<string, string> = {
    console: 'Console',
    tests: `Tests (${testCases.length})`,
    results: testResults.length > 0 ? `Results (${testResults.filter(r => r.status === 'PASSED').length}/${testResults.length})` : 'Results',
    notes: 'Notes',
    solutions: 'Solutions',
    streak: 'Streak',
    daily: 'Daily',
    ai_tutor: 'AI Tutor',
  };

  const codeIsMainStyle = isMainClassStyle(code);

  return (
    <div className="flex h-full flex-col bg-background">
      <Toolbar
        onRun={handleRun}
        onSave={handleSave}
        onAnalyze={handleAnalyze}
        onSettings={() => setShowSettings(true)}
        onLogout={signOut}
        onGitHubPush={handleGitHubPush}
        isPushing={isPushing}
        username={username}
        isRunning={isRunning}
        isSaving={isAutoSaving}
        runDisabled={!activeProblem || execStatus === 'running'}
        aiEnabled={aiEnabled}
        onAIToggle={setAiEnabled}
        isAutoSaving={isAutoSaving}
        codeIsDirty={codeIsDirty}
      />

      <div className="flex flex-1 overflow-hidden flex-col md:flex-row pb-0 md:pb-0">
        {/* MOBILE VIEW */}
        <div className="md:hidden flex-1 flex flex-col overflow-hidden">
          {mobileTab === 'explorer' && (
            <div className="flex-1 flex flex-col overflow-hidden bg-background">
              <div className="p-4 border-b border-border bg-card/50 flex items-center justify-between">
                <span className="font-bold text-sm tracking-tight">Problem Explorer</span>
                <Button variant="ghost" size="sm" onClick={refreshProblems} className="h-8 w-8 p-0">
                   <Loader2 className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ProblemExplorer
                  problems={problems}
                  activeProblemId={activeProblem?.id || null}
                  onSelect={(p) => { handleSelectProblem(p); setMobileTab('editor'); }}
                  onRefresh={refreshProblems}
                />
              </div>
            </div>
          )}

          {mobileTab === 'editor' && (
            <div className="flex-1 flex flex-col overflow-hidden p-2 pb-0">
              <div className={`overflow-hidden rounded-xl border border-border bg-card shadow-sm flex-1`}>
                <CodeEditor code={code} onChange={setCode} />
              </div>
            </div>
          )}

          {mobileTab === 'results' && (
            <div className="flex-1 flex flex-col overflow-hidden bg-background">
              <div className="flex items-center border-b border-border bg-card/60 px-1 overflow-x-auto scrollbar-none shrink-0">
                {(['console', 'tests', 'results', 'notes', 'solutions', 'streak', 'daily'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setBottomTab(tab)}
                    className={`px-4 py-3 text-[10px] font-bold tracking-wider uppercase transition-colors whitespace-nowrap relative ${
                      bottomTab === tab
                        ? 'text-primary after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:bg-primary after:rounded-full'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {TAB_LABELS[tab] || tab}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-hidden">
                {bottomTab === 'console' && (
                   <ConsolePanel
                    entries={consoleEntries}
                    isRunning={isRunning || isRunningTests}
                    onClear={() => { setConsoleEntries([]); setWaitingForInput(false); stdinResolverRef.current = null; }}
                    isCollapsed={false}
                    onToggleCollapse={() => {}}
                    isFullscreen={false}
                    onToggleFullscreen={() => {}}
                    waitingForInput={waitingForInput}
                    onStdinSubmit={handleStdinSubmit}
                  />
                )}
                {bottomTab === 'tests' && (
                  <TestCasePanel
                    testCases={testCases}
                    testResults={testResults}
                    onAdd={handleAddTestCase}
                    onUpdate={handleUpdateTestCase}
                    onDelete={handleDeleteTestCase}
                    onGenerateAI={handleGenerateAITests}
                    isGenerating={isGeneratingTests}
                  />
                )}
                {bottomTab === 'results' && (
                  <ScrollArea className="h-full">
                    <div className="p-3 pb-4">
                      {testResults.length > 0 ? (
                        <TestResultsTable results={testResults} />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground py-20">
                          Run tests to see results
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
                {bottomTab === 'notes' && (
                  <div className="flex-1 overflow-hidden h-full">
                    <NotesPanel notes={(activeProblem as any)?.notes || ''} onSave={handleSaveNotes} />
                  </div>
                )}
                {bottomTab === 'solutions' && (
                   <div className="h-full overflow-hidden">
                      <SolutionComparison code={code} problemTitle={activeProblem?.title} />
                   </div>
                )}
              </div>
            </div>
          )}

          {mobileTab === 'ai' && (
            <div className="flex-1 flex flex-col overflow-hidden bg-background">
              <AIChatPanel 
                code={code} 
                problemId={activeProblem?.id || null} 
                problemDescription={(activeProblem as any)?.description}
                aiEnabled={aiEnabled} 
              />
            </div>
          )}

          <div className="shrink-0 border-t border-border bg-card/95 backdrop-blur px-2 py-2">
            <div className="grid grid-cols-3 gap-2">
              <Button onClick={handleRun} disabled={isRunning || isRunningTests} size="sm" className="h-10 gap-2 font-bold rounded-lg bg-success hover:bg-success/90 text-success-foreground">
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" fill="currentColor" />}
                Run
              </Button>
              <Button onClick={handleRunTests} disabled={isRunning || isRunningTests || testCases.length === 0} size="sm" variant="outline" className="h-10 gap-2 font-bold rounded-lg border-primary/20">
                {isRunningTests ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                Test
              </Button>
              {(isRunning || isRunningTests) ? (
                <Button onClick={() => { stopExecution(); import('@/lib/test-runner').then(m => m.stopTestExecution()); setIsRunning(false); setIsRunningTests(false); setExecStatus('stopped' as any); }} size="sm" variant="destructive" className="h-10 gap-2 font-bold rounded-lg">
                  <Square className="h-4 w-4" /> Stop
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={isSaving} size="sm" variant="secondary" className="h-10 gap-2 font-bold rounded-lg">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
              )}
            </div>
          </div>

          {/* DASHBOARD MOBILE BOTTOM NAV */}
          <nav className="shrink-0 h-14 bg-card border-t border-border z-[100] flex items-center justify-around px-2">
            <button 
              onClick={() => setMobileTab('explorer')} 
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-300 ${mobileTab === 'explorer' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${mobileTab === 'explorer' ? 'bg-primary/15' : ''}`}>
                <FolderOpen className={`h-5 w-5 ${mobileTab === 'explorer' ? 'stroke-[2.5px]' : ''}`} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${mobileTab === 'explorer' ? 'opacity-100' : 'opacity-60'}`}>Files</span>
            </button>
            <button 
              onClick={() => setMobileTab('editor')} 
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-300 ${mobileTab === 'editor' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${mobileTab === 'editor' ? 'bg-primary/15' : ''}`}>
                <Code2 className={`h-5 w-5 ${mobileTab === 'editor' ? 'stroke-[2.5px]' : ''}`} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${mobileTab === 'editor' ? 'opacity-100' : 'opacity-60'}`}>Code</span>
            </button>
            <button 
              onClick={() => setMobileTab('results')} 
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-300 ${mobileTab === 'results' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${mobileTab === 'results' ? 'bg-primary/15' : ''}`}>
                <FlaskConical className={`h-5 w-5 ${mobileTab === 'results' ? 'stroke-[2.5px]' : ''}`} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${mobileTab === 'results' ? 'opacity-100' : 'opacity-60'}`}>Console</span>
            </button>
            <button 
              onClick={() => setMobileTab('ai')} 
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-300 ${mobileTab === 'ai' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${mobileTab === 'ai' ? 'bg-primary/15' : ''}`}>
                <MessageSquare className={`h-5 w-5 ${mobileTab === 'ai' ? 'stroke-[2.5px]' : ''}`} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${mobileTab === 'ai' ? 'opacity-100' : 'opacity-60'}`}>AI Tutor</span>
            </button>
          </nav>
        </div>

        {/* DESKTOP VIEW */}
        {/* Left: Problem Explorer */}
        <div className="hidden md:block w-56 shrink-0 border-r border-border">
          <ProblemExplorer
            problems={problems}
            activeProblemId={activeProblem?.id || null}
            onSelect={handleSelectProblem}
            onRefresh={refreshProblems}
          />
        </div>

        {/* Center: Editor + Bottom Panels */}
        <div className="hidden md:flex flex-1 flex-col overflow-hidden p-2 sm:p-4 bg-background/50 animate-in-up">
          <div className={`overflow-hidden rounded-xl border border-border bg-card shadow-sm mb-2 sm:mb-4 ${consoleFullscreen ? 'hidden' : 'flex-1'}`}>
            <CodeEditor code={code} onChange={setCode} />
          </div>

          {!consoleFullscreen && (
          <div className="flex items-center gap-1.5 sm:gap-2 border-t border-border bg-card/80 backdrop-blur-sm px-2 sm:px-4 py-1.5 overflow-x-auto scrollbar-none">
              <Button onClick={handleRun} disabled={isRunning || isRunningTests} size="sm" className="h-8 gap-1.5 px-4 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-sm">
                {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                {isRunning ? 'Running...' : 'Run Code'}
              </Button>
              {(isRunning || isRunningTests) && (
                <Button onClick={() => { stopExecution(); import('@/lib/test-runner').then(m => m.stopTestExecution()); setIsRunning(false); setIsRunningTests(false); setExecStatus('stopped' as any); }} size="sm" variant="destructive" className="h-8 gap-1.5 px-3 text-xs font-semibold rounded-md shrink-0">
                  <Square className="h-3.5 w-3.5" /> Stop
                </Button>
              )}
              <Button onClick={handleRunTests} disabled={isRunning || isRunningTests || testCases.length === 0} size="sm" variant="outline" className="h-8 gap-1.5 px-3 sm:px-4 text-xs font-semibold rounded-md shrink-0 border-primary/30 hover:bg-primary/10">
                {isRunningTests ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5 text-primary" />}
                <span className="hidden sm:inline">{isRunningTests ? 'Testing...' : `Run Tests (${testCases.length})`}</span>
                <span className="sm:hidden">Test</span>
              </Button>
              <Button onClick={handleExplain} disabled={isExplaining || !aiEnabled} size="sm" variant="ghost" className="h-8 gap-1.5 px-3 text-xs font-medium rounded-md shrink-0 hidden sm:flex">
                {isExplaining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                Explain
              </Button>
              {codeIsMainStyle && (
                <span className="text-[10px] text-emerald-500 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full hidden sm:inline">
                  Main Mode
                </span>
              )}
              <div className="ml-auto flex items-center gap-2 shrink-0">
                <div className="hidden sm:block"><ProblemTimer problemId={activeProblem?.id || null} /></div>
                <ExecutionStatus status={execStatus} />
              </div>
            </div>
          )}

          <div
            onMouseDown={handleDividerMouseDown}
            className="resize-handle h-1 cursor-row-resize border-t border-border hover:bg-foreground/10 transition-colors"
          />

          <div
            className={`shrink-0 border border-border rounded-xl bg-card shadow-sm overflow-hidden ${consoleFullscreen ? 'flex-1' : ''}`}
            style={consoleFullscreen ? {} : { height: consoleCollapsed ? 36 : consoleHeight }}
          >
            <div className="flex items-center border-b border-border bg-card px-1 overflow-x-auto scrollbar-none">
              {(['console', 'tests', 'results', 'notes', 'solutions', 'streak', 'daily'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setBottomTab(tab); setConsoleCollapsed(false); }}
                  className={`px-3 py-2 text-[11px] font-medium tracking-wide transition-colors whitespace-nowrap relative ${
                    bottomTab === tab
                      ? 'text-foreground tab-active'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {TAB_LABELS[tab] || tab}
                </button>
              ))}
            </div>

            <div className="flex h-[calc(100%-32px)]">
              {bottomTab === 'console' && (
                <div className="flex flex-1 flex-col">
                  <div className="flex-1 overflow-hidden">
                    <ConsolePanel
                      entries={consoleEntries}
                      isRunning={isRunning || isRunningTests}
                      onClear={() => { setConsoleEntries([]); setWaitingForInput(false); stdinResolverRef.current = null; }}
                      isCollapsed={consoleCollapsed}
                      onToggleCollapse={() => setConsoleCollapsed(c => !c)}
                      isFullscreen={consoleFullscreen}
                      onToggleFullscreen={() => setConsoleFullscreen(f => !f)}
                      waitingForInput={waitingForInput}
                      onStdinSubmit={handleStdinSubmit}
                    />
                  </div>
                </div>
              )}

              {bottomTab === 'tests' && (
                <div className="flex flex-1 flex-col">
                  <div className="flex-1 overflow-hidden">
                    <TestCasePanel
                      testCases={testCases}
                      testResults={testResults}
                      onAdd={handleAddTestCase}
                      onUpdate={handleUpdateTestCase}
                      onDelete={handleDeleteTestCase}
                      onGenerateAI={handleGenerateAITests}
                      isGenerating={isGeneratingTests}
                    />
                  </div>
                </div>
              )}

              {bottomTab === 'results' && (
                <div className="flex flex-1 flex-col">
                  <div className="flex-1 overflow-auto p-3">
                    {testResults.length > 0 ? (
                      <TestResultsTable results={testResults} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        Run tests to see results
                      </div>
                    )}
                  </div>
                </div>
              )}

              {bottomTab === 'daily' && (
                <div className="flex flex-1 flex-col">
                  <div className="flex-1 overflow-auto p-3">
                    <DailyChallenge />
                  </div>
                </div>
              )}

              {bottomTab === 'notes' && (
                <div className="flex flex-1 flex-col">
                  <div className="flex-1 overflow-hidden">
                    <NotesPanel notes={(activeProblem as any)?.notes || ''} onSave={handleSaveNotes} />
                  </div>
                </div>
              )}

              {bottomTab === 'streak' && (
                <div className="flex flex-1 flex-col">
                  <div className="flex-1 overflow-auto">
                    <StreakPanel />
                  </div>
                </div>
              )}

              {bottomTab === 'solutions' && (
                <div className="flex flex-1 flex-col lg:flex-row">
                  <div className="flex-1 overflow-hidden">
                    <SolutionComparison code={code} problemTitle={activeProblem?.title} />
                  </div>
                </div>
              )}
              {bottomTab === 'ai_tutor' as any && (
                <div className="flex flex-1 flex-col">
                  <div className="flex-1 overflow-hidden">
                    <AIChatPanel 
                      code={code} 
                      problemId={activeProblem?.id || null} 
                      problemDescription={(activeProblem as any)?.description}
                      aiEnabled={aiEnabled} 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: AI Panel (Globally visible) */}
        {aiEnabled && (
          <div className="hidden lg:block w-[320px] xl:w-[380px] shrink-0 border-l border-border bg-card overflow-hidden surface-elevated rounded-l-2xl my-4 mr-4 animate-in-up">
            <AIChatPanel 
              code={code} 
              problemId={activeProblem?.id || null} 
              problemDescription={(activeProblem as any)?.description}
              aiEnabled={aiEnabled} 
            />
          </div>
        )}
      </div>

      <SettingsDialog open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

export default Dashboard;
