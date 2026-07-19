import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  ArrowLeft, Play, FlaskConical, Loader2, CheckCircle2, XCircle, Brain, ChevronRight, 
  Code2, GitCompare, Cloud, Keyboard, Sparkles, AlertTriangle, Zap, TrendingUp, 
  Trophy, Eye, EyeOff, BarChart3, ChevronDown, ChevronUp, MessageSquare, 
  FileText, Bot, Square, Workflow, Shield, Lightbulb, Github, BookOpen, RotateCcw,
  ExternalLink, Search, AlertCircle, Target, History, Settings, Maximize2, Minimize2,
  MoreHorizontal, Info
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { getGitHubSettings, pushFileToGitHub } from '@/lib/github';
import { CONTEST_PROBLEMS } from '../lib/contest-problems-data';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAutosave } from '@/hooks/use-autosave';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import CodeEditor from '@/components/CodeEditor';
import AIChatPanel from '@/components/AIChatPanel';
import ConsolePanel, { ConsoleEntry } from '@/components/ConsolePanel';
import TestCasePanel, { TestResult } from '@/components/TestCasePanel';
import TestResultsTable from '@/components/TestResultsTable';
import ExecutionStatus from '@/components/ExecutionStatus';
import ProblemTimer from '@/components/ProblemTimer';
import CodeSnippets from '@/components/CodeSnippets';
import SolutionComparison from '@/components/SolutionComparison';
import ExecutionHistoryPanel, { saveExecutionHistory } from '@/components/ExecutionHistoryPanel';
import KeyboardShortcutsDialog from '@/components/KeyboardShortcutsDialog';
import SuccessCelebration from '@/components/SuccessCelebration';
import { ReportIssueDialog } from '@/components/ReportIssueDialog';
import { useUser } from '@/lib/user-context';
import { supabase } from '@/integrations/supabase/client';
import { STRIVER_ROADMAP, getDifficultyBg, type RoadmapProblem } from '@/lib/striver-roadmap-data';
import { NEETCODE_ROADMAP } from '@/lib/neetcode-roadmap-data';
import { LEETCODE_TOP150_ROADMAP } from '@/lib/leetcode-top150-data';
import { getProblemDetail, PROBLEM_DETAILS, type ProblemDetail } from '@/lib/striver-problem-details';
import { executeJavaCode, stopExecution, type ExecutionStatus as ExecStatusType } from '@/lib/executor';
import ReactMarkdown from 'react-markdown';
import { HeaderMenu } from '@/components/AppShell';


interface EnhancedDetail extends ProblemDetail {
  constraints?: string[];
  hints?: string[];
  approach?: string;
}

function getCachedDetail(key: string): EnhancedDetail | null {
  try {
    const cached = localStorage.getItem(`problem-detail-${key}`);
    if (cached) return JSON.parse(cached);
  } catch {}
  return null;
}

function setCachedDetail(key: string, detail: EnhancedDetail) {
  try {
    localStorage.setItem(`problem-detail-${key}`, JSON.stringify(detail));
  } catch {}
}

const ProblemWorkspace = () => {
  const { key } = useParams<{ key: string }>();
  const [searchParams] = useSearchParams();
  const contestMode = searchParams.get('contestMode') === 'true';
  const contestId = searchParams.get('contestId');
  const generatorMode = searchParams.get('generatorMode') === 'true';
  const genId = searchParams.get('genId');
  const customMode = searchParams.get('customMode') === 'true';
  const customId = searchParams.get('customId');
  const navigate = useNavigate();
  const { authUser, profile, isAdmin } = useUser();

  const allRoadmaps = useMemo(() => [
    ...(STRIVER_ROADMAP || []), 
    ...(NEETCODE_ROADMAP || []), 
    ...(LEETCODE_TOP150_ROADMAP || [])
  ], []);

  // Find the problem from any roadmap OR contest problems OR generated
  const roadmapProblem = useMemo(() => {
    if (!key) return null;
    
    // Check roadmap sheets first
    for (const topic of allRoadmaps) {
      if (!topic?.problems) continue;
      const found = topic.problems.find(p => p.key === key);
      if (found) return { ...found, topic: topic.name };
    }
    
    // Check contest problems
    if (Array.isArray(CONTEST_PROBLEMS)) {
      const contestFound = CONTEST_PROBLEMS.find(p => p.key === key);
      if (contestFound) return { ...contestFound, topic: 'Contest Challenge' };
    }

    // Check for Generator Mode
    if (generatorMode && genId === key) {
      return {
        key,
        title: searchParams.get('title') || 'Generated Problem',
        difficulty: (searchParams.get('difficulty') as any) || 'Medium',
        topic: 'AI Generated'
      } as any;
    }

    // Check for Custom Mode
    if (customMode && customId === key) {
      return {
        key,
        title: searchParams.get('title') || 'Custom Problem',
        difficulty: (searchParams.get('difficulty') as any) || 'Medium',
        topic: 'Custom Lab'
      } as any;
    }
    
    return null;
  }, [key, generatorMode, genId, customMode, customId, searchParams]);

  const hasHardcodedDetail = key ? !!PROBLEM_DETAILS[key] : false;

  const [detail, setDetail] = useState<EnhancedDetail>(() => {
    if (!roadmapProblem) return getProblemDetail('', 'Unknown', 'Medium');
    // Check cache first
    if (key) {
      const cached = getCachedDetail(key);
      if (cached) return cached;
    }
    return getProblemDetail(roadmapProblem.key, roadmapProblem.title, roadmapProblem.difficulty);
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  // Approach tabs
  type Approach = 'brute' | 'better' | 'optimal';
  const APPROACHES: { key: Approach; label: string; icon: React.ReactNode; color: string }[] = [
    { key: 'brute', label: 'Brute Force', icon: <Zap className="h-3 w-3" />, color: 'text-orange-500' },
    { key: 'better', label: 'Better', icon: <TrendingUp className="h-3 w-3" />, color: 'text-blue-500' },
    { key: 'optimal', label: 'Optimal', icon: <Trophy className="h-3 w-3" />, color: 'text-emerald-500' },
  ];
  const [activeApproach, setActiveApproach] = useState<Approach>('brute');
  const [codes, setCodes] = useState<Record<Approach, string>>({
    brute: detail.starterCode,
    better: detail.starterCode,
    optimal: detail.starterCode,
  });
  const [generationCount, setGenerationCount] = useState(0);
  // Track whether codes have been loaded from DB to prevent generateFullDetail from overwriting
  const codesLoadedFromDb = useRef(false);
  // Track whether we are in the middle of loading codes for a new problem
  const [isCodeLoading, setIsCodeLoading] = useState(false);
  // The key that the current codes belong to — used to prevent stale saves
  const codesKeyRef = useRef<string | undefined>(key);

  // Convenience: active code getter/setter
  const code = codes[activeApproach];
  const setCode = useCallback((valOrFn: string | ((prev: string) => string)) => {
    setCodes(prev => ({
      ...prev,
      [activeApproach]: typeof valOrFn === 'function' ? valOrFn(prev[activeApproach]) : valOrFn,
    }));
  }, [activeApproach]);

  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [waitingForInput, setWaitingForInput] = useState(false);
  // Holds a resolve callback that ConsolePanel calls when the user submits stdin
  const stdinResolverRef = useRef<((value: string) => void) | null>(null);
  const [execStatus, setExecStatus] = useState<ExecStatusType>('ready');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [bottomTab, setBottomTab] = useState<'description' | 'console' | 'results' | 'history' | 'snippets' | 'solutions' | 'analysis'>('description');
  const [consoleHeight, setConsoleHeight] = useState(320);
  const [showDescription, setShowDescription] = useState(true);
  const [timeSpent, setTimeSpent] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationTime, setCelebrationTime] = useState<number | undefined>();
  const [focusMode, setFocusMode] = useState(false);
  const [mobileTab, setMobileTab] = useState<'problem' | 'editor' | 'results' | 'ai'>('editor');

  // Complexity analysis state
  interface ComplexityResult {
    timeComplexity: string;
    spaceComplexity: string;
    suggestion: string;
    optimizationPossible?: boolean;
    betterApproach?: string;
    fullExplanation?: string;
  }
  const [analysisResult, setAnalysisResult] = useState<ComplexityResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [showFullExplanation, setShowFullExplanation] = useState(false);
  const [submissionHistory, setSubmissionHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ★ STEP 1: Immediately reset codes when problem key changes (synchronous).
  // This runs BEFORE the async load effect and prevents the old problem's code
  // from being visible or auto-saved while the new problem is loading.
  useEffect(() => {
    if (!key) return;
    codesKeyRef.current = key;
    
    // STEP 1: Calculate the fresh initial detail for the NEW key immediately.
    // This prevents using stale detail.starterCode from the previous problem.
    const initialDetail = getProblemDetail(key, roadmapProblem?.title || 'Problem', roadmapProblem?.difficulty || 'Medium');
    const placeholder = initialDetail.starterCode || '';

    // STEP 2: Synchronously reset all problem-specific state
    setDetail(initialDetail);
    setCodes({ brute: placeholder, better: placeholder, optimal: placeholder });
    setIsCodeLoading(true);
    setConsoleEntries([]);
    setTestResults([]);
    setExecStatus('ready');
    setBottomTab('description');
    setGenerationCount(0);
    
    // Immediately reset the autosave baseline so the 2s debounce doesn't
    // fire with stale code after navigation.
    wsResetSaved(placeholder);
  }, [key]); // intentionally only [key]

  // ★ STEP 2: Save to localStorage — but ONLY if the code belongs to the current key.
  // This prevents the stale-code write that happens during the async loading window.
  useEffect(() => {
    if (!key || codesKeyRef.current !== key || isCodeLoading) return;
    const prefix = contestMode 
      ? `contest_${contestId || 'anon'}_` 
      : generatorMode 
      ? `gen_${genId || 'anon'}_` 
      : customMode
      ? `custom_${customId || 'anon'}_`
      : '';
    const saveKey = `${prefix}${key}__${activeApproach}`;
    try { localStorage.setItem(`workspace-code-${authUser?.id || 'anon'}-${saveKey}`, code); } catch {}
  }, [code, key, activeApproach, isCodeLoading, contestMode, contestId, generatorMode, genId, customMode, customId, authUser?.id]);

  // Debounced Supabase autosave (every 2s)
  const autosaveWorkspaceCode = useCallback(async (approach: Approach, val: string) => {
    if (!authUser || !key) return;
    const prefix = contestMode 
      ? `contest_${contestId || 'anon'}_` 
      : generatorMode 
      ? `gen_${genId || 'anon'}_` 
      : customMode
      ? `custom_${customId || 'anon'}_`
      : '';
    
    // Construct the correct key. The 'approach' arg should be just 'brute', 'better', or 'optimal'.
    const saveKey = `${prefix}${key}__${approach}`;
    
    try {
      const { error } = await supabase.from('user_code_saves').upsert({
        user_id: authUser.id,
        problem_key: saveKey,
        code: val,
        language: 'java',
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'user_id,problem_key' });
      if (error) console.error('Autosave DB error:', error);
    } catch (e) {
      console.error('Autosave exception:', e);
    }
  }, [authUser, key, contestMode, contestId, generatorMode, genId, customMode, customId]);

  const bruteAutosave = useAutosave(codes.brute, () => autosaveWorkspaceCode('brute', codes.brute), {
    delay: 1000,
    maxDelay: 2000, // Ensure save at least every 2s even if typing
    enabled: !!key && !!authUser && !isCodeLoading,
    key: `${key}__brute`,
  });
  const betterAutosave = useAutosave(codes.better, () => autosaveWorkspaceCode('better', codes.better), {
    delay: 1000,
    maxDelay: 2000,
    enabled: !!key && !!authUser && !isCodeLoading,
    key: `${key}__better`,
  });
  const optimalAutosave = useAutosave(codes.optimal, () => autosaveWorkspaceCode('optimal', codes.optimal), {
    delay: 1000,
    maxDelay: 2000,
    enabled: !!key && !!authUser && !isCodeLoading,
    key: `${key}__optimal`,
  });

  const activeAutosave = useMemo(() => {
    if (activeApproach === 'brute') return bruteAutosave;
    if (activeApproach === 'better') return betterAutosave;
    return optimalAutosave;
  }, [activeApproach, bruteAutosave, betterAutosave, optimalAutosave]);

  const handleApproachChange = useCallback((newApproach: Approach) => {
    if (activeAutosave.isDirty) {
      activeAutosave.triggerSave();
    }
    setActiveApproach(newApproach);
  }, [activeApproach, activeAutosave]);

  const wsCodeDirty = activeAutosave.isDirty;
  const wsAutoSaving = activeAutosave.isSaving;
  const wsResetSaved = activeAutosave.resetSavedValue;

  // Reset autosave ref when switching approaches so it doesn't incorrectly detect dirty
  useEffect(() => {
    wsResetSaved(codes[activeApproach]);
  }, [activeApproach, wsResetSaved]);

  const regenerateActiveTab = async () => {
    if (!key) return;
    
    // 1. Show immediate feedback
    const loadingPlaceholder = `// 🤖 AI is re-generating the official problem signature for the ${activeApproach} tab...\npublic void solve() {\n    \n}`;
    setCodes(prev => ({ ...prev, [activeApproach]: loadingPlaceholder }));
    setGenerationCount(prev => prev + 1);
    
    setIsGenerating(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/generate-problem-detail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          key, 
          title: roadmapProblem?.title, 
          difficulty: roadmapProblem?.difficulty,
          force: true 
        }),
      });
      
      if (response.ok) {
        const generated = await response.json();
        
        if (generated.error) {
          toast.error(`AI Error: ${generated.error}`);
          // Revert to a basic signature if AI fails, so user isn't stuck with the placeholder
          const fallback = `class Solution {\n    public void solve() {\n        // Your code here\n    }\n}`;
          setCodes(prev => ({ ...prev, [activeApproach]: fallback }));
        } else if (generated.starterCode) {
          setCodes(prev => ({ ...prev, [activeApproach]: generated.starterCode }));
          // Also update the global detail so subsequent tab resets use the new one
          setDetail(prev => ({ ...prev, starterCode: generated.starterCode }));
          toast.success(`🚀 Signature regenerated for ${activeApproach}!`);
        } else {
          toast.error('AI returned an empty signature.');
          const fallback = `class Solution {\n    public void solve() {\n        // Your code here\n    }\n}`;
          setCodes(prev => ({ ...prev, [activeApproach]: fallback }));
        }
      } else {
        toast.error('AI regeneration failed (Server Error).');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to connect to AI.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Fetch full problem details from Java Spring Boot Backend
  const generateFullDetail = useCallback(async (force = false) => {
    if (!roadmapProblem || !key || (hasHardcodedDetail && !force)) return;
    const cached = getCachedDetail(key);
    const isValid = (d: any) => d && Array.isArray(d.testCases) && d.testCases.length >= 1 && d.testCases.every((tc: any) => tc.expected && String(tc.expected).trim() !== '');

    const isPlaceholder = (c: string) => !c || c.trim().length < 50 || c.includes('// 🤖 AI is generating') || c.includes('public void solve()') || c.includes('public int search');
    
    if (force) {
      setGenerationCount(prev => prev + 1);
      // We no longer clear the codes here, as the user has a separate refresh button for the function signature.
    }

    if (isValid(cached) && !force) {
      setDetail(cached!);
      if (!codesLoadedFromDb.current && cached!.starterCode) {
        setCodes(prev => ({
          brute: isPlaceholder(prev.brute) ? cached!.starterCode : prev.brute,
          better: isPlaceholder(prev.better) ? cached!.starterCode : prev.better,
          optimal: isPlaceholder(prev.optimal) ? cached!.starterCode : prev.optimal,
        }));
      }
      return;
    }
    setIsGenerating(true);
    setGenerateError('');
    try {
      // First check shared DB cache (populated by any previous user)
      const { data: cachedRow } = await supabase
        .from('problem_test_cases')
        .select('*')
        .eq('problem_key', key)
        .maybeSingle();

      if (cachedRow && Array.isArray((cachedRow as any).test_cases) && (cachedRow as any).test_cases.length >= 1) {
        const c: any = cachedRow;
        
        // Quality check: ensure test cases actually have expected values
        const tcs = c.test_cases || [];
        const isLowQuality = tcs.some((tc: any) => !tc.expected || String(tc.expected).trim() === '');
        
        if (!isLowQuality && !force) {
          const enhanced: EnhancedDetail = {
            key,
            description: c.description || detail.description,
            examples: c.examples || [],
            starterCode: c.starter_code || detail.starterCode,
            testCases: c.test_cases,
            functionName: c.function_name || 'solve',
            returnType: c.return_type || 'void',
            params: c.params || [],
            constraints: c.constraints || [],
            hints: c.hints || [],
          };
          setCachedDetail(key, enhanced);
          setDetail(enhanced);
          if (!codesLoadedFromDb.current) {
            setCodes(prev => ({
              brute: isPlaceholder(prev.brute) ? enhanced.starterCode : prev.brute,
              better: isPlaceholder(prev.better) ? enhanced.starterCode : prev.better,
              optimal: isPlaceholder(prev.optimal) ? enhanced.starterCode : prev.optimal,
            }));
          }
          setIsGenerating(false);
          return;
        }
      }

      // If Custom Mode, check custom_problems table instead of generator or roadway
      if (customMode && customId) {
        const { data: customData } = await supabase
          .from('custom_problems')
          .select('*')
          .eq('id', customId)
          .single();
        
        if (customData) {
          const c = customData as any;
          const enhanced: EnhancedDetail = {
            key: customId,
            description: c.description,
            examples: [], // Custom problems might not have formal examples array yet
            starterCode: c.starter_code,
            testCases: c.test_cases || [],
            functionName: 'solve', // Defaults for custom
            returnType: 'void',
            params: [],
            constraints: [],
            hints: []
          };
          setCachedDetail(key, enhanced);
          setDetail(enhanced);
          if (!codesLoadedFromDb.current || force) {
            setCodes(prev => ({
              brute: (force || isPlaceholder(prev.brute)) ? enhanced.starterCode : prev.brute,
              better: (force || isPlaceholder(prev.better)) ? enhanced.starterCode : prev.better,
              optimal: (force || isPlaceholder(prev.optimal)) ? enhanced.starterCode : prev.optimal,
            }));
          }
          setIsGenerating(false);
          return;
        }
      }

      setIsGenerating(true);
      const loadingToast = force ? toast.loading('Re-generating problem with high-quality test cases...') : null;
      
      // Cache miss or force → invoke edge function
      const { data, error } = await supabase.functions.invoke('generate-problem-detail', {
        body: {
          problem_key: key,
          title: roadmapProblem.title,
          difficulty: roadmapProblem.difficulty,
          topic: (roadmapProblem as any).topic || '',
          force: force
        },
      });

      if (loadingToast) toast.dismiss(loadingToast);

      if (error) {
        setIsGenerating(false);
        setGenerateError('Failed to generate problem details. Please try again.');
        return;
      }
      
      const generated = data?.detail;
      if (generated) {
        // Client-side parsing of test cases
        let testCases = (generated.testCases || []).map((tc: any) => ({
          inputs: tc.inputs || {},
          expected: String(tc.expected || tc.expectedOutput || '').trim(),
        })).filter((tc: any) => Object.keys(tc.inputs).length > 0 && tc.expected);

        // Robust fallback: derive from examples if no test cases were provided
        if (testCases.length === 0 && Array.isArray(generated.examples) && Array.isArray(generated.params)) {
          const paramNames: string[] = generated.params.map((p: any) => p?.name).filter(Boolean);
          testCases = generated.examples.map((ex: any) => {
            const raw = String(ex?.input ?? '');
            const inputs: Record<string, string> = {};
            
            // Try to match "param = value" pairs
            const assignments = raw.split(/,\s*(?=[a-zA-Z_]\w*\s*=)/);
            let matched = 0;
            for (const part of assignments) {
              const m = part.match(/^\s*([a-zA-Z_]\w*)\s*=\s*([\s\S]+?)\s*$/);
              if (m && paramNames.includes(m[1])) {
                inputs[m[1]] = m[2];
                matched++;
              }
            }
            
            // If no assignments found but we have one parameter, use the whole input string
            if (matched === 0 && paramNames.length === 1) {
              inputs[paramNames[0]] = raw.replace(/^[a-zA-Z_]\w*\s*=\s*/, '');
              matched = 1;
            }
            
            return matched > 0 ? { inputs, expected: String(ex?.output ?? '').trim() } : null;
          }).filter(Boolean) as any[];
        }

        // AUTO-RETRY once if still no test cases and this wasn't already a forced run
        if (testCases.length === 0 && !force) {
          console.warn('AI returned no test cases. Retrying with force...');
          setIsGenerating(false);
          return generateFullDetail(true);
        }

        const enhanced: EnhancedDetail = {
          key,
          description: generated.description || detail.description,
          examples: generated.examples || [],
          starterCode: generated.starterCode || detail.starterCode,
          testCases,
          functionName: generated.functionName || 'solve',
          returnType: generated.returnType || 'void',
          params: generated.params || [],
          constraints: generated.constraints || [],
          hints: generated.hints || [],
          approach: generated.approach,
        };
        setCachedDetail(key, enhanced);
        setDetail(enhanced);
        if (generated.starterCode) {
          setCodes(prev => {
            // Only update the editor if this is an initial load (not force) and the current code is a placeholder.
            // If it's a force-regeneration, we leave the editor exactly as it is.
            const newBrute = (!force && isPlaceholder(prev.brute)) ? generated.starterCode : prev.brute;
            const newBetter = (!force && isPlaceholder(prev.better)) ? generated.starterCode : prev.better;
            const newOptimal = (!force && isPlaceholder(prev.optimal)) ? generated.starterCode : prev.optimal;
            
            if (newBrute !== prev.brute || newBetter !== prev.better || newOptimal !== prev.optimal) {
               toast.success('🚀 AI has updated the problem signature across all tabs!');
            }
            return { brute: newBrute, better: newBetter, optimal: newOptimal };
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      setGenerateError('Could not generate problem details. You can still code!');
    }
    setIsGenerating(false);
    if (force) toast.success('Successfully purged bad cache and regenerated problem details!');
  }, [key, roadmapProblem, hasHardcodedDetail]);

  // ★ STEP 3: Async load of saved codes. Uses a snapshot of `key` at call time
  // to discard results that arrived after the user has already navigated away.
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const loadKey = key; // snapshot to detect stale results
    codesLoadedFromDb.current = false;

    const loadAllCodes = async () => {
      const approaches: Approach[] = ['brute', 'better', 'optimal'];
      const loaded: Record<string, string> = {};
      let anyFromDb = false;
      for (const approach of approaches) {
        const saveKey = `${loadKey}__${approach}`;
        let savedCode: string | null = null;
        if (authUser && loadKey) {
          try {
            const { data, error } = await supabase
              .from('user_code_saves')
              .select('code')
              .eq('user_id', authUser.id)
              .eq('problem_key', saveKey)
              .maybeSingle();
            if (error) console.error('Load code error:', error);
            if (data && (data as any).code) { savedCode = (data as any).code; anyFromDb = true; }
          } catch (e) { console.error('Load code exception:', e); }
        }
        if (!savedCode) {
          savedCode = localStorage.getItem(`workspace-code-${authUser?.id || 'anon'}-${saveKey}`);
        }
        // Also check legacy key (no approach suffix) for brute force migration
        if (!savedCode && approach === 'brute') {
          if (authUser && loadKey) {
            try {
              const { data } = await supabase
                .from('user_code_saves')
                .select('code')
                .eq('user_id', authUser.id)
                .eq('problem_key', loadKey)
                .maybeSingle();
              if (data && (data as any).code) { savedCode = (data as any).code; anyFromDb = true; }
            } catch {}
          }
          if (!savedCode) savedCode = localStorage.getItem(`workspace-code-${authUser?.id || 'anon'}-${loadKey}`);
        }
        if (savedCode) {
          try { localStorage.setItem(`workspace-code-${authUser?.id || 'anon'}-${saveKey}`, savedCode); } catch {}
        }
        const freshPlaceholder = getProblemDetail(loadKey, roadmapProblem?.title || 'Problem', roadmapProblem?.difficulty || 'Medium').starterCode;
      loaded[approach] = savedCode || freshPlaceholder;
      }

      // Discard if user navigated away while we were fetching
      if (cancelled || loadKey !== codesKeyRef.current) return;

      codesLoadedFromDb.current = anyFromDb;
      setCodes({ brute: loaded.brute, better: loaded.better, optimal: loaded.optimal });
      wsResetSaved(loaded[activeApproach] || getProblemDetail(loadKey, '', '').starterCode);
      setIsCodeLoading(false);
    };

    loadAllCodes();
    if (!hasHardcodedDetail) {
      generateFullDetail();
    }
    return () => { cancelled = true; };
  }, [key, authUser?.id]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod) {
        if (e.key === 'Enter') { e.preventDefault(); handleRun(); }
        if (e.key === 's') { e.preventDefault(); /* autosave handles this */ toast.success('Auto-saved'); }
        if (e.shiftKey && e.key === 'E') { e.preventDefault(); window.dispatchEvent(new CustomEvent('trigger-explain', { detail: '__analyze__' })); }
        if (e.shiftKey && e.key === 'T') { e.preventDefault(); handleRunTests(); }
        if (e.shiftKey && e.key === 'H') { e.preventDefault(); setShowDescription(p => !p); }
        if (e.key === 'k') { e.preventDefault(); setShowShortcuts(p => !p); }
        if (e.key === '1') { e.preventDefault(); setBottomTab('description'); }
        if (e.key === '2') { e.preventDefault(); setBottomTab('console'); }
        if (e.key === '3') { e.preventDefault(); setBottomTab('results'); }
        if (e.key === '4') { e.preventDefault(); setBottomTab('analysis'); }
        if (e.key === '5') { e.preventDefault(); setBottomTab('history' as any); }
        if (e.key === '6') { e.preventDefault(); setBottomTab('snippets' as any); }
        if (e.key === '7') { e.preventDefault(); setBottomTab('history'); }
        if (e.key === '8') { e.preventDefault(); setBottomTab('snippets'); }
        if (e.key === '9') { e.preventDefault(); setBottomTab('solutions'); }
      }
      if (e.key === 'Escape') { setShowShortcuts(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Listen for AI dropdown trigger to generate test cases and add them to the Tests tab.
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  useEffect(() => {
    const handler = async (e: Event) => {
      const detailEvt = (e as CustomEvent).detail as string;
      if (detailEvt !== '__generate_tests__') return;
      if (isGeneratingTests) return;
      setIsGeneratingTests(true);
      const tid = toast.loading('🧪 Generating test cases via AI…');
      try {
        const { generateTestCases } = await import('@/lib/ai-backend');
        // Snapshot current test cases to send for dedup
        const currentTestCases = (detail.testCases || []).map(tc => ({
          inputs: tc.inputs || {},
          expected: tc.expected || '',
        }));
        const problemTitle = roadmapProblem?.title || key || '';
        const paramNames = (detail.params || []).map(p => p.name);
        
        const getSignature = (inputs: Record<string, string>) => {
          const sortedKeys = Object.keys(inputs).sort();
          const normalized: Record<string, string> = {};
          sortedKeys.forEach(k => { normalized[k] = String(inputs[k]).trim(); });
          return JSON.stringify(normalized);
        };

        const existingSignatures = new Set(
          currentTestCases.map(tc => getSignature(tc.inputs))
        );

        // Enhance description with explicit AI instructions for uniqueness and accuracy
        const enhancedDescription = `${detail.description}\n\n` +
          `IMPORTANT FOR AI:\n` +
          `1. Generate 3-5 high-quality, UNIQUE test cases.\n` +
          `2. Include edge cases (empty inputs, large values, minimum/maximum values).\n` +
          `3. Match parameter names EXACTLY: ${paramNames.join(', ')}.\n` +
          `4. DO NOT generate any inputs already provided in the existingTestCases list.\n` +
          `5. Ensure the 'expected' output is 100% correct based on the problem logic.`;

        const generated = await generateTestCases(code, key || null, problemTitle, enhancedDescription, currentTestCases, paramNames);

        const normalized = (Array.isArray(generated) ? generated : [])
          .map((t: any) => {
            const inputs: Record<string, string> =
              t.inputs && typeof t.inputs === 'object'
                ? Object.fromEntries(Object.entries(t.inputs).map(([k, v]) => [k, String(v)]))
                : {};
            const expected = String(t.expectedOutput ?? t.expected ?? '').trim();
            
            // Validation: Ensure inputs match problem parameters
            const validParamNames = (detail.params || []).map(p => p.name);
            if (validParamNames.length > 0) {
              const inputKeys = Object.keys(inputs);
              // If the AI generated keys that aren't in our params, it's likely a hallucination from another problem
              const hasMismatch = inputKeys.some(k => !validParamNames.includes(k));
              if (hasMismatch) return null;
              
              // Also ensure all required params are present
              const hasAllParams = validParamNames.every(name => inputKeys.includes(name));
              if (!hasAllParams) return null;
            }

            return Object.keys(inputs).length > 0 && expected ? { inputs, expected } : null;
          })
          .filter(Boolean) as { inputs: Record<string, string>; expected: string }[];

        // Deduplicate: remove any that match existing test case input signatures
        const unique = normalized.filter(tc => !existingSignatures.has(getSignature(tc.inputs)));

        if (unique.length === 0) {
          if (normalized.length > 0) {
            toast.error('AI generated test cases, but they already exist in your list.', { id: tid });
          } else {
            toast.error('AI failed to generate valid test cases for this problem. Try again.', { id: tid });
          }
        } else {
          setDetail(prev => ({ ...prev, testCases: [...(prev.testCases || []), ...unique] }));
          toast.success(`✅ Added ${unique.length} new AI test case${unique.length === 1 ? '' : 's'} to the Tests tab.`, { id: tid });
          setBottomTab('description');
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to generate test cases', { id: tid });
      }
      setIsGeneratingTests(false);
    };
    window.addEventListener('trigger-explain', handler);
    return () => window.removeEventListener('trigger-explain', handler);
  }, [code, key, isGeneratingTests, detail.testCases, roadmapProblem]);


  const addConsoleEntry = (type: ConsoleEntry['type'], text: string) => {
    setConsoleEntries(prev => [...prev, {
      type, text,
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
    }]);
  };

  /** Returns true if the code reads from stdin (Scanner / BufferedReader / System.in) */
  const usesScannerInput = (src: string) =>
    /new\s+Scanner\s*\(/.test(src) ||
    /System\.in/.test(src) ||
    /BufferedReader/.test(src) ||
    /InputStreamReader/.test(src);

  /**
   * Shows the interactive stdin bar in the console and waits until the user
   * presses Enter. Returns the submitted value.
   */
  const waitForUserInput = (): Promise<string> => {
    return new Promise(resolve => {
      setWaitingForInput(true);
      stdinResolverRef.current = (val: string) => {
        setWaitingForInput(false);
        stdinResolverRef.current = null;
        resolve(val);
      };
    });
  };

  /** Called by ConsolePanel when the user submits stdin */
  const handleStdinSubmit = (val: string) => {
    addConsoleEntry('stdin', val);
    stdinResolverRef.current?.(val);
  };

  /**
   * For programs using Scanner: prompts the user to enter all inputs upfront
   * (one per Enter press), then concatenates and sends to the backend.
   */
  const collectStdinInteractively = async (src: string): Promise<string> => {
    addConsoleEntry('system', '📥 This program reads from stdin. Enter each input value and press Enter. Type an empty line when done.');
    const lines: string[] = [];
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const val = await waitForUserInput();
      if (val === '') break; // empty line = done
      lines.push(val);
    }
    return lines.join('\n');
  };

  // Run: execute the code. If it uses Scanner, collect stdin interactively first.
  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setExecStatus('compiling');
    setBottomTab('console');
    setMobileTab('results');
    const startTime = Date.now();

    try {
      const { executeJavaCode } = await import('@/lib/executor');
      const hasMain = /public\s+static\s+void\s+main\s*\(/.test(code);

      let stdin: string | undefined;
      if (hasMain && usesScannerInput(code)) {
        addConsoleEntry('system', '▶ Compiling...');
        stdin = await collectStdinInteractively(code);
        addConsoleEntry('system', `▶ Running with ${stdin.split('\n').filter(Boolean).length} input line(s)...`);
      } else {
        addConsoleEntry('system', '▶ Checking syntax (compile only)...');
      }

      const result = await executeJavaCode(code, (s) => setExecStatus(s), stdin);
      const execTime = Date.now() - startTime;

      const errText = (result.error || '').toLowerCase();
      const isCompileError =
        result.status?.id === 6 ||
        result.status?.description?.toLowerCase().includes('compil') ||
        errText.includes('error:') ||
        errText.includes('cannot find symbol') ||
        errText.includes('compilation');

      if (isCompileError) {
        addConsoleEntry('error', '✗ Compilation failed:');
        if (result.error) addConsoleEntry('error', result.error);
        setExecStatus('compile_error');
      } else if (result.success) {
        if (result.output) addConsoleEntry('output', result.output);
        if (hasMain) {
          addConsoleEntry('info', `✓ Finished (${execTime}ms)`);
        } else {
          addConsoleEntry('info', `✓ Syntax OK — code compiles cleanly (${execTime}ms)`);
          addConsoleEntry('system', 'Use "Run Tests" to execute against test cases, or "Submit" to grade.');
        }
        setExecStatus('complete');
      } else {
        if (result.output) addConsoleEntry('output', result.output);
        if (result.error) addConsoleEntry('error', result.error);
        addConsoleEntry('error', `✗ Runtime error (${execTime}ms)`);
        setExecStatus('failed');
      }
    } catch (err: any) {
      addConsoleEntry('error', err?.message || 'Execution failed');
      setExecStatus('failed');
    }
    setIsRunning(false);
  };


  // Run Tests: runs ONLY VISIBLE test cases using local test-runner
  const handleRunTests = async () => {
    if (isRunningTests || detail.testCases.length === 0) return;
    setIsRunningTests(true);
    setTestResults([]);
    setBottomTab('console');
    setMobileTab('results');
    const startTime = Date.now();

    try {
      const { runAllTests, isMainClassStyle } = await import('@/lib/test-runner');

      // Tell user which mode the runner will use
      const stdinMode = isMainClassStyle(code);
      addConsoleEntry('system',
        stdinMode
          ? `▶ Running ${detail.testCases.length} test(s) — Scanner/stdin mode (inputs piped automatically)...`
          : `▶ Running ${detail.testCases.length} test(s) — Solution method mode...`
      );

      const tcInputs = detail.testCases.map(tc => ({
        inputs: tc.inputs || {},
        expected: tc.expected || '',
      }));
      const results = await runAllTests(code, tcInputs, setExecStatus, (idx, r) => {
        const label = r.status === 'PASSED' ? '✓' : '✗';
        addConsoleEntry(
          r.status === 'PASSED' ? 'info' : 'error',
          `${label} Test ${r.test} ${r.status}${r.status === 'FAILED' ? ` → expected: "${r.expected}", got: "${r.actual}"` : ''}`
        );
      });
      const execTime = Date.now() - startTime;
      const passed = results.filter(r => r.status === 'PASSED').length;
      const allPassed = passed === results.length;
      addConsoleEntry('system', `\n${passed}/${results.length} visible tests passed (${execTime}ms).`);
      setTestResults(results);
      setBottomTab('results');
      setExecStatus(allPassed ? 'complete' : 'failed');

      if (authUser && key) {
        saveExecutionHistory(authUser.id, key, code, results, allPassed, execTime).then(() => setHistoryRefreshKey(prev => prev + 1));
      }
    } catch (err: any) {
      addConsoleEntry('error', 'Execution failed: ' + err.message);
      setExecStatus('failed');
    }
    setIsRunningTests(false);
  };


  // Submit Code: runs all test cases (same as run tests for now)
  const handleSubmitCode = async () => {
    if (isRunningTests) return;
    setIsRunningTests(true);
    setTestResults([]);
    setBottomTab('console');
    setMobileTab('results');
    addConsoleEntry('system', `▶ Submitting code — running ALL test cases...`);
    const startTime = Date.now();

    try {
      const { runAllTests } = await import('@/lib/test-runner');
      const tcInputs = detail.testCases.map(tc => ({
        inputs: tc.inputs || {},
        expected: tc.expected || '',
      }));
      const results = await runAllTests(code, tcInputs, setExecStatus, (idx, r) => {
        addConsoleEntry(
          r.status === 'PASSED' ? 'info' : 'error',
          `Test ${r.test} ${r.status}${r.status === 'FAILED' ? ` — expected: ${r.expected}, got: ${r.actual}` : ''}`
        );
      });
      const execTime = Date.now() - startTime;
      const passed = results.filter(r => r.status === 'PASSED').length;
      const total = results.length;
      const allPassed = passed === total;

      if (allPassed) {
        addConsoleEntry('info', `✅ ACCEPTED — ${passed}/${total} test cases passed (${execTime}ms)`);
        setExecStatus('complete');

        // Automatic GitHub Sync (prefer profile, fallback to localStorage)
        const gh = profile?.github_token ? {
          token: profile.github_token,
          repo: profile.github_repo || '',
          autoPush: !!profile.github_auto_push
        } : getGitHubSettings();
        
        if (gh && gh.autoPush && gh.token && gh.repo && roadmapProblem) {
          addConsoleEntry('system', `☁ Synchronizing with GitHub...`);
          const sanitizedTitle = roadmapProblem.title.replace(/[^a-zA-Z0-9]/g, '');
          const fileName = `${sanitizedTitle}.java`;
          const filePath = `Java Codes/${((roadmapProblem as any).topic || 'Uncategorized').replace(/[^a-zA-Z0-9/]/g, '_')}/${fileName}`;
          pushFileToGitHub(
            gh.token,
            gh.repo,
            filePath,
            code,
            `Solved: ${roadmapProblem.title}`
          ).then(res => {
            if (res.success) {
              addConsoleEntry('info', `🔗 Pushed to GitHub: ${res.url}`);
            } else {
              addConsoleEntry('error', `⚠ GitHub sync failed: ${res.error}`);
            }
          });
        }
      } else {
        addConsoleEntry('error', `❌ FAILED — ${passed}/${total} test cases passed (${execTime}ms)`);
        const failed = results.find(r => r.status === 'FAILED');
        if (failed) {
          addConsoleEntry('error', `\nFailed on Test ${failed.test}:`);
          addConsoleEntry('error', `  Expected: ${failed.expected}`);
          addConsoleEntry('error', `  Got:      ${failed.actual}`);
        }
        setExecStatus('failed');
      }

      setTestResults(results);
      setBottomTab('results');

      // Save execution history & update progress
      if (authUser && key) {
        saveExecutionHistory(authUser.id, key, code, results, allPassed, execTime).then(() => setHistoryRefreshKey(prev => prev + 1));

        try {
          const { data: existing } = await supabase
            .from('user_problem_progress')
            .select('*')
            .eq('user_id', authUser.id)
            .eq('problem_key', key)
            .maybeSingle();

          if (existing) {
            await supabase.from('user_problem_progress').update({
              attempts: (existing as any).attempts + 1,
              last_attempted: new Date().toISOString(),
              ...(allPassed ? { solved: true, solved_at: new Date().toISOString(), status: 'solved' } : { status: 'attempted' }),
            } as any).eq('id', (existing as any).id);
          } else {
            await supabase.from('user_problem_progress').insert({
              user_id: authUser.id,
              problem_key: key,
              attempts: 1,
              last_attempted: new Date().toISOString(),
              ...(allPassed ? { solved: true, solved_at: new Date().toISOString(), status: 'solved' } : { status: 'attempted' }),
            } as any);
          }
          if (allPassed) {
            toast.success('🎉 Problem solved! Progress saved.');
          }
        } catch {}
      }

      if (allPassed) {
        setCelebrationTime(execTime);
        setShowCelebration(true);
        // Award coins + fire equipped submission confetti
        try {
          const { awardCoins } = await import('@/lib/coins');
          const { triggerSubmissionConfetti } = await import('@/lib/active-effects');
          if (authUser?.id) {
            const diff = String(roadmapProblem?.difficulty || 'Medium').toLowerCase();
            const ruleKey = diff.includes('easy') ? 'problem_solved_easy'
              : diff.includes('hard') ? 'problem_solved_hard' : 'problem_solved_medium';
            // unique per problem so it only awards once per problem
            await awardCoins(authUser.id, ruleKey, `solved:${key}`);
            await awardCoins(authUser.id, 'first_submission_daily');
          }
          triggerSubmissionConfetti();
        } catch {}
      }
    } catch (err: any) {
      addConsoleEntry('error', 'Submission failed: ' + err.message);
      setExecStatus('failed');
    }
    setIsRunningTests(false);
  };



  // Analyze complexity
  const handleAnalyze = async () => {
    if (isAnalyzing || !code.trim()) return;
    setIsAnalyzing(true);
    setAnalysisResult(null);
    setShowFullExplanation(false);
    setBottomTab('analysis');
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-complexity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ code, executionTimeMs: 0 }),
      });
      if (!resp.ok) throw new Error('Analysis failed');
      const result = await resp.json();
      setAnalysisResult(result);
    } catch (err: any) {
      toast.error('Complexity analysis failed. Try again.');
    }
    setIsAnalyzing(false);
  };

  // Get full explanation
  const handleFullExplanation = async () => {
    if (isExplaining || !analysisResult) return;
    setIsExplaining(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-complexity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          code,
          executionTimeMs: 0,
          fullExplanation: true,
          problemTitle: roadmapProblem?.title || '',
        }),
      });
      if (!resp.ok) throw new Error('Explanation failed');
      const result = await resp.json();
      setAnalysisResult(prev => prev ? { ...prev, fullExplanation: result.fullExplanation || result.suggestion } : prev);
      setShowFullExplanation(true);
    } catch {
      toast.error('Could not generate explanation.');
    }
    setIsExplaining(false);
  };

  const fetchSubmissionHistory = async () => {
    if (!authUser || !key) return;
    setLoadingHistory(true);
    const prefix = contestMode ? 'contest_' : generatorMode ? 'gen_' : '';
    const saveKey = `${prefix}${key}`;
    try {
      const { data } = await supabase
        .from('submission_history' as any)
        .select('*')
        .eq('user_id', authUser.id)
        .eq('problem_key', key) // Use the raw key for history tracking across modes
        .order('created_at', { ascending: false });
      setSubmissionHistory(data || []);
    } catch (e) {
      console.error('History fetch error:', e);
    }
    setLoadingHistory(false);
  };

  useEffect(() => {
    if (bottomTab === 'history') {
      fetchSubmissionHistory();
    }
  }, [bottomTab, key]);

  if (!roadmapProblem) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Problem not found</p>
          <Button onClick={() => navigate('/modules')} className="mt-4">Back to Modules</Button>
        </div>
      </div>
    );
  }

  const handleGitHubPush = async () => {
    // Prefer profile settings, fallback to localStorage
    const gh = profile?.github_token ? {
      token: profile.github_token,
      repo: profile.github_repo || '',
      autoPush: !!profile.github_auto_push
    } : getGitHubSettings();

    if (!gh || !gh.token || !gh.repo) {
      toast.error('GitHub not configured. Visit Settings > Integrations.');
      return;
    }
    if (!roadmapProblem) return;
    const tid = toast.loading('Pushing to GitHub...');
    const sanitizedTitle = roadmapProblem.title.replace(/[^a-zA-Z0-9]/g, '');
    const fileName = `${sanitizedTitle}.java`;
    const filePath = `Java Codes/${((roadmapProblem as any).topic || 'Uncategorized').replace(/[^a-zA-Z0-9/]/g, '_')}/${fileName}`;
    const res = await pushFileToGitHub(gh.token, gh.repo, filePath, code, `Manual Sync: ${roadmapProblem.title}`);
    toast.dismiss(tid);
    if (res.success) {
      toast.success('Successfully pushed to GitHub!');
      if (res.url) window.open(res.url, '_blank');
    } else {
      toast.error('Push failed: ' + res.error);
    }
  };

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = consoleHeight;
    const onMove = (ev: MouseEvent) => setConsoleHeight(Math.max(100, Math.min(600, startH + (startY - ev.clientY))));
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [consoleHeight]);

  const tabItems = [
    { key: 'description' as const, label: 'Tests' },
    { key: 'console' as const, label: 'Console' },
    { key: 'results' as const, label: testResults.length > 0 ? `Results (${testResults.filter(r => r.status === 'PASSED').length}/${testResults.length})` : 'Results' },
    { key: 'analysis' as const, label: analysisResult ? '📊 Analysis ✓' : '📊 Analysis' },
    { key: 'history' as const, label: '📜 History' },
    ...(!contestMode && !generatorMode ? [
      { key: 'solutions' as const, label: '⚡ Solutions' },
    ] : [])
  ];

  return (
    <div className="flex h-full flex-col bg-background overflow-hidden">
      {contestMode && (
        <div className="bg-warning/10 border-b border-warning/20 px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-warning animate-pulse" />
            <span className="text-[10px] font-bold text-warning uppercase tracking-widest">Contest Mode Active — External help disabled</span>
          </div>
          <div className="text-[10px] text-warning/80 font-mono">ID: {contestId}</div>
        </div>
      )}
      {generatorMode && (
        <div className="bg-primary/10 border-b border-primary/20 px-4 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Generator Mode Active — Solving AI Challenge</span>
          </div>
          <div className="text-[10px] text-primary/80 font-mono">GEN_ID: {genId}</div>
        </div>
      )}

    <header className="flex h-12 md:h-11 items-center gap-1.5 border-b border-panel-border bg-background text-foreground px-2 sm:px-3 overflow-x-auto scrollbar-none z-20 shrink-0">
      <HeaderMenu />
      <div className="h-4 w-px bg-border mx-1 hidden md:block" />
      <span className="text-xs font-bold tracking-tight text-foreground/80 mr-2 hidden lg:inline">JavaArena</span>
      
      {/* Back button — hidden on small mobile to save space if needed, but keeping for now */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => {
          if (contestMode) navigate('/contest');
          else if (generatorMode) navigate('/generator');
          else if (key?.startsWith('arr-') || key?.startsWith('striver') || key?.startsWith('basics-') || key?.startsWith('recursion-') || key?.startsWith('sorting-') || key?.startsWith('bs-') || key?.startsWith('strings-')) navigate('/striver');
          else if (key?.startsWith('neetcode')) navigate('/neetcode');
          else if (key?.startsWith('leetcode')) navigate('/leetcode150');
          else navigate(-1);
        }} 
        className="h-8 md:h-7 gap-1 text-[11px] md:text-xs shrink-0 text-muted-foreground hover:text-foreground hover:bg-accent"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Back</span>
      </Button>

      <div className="h-4 w-px bg-border hidden sm:block shrink-0" />
      
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-semibold text-foreground truncate max-w-[120px] xs:max-w-[150px] sm:max-w-[280px] tracking-tight">{roadmapProblem?.title || 'Problem'}</span>
        <Badge variant="outline" className={`text-[9px] md:text-[10px] font-medium shrink-0 px-1.5 py-0 hidden xs:flex border-panel-border ${getDifficultyBg(roadmapProblem?.difficulty || 'Medium')}`}>
          {roadmapProblem?.difficulty || 'Medium'}
        </Badge>
      </div>

      <div className="ml-auto flex items-center gap-1 md:gap-1.5 shrink-0">
        <div className="hidden md:block"><ProblemTimer problemId={key || null} onTimeUpdate={setTimeSpent} /></div>
        <ExecutionStatus status={execStatus} />
        
        {/* Desktop-only action buttons */}
        <div className="hidden md:flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setFocusMode(!focusMode)} className={`h-7 w-7 p-0 ${focusMode ? 'text-foreground bg-accent' : 'text-muted-foreground'}`} title="Focus Mode">
            {focusMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button onClick={handleRun} disabled={isRunning || isRunningTests} size="sm" variant="outline" className="h-7 gap-1.5 text-xs font-medium border-panel-border">
            {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Run
          </Button>
          <Button onClick={handleRunTests} disabled={isRunning || isRunningTests || detail.testCases.length === 0} size="sm" variant="secondary" className="h-7 gap-1.5 text-xs font-medium bg-secondary/50 border-panel-border">
            {isRunningTests ? <Loader2 className="h-3 w-3 animate-spin" /> : <FlaskConical className="h-3 w-3" />}
            Test
          </Button>
          <Button onClick={handleSubmitCode} disabled={isRunning || isRunningTests || detail.testCases.length === 0} size="sm" className="h-7 gap-1.5 text-xs font-semibold bg-success hover:bg-success/90 text-success-foreground">
            {isRunningTests ? <Loader2 className="h-3 w-3 animate-spin" /> : <Code2 className="h-3 w-3" />}
            Submit
          </Button>
        </div>

        {/* Mobile-only Run button for quick access */}
        <div className="md:hidden hidden items-center gap-1">
          <Button 
            onClick={handleRun} 
            disabled={isRunning || isRunningTests} 
            size="sm" 
            variant="ghost"
            className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" fill="currentColor" />}
          </Button>
          <Button 
            onClick={handleSubmitCode} 
            disabled={isRunning || isRunningTests || detail.testCases.length === 0} 
            size="sm" 
            className="h-8 px-3 text-[11px] font-bold bg-success hover:bg-success/90 text-success-foreground rounded-full"
          >
            Submit
          </Button>
        </div>

        {!contestMode && (
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost" className="h-8 md:h-7 gap-1 text-[11px] md:text-xs text-muted-foreground hover:text-foreground">
                  <Sparkles className="h-3.5 w-3.5" /> <span className="hidden sm:inline">AI</span> <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('trigger-explain', { detail: '__dry_run__' }))}>
                  <Workflow className="h-3.5 w-3.5 mr-2" /> Logic Trace
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('trigger-explain', { detail: '__hints__' }))}>
                  <Brain className="h-3.5 w-3.5 mr-2" /> Hints
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('trigger-explain', { detail: '__optimal__' }))}>
                  <Trophy className="h-3.5 w-3.5 mr-2" /> Optimal
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('trigger-explain', { detail: '__mistakes__' }))}>
                  <AlertTriangle className="h-3.5 w-3.5 mr-2" /> Find Bugs
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('trigger-explain', { detail: '__patterns__' }))}>
                  <BookOpen className="h-3.5 w-3.5 mr-2" /> Patterns
                </DropdownMenuItem>
                <div className="h-px bg-border my-1" />
                <DropdownMenuItem onClick={handleAnalyze} disabled={isAnalyzing || !code.trim()}>
                  <TrendingUp className="h-3.5 w-3.5 mr-2" /> Complexity Analysis
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('trigger-explain', { detail: '__generate_tests__' }))}>
                  <FlaskConical className="h-3.5 w-3.5 mr-2" /> Generate Test Cases
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleGitHubPush}>
              <Github className="h-3.5 w-3.5 mr-2" /> Push to GitHub
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate(`/discuss?problem=${key}`)}>
              <MessageSquare className="h-3.5 w-3.5 mr-2" /> Discussion
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowShortcuts(true)} className="md:hidden">
              <Keyboard className="h-3.5 w-3.5 mr-2" /> Shortcuts
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFocusMode(!focusMode)} className="md:hidden">
              {focusMode ? <Eye className="h-3.5 w-3.5 mr-2" /> : <EyeOff className="h-3.5 w-3.5 mr-2" />}
              {focusMode ? 'Exit Focus' : 'Focus Mode'}
            </DropdownMenuItem>
            
            {/* AI Tools moved here for mobile cleanup */}
            <div className="h-px bg-border my-1 md:hidden" />
            <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('trigger-explain', { detail: '__dry_run__' }))} className="md:hidden">
              <Workflow className="h-3.5 w-3.5 mr-2" /> Logic Trace
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('trigger-explain', { detail: '__hints__' }))} className="md:hidden">
              <Brain className="h-3.5 w-3.5 mr-2" /> Hints
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('trigger-explain', { detail: '__optimal__' }))} className="md:hidden">
              <Trophy className="h-3.5 w-3.5 mr-2" /> Optimal
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.dispatchEvent(new CustomEvent('trigger-explain', { detail: '__mistakes__' }))} className="md:hidden">
              <AlertTriangle className="h-3.5 w-3.5 mr-2" /> Find Bugs
            </DropdownMenuItem>
            <div className="h-px bg-border my-1 md:hidden" />
            <DropdownMenuItem onClick={handleAnalyze} disabled={isAnalyzing || !code.trim()} className="md:hidden">
              <TrendingUp className="h-3.5 w-3.5 mr-2" /> Complexity Analysis
            </DropdownMenuItem>
            
            <div className="h-px bg-border my-1" />
            <DropdownMenuItem onClick={() => generateFullDetail(true)} className="text-destructive focus:text-destructive">
              <RotateCcw className="h-3.5 w-3.5 mr-2" /> Fix/Regenerate Problem
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ReportIssueDialog pageTitle={roadmapProblem?.title || 'Problem'} />
        <div className="hidden sm:block">
          <ExecutionStatus status={execStatus} />
        </div>
      </div>
    </header>

    {/* Main layout: responsive columns */}
    <div className="flex flex-1 overflow-hidden flex-col md:flex-row pb-0 md:pb-0">
      {/* MOBILE CONTENT: Tab-based view */}
      <div className="md:hidden flex-1 flex flex-col overflow-hidden relative">
        {mobileTab === 'problem' && (
          <ScrollArea className="flex-1 bg-background pb-0">
            <div className="p-4 space-y-5">
              <div>
                <h2 className="text-xl font-bold text-foreground leading-tight">{roadmapProblem?.title}</h2>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={`text-[10px] font-bold ${getDifficultyBg(roadmapProblem?.difficulty || 'Medium')}`}>{roadmapProblem?.difficulty}</Badge>
                  <Badge variant="outline" className="text-[10px] font-medium">{(roadmapProblem as any)?.topic}</Badge>
                  <div className="ml-auto"><ProblemTimer problemId={key || null} onTimeUpdate={setTimeSpent} /></div>
                </div>
              </div>

              {isGenerating && (
                <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 animate-pulse">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="text-xs text-primary font-semibold">AI is drafting problem details...</span>
                </div>
              )}

              <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:text-foreground/90 [&_li]:text-foreground/90">
                <ReactMarkdown>{detail.description}</ReactMarkdown>
              </div>

              {detail.examples.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Examples</h3>
                  {detail.examples.map((ex, i) => (
                    <div key={i} className="rounded-xl border border-panel-border bg-secondary/20 p-4 space-y-3">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">Example {i + 1}</p>
                      <div className="font-mono text-[11px] leading-relaxed">
                        <p className="mb-1.5"><span className="text-muted-foreground">Input:</span> <code className="text-foreground bg-foreground/5 px-1 rounded">{ex.input}</code></p>
                        <p><span className="text-muted-foreground">Output:</span> <code className="font-bold text-emerald-600 bg-emerald-500/5 px-1 rounded">{ex.output}</code></p>
                        {ex.explanation && (
                          <div className="mt-2.5 pt-2.5 border-t border-panel-border/50 text-muted-foreground italic flex gap-2">
                            <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            <span>{ex.explanation}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(detail as EnhancedDetail).constraints && (detail as EnhancedDetail).constraints!.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Constraints</h3>
                  <div className="flex flex-wrap gap-2">
                    {(detail as EnhancedDetail).constraints!.map((c, i) => (
                      <code key={i} className="bg-secondary/40 border border-panel-border px-2 py-1 rounded text-[10px] font-mono text-foreground/80">
                        {c}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              {(detail as EnhancedDetail).hints && (detail as EnhancedDetail).hints!.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/80">Hints</h3>
                  {(detail as EnhancedDetail).hints!.map((h, i) => (
                    <details key={i} className="group border border-panel-border rounded-xl bg-secondary/10 overflow-hidden">
                      <summary className="px-4 py-3 text-[11px] font-bold text-muted-foreground cursor-pointer flex items-center justify-between group-open:bg-secondary/20">
                        Hint {i + 1}
                        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="px-4 py-3 text-xs leading-relaxed text-foreground/90 border-t border-panel-border/50">
                        {h}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {mobileTab === 'editor' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-panel-border bg-card/60 px-2 h-9 shrink-0">
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/40">
                {APPROACHES.map(approach => (
                  <button
                    key={approach.key}
                    onClick={() => {
                      handleApproachChange(approach.key);
                      wsResetSaved(codes[approach.key]);
                    }}
                    className={`flex items-center gap-1 px-2.5 h-6 rounded text-[10px] font-bold transition-all ${
                      activeApproach === approach.key
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {approach.label.split(' ')[0]}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                 <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={regenerateActiveTab}>
                   <RotateCcw className="h-3 w-3" />
                 </Button>
                 <span className="text-[10px] font-mono font-bold text-muted-foreground">JAVA</span>
              </div>
            </div>
            <div className="flex-1 relative">
              {APPROACHES.map(approach => (
                <div 
                  key={approach.key} 
                  className="absolute inset-0"
                  style={{ 
                    visibility: activeApproach === approach.key ? 'visible' : 'hidden',
                    opacity: activeApproach === approach.key ? 1 : 0,
                    pointerEvents: activeApproach === approach.key ? 'auto' : 'none',
                    zIndex: activeApproach === approach.key ? 1 : 0
                  }}
                >
                  <CodeEditor 
                    key={`${key}-${approach.key}-${generationCount}`}
                    code={codes[approach.key]} 
                    onChange={(val) => setCodes(prev => ({ ...prev, [approach.key]: val }))} 
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {mobileTab === 'results' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-background">
            <div className="flex items-center gap-1 border-b border-panel-border bg-card/60 px-2 h-11 overflow-x-auto scrollbar-none shrink-0 no-scrollbar">
              {tabItems.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setBottomTab(tab.key)}
                  className={`relative px-4 h-8 rounded-full text-[11px] font-bold transition-all whitespace-nowrap shrink-0 ${
                    bottomTab === tab.key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-secondary/80'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-hidden">
              {bottomTab === 'description' && (
                <TestCasePanel
                  testCases={detail.testCases.map((tc, i) => ({
                    id: `wstc-${i}`,
                    user_id: '',
                    problem_id: key || '',
                    input: Object.values(tc.inputs || {})[0] || '',
                    expected_output: tc.expected || '',
                    variable_name: Object.keys(tc.inputs || {})[0] || 'arg',
                    inputs: tc.inputs || {},
                    created_at: '',
                  }))}
                  testResults={testResults}
                  onAdd={(inputs, expectedOutput) => {
                    setDetail(prev => ({
                      ...prev,
                      testCases: [...(prev.testCases || []), { inputs, expected: expectedOutput }],
                    }));
                    toast.success('Custom test case added');
                  }}
                  onUpdate={(id, inputs, expectedOutput) => {
                    const idx = parseInt(id.replace('wstc-', ''), 10);
                    if (Number.isNaN(idx)) return;
                    setDetail(prev => {
                      const next = [...(prev.testCases || [])];
                      if (next[idx]) next[idx] = { inputs, expected: expectedOutput };
                      return { ...prev, testCases: next };
                    });
                  }}
                  onDelete={(id) => {
                    const idx = parseInt(id.replace('wstc-', ''), 10);
                    if (Number.isNaN(idx)) return;
                    setDetail(prev => ({
                      ...prev,
                      testCases: (prev.testCases || []).filter((_, i) => i !== idx),
                    }));
                  }}
                  onGenerateAI={() => window.dispatchEvent(new CustomEvent('trigger-explain', { detail: '__generate_tests__' }))}
                  isGenerating={isGeneratingTests}
                />
              )}
              {bottomTab === 'console' && (
                <ConsolePanel
                  entries={consoleEntries}
                  isRunning={isRunning || isRunningTests}
                  onClear={() => setConsoleEntries([])}
                  isCollapsed={false}
                  onToggleCollapse={() => {}}
                  isFullscreen={false}
                  onToggleFullscreen={() => {}}
                  waitingForInput={waitingForInput}
                  onStdinSubmit={handleStdinSubmit}
                />
              )}
              {bottomTab === 'results' && (
                <ScrollArea className="h-full">
                  <div className="p-3 pb-10">
                    {testResults.length > 0 ? (
                      <TestResultsTable results={testResults} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground py-16 flex-col gap-3">
                        <FlaskConical className="h-10 w-10 opacity-20" />
                        <p>Run tests to see results</p>
                        <Button size="sm" onClick={handleRunTests} variant="outline" className="h-8 rounded-full px-5">Start Testing</Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
              {bottomTab === 'analysis' && (
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-4 pb-16">
                    {isAnalyzing ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-xs font-medium text-muted-foreground">AI is inspecting your logic...</p>
                      </div>
                    ) : analysisResult ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-xl border border-panel-border bg-secondary/20 p-4">
                            <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-bold mb-1.5">⏱️ Time</p>
                            <p className="text-lg font-bold font-mono text-primary leading-none">{analysisResult.timeComplexity}</p>
                          </div>
                          <div className="rounded-xl border border-panel-border bg-secondary/20 p-4">
                            <p className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground font-bold mb-1.5">💾 Space</p>
                            <p className="text-lg font-bold font-mono text-primary leading-none">{analysisResult.spaceComplexity}</p>
                          </div>
                        </div>
                        {analysisResult.optimizationPossible && (
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 flex items-center gap-2">
                              <Zap className="h-3.5 w-3.5" /> Optimization Tip
                            </p>
                            <p className="text-xs text-foreground/90 leading-relaxed">{analysisResult.betterApproach}</p>
                          </div>
                        )}
                        <Button size="sm" variant="outline" className="w-full h-9 rounded-xl gap-2 font-bold text-xs" onClick={handleFullExplanation} disabled={isExplaining}>
                          {isExplaining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
                          {showFullExplanation ? 'Refresh Explanation' : 'Detailed Analysis'}
                        </Button>
                        {showFullExplanation && analysisResult.fullExplanation && (
                          <div className="rounded-xl border border-panel-border bg-secondary/5 p-4 mt-2">
                             <div className="prose prose-sm max-w-none dark:prose-invert text-xs leading-relaxed">
                                <ReactMarkdown>{analysisResult.fullExplanation}</ReactMarkdown>
                             </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                        <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center">
                          <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Complexity Insight</p>
                          <p className="text-[11px] text-muted-foreground mt-1 max-w-[200px]">Let AI analyze your algorithm's efficiency in O-notation.</p>
                        </div>
                        <Button size="sm" onClick={handleAnalyze} className="h-9 px-6 rounded-full font-bold">Analyze Code</Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
              {bottomTab === 'history' && (
                <div className="h-full overflow-hidden pb-0">
                  <ExecutionHistoryPanel
                    key={historyRefreshKey}
                    userId={authUser?.id || ''}
                    problemId={key || ''}
                    onRestoreCode={(restored) => { setCode(restored); setMobileTab('editor'); toast.success('Code restored'); }}
                  />
                </div>
              )}
              {bottomTab === 'solutions' && (
                <div className="h-full overflow-hidden pb-0">
                  <SolutionComparison code={code} problemTitle={roadmapProblem?.title} />
                </div>
              )}
            </div>
          </div>
        )}

        {mobileTab === 'ai' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-background">
            <div className="flex-1 overflow-hidden pb-0">
               <AIChatPanel 
                code={code} 
                problemId={key || null} 
                problemTitle={roadmapProblem?.title || (detail as any).title}
                problemDescription={detail.description}
                problemExamples={detail.examples}
                problemConstraints={detail.constraints}
                module={(roadmapProblem as any)?.topic || 'Problem Workspace'}
                aiEnabled={true} 
              />
            </div>
          </div>
        )}

        <div className="shrink-0 border-t border-border bg-card/95 backdrop-blur px-2 py-2">
          <div className="grid grid-cols-3 gap-2">
            <Button 
              onClick={handleRun} 
              disabled={isRunning || isRunningTests} 
              size="sm" 
              className="h-10 gap-2 rounded-lg font-bold bg-success hover:bg-success/90 text-success-foreground"
            >
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" fill="currentColor" />}
              Run
            </Button>
            <Button 
              onClick={handleRunTests} 
              disabled={isRunning || isRunningTests || detail.testCases.length === 0} 
              size="sm" 
              variant="outline"
              className="h-10 gap-2 rounded-lg font-bold border-primary/20"
            >
              {isRunningTests ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              Test
            </Button>
            {(isRunning || isRunningTests) ? (
              <Button 
                onClick={() => { stopExecution(); setIsRunning(false); setIsRunningTests(false); setExecStatus('stopped'); }}
                size="sm" 
                variant="destructive"
                className="h-10 gap-2 rounded-lg font-bold"
              >
                <Square className="h-4 w-4" /> Stop
              </Button>
            ) : (
              <Button 
                onClick={handleSubmitCode} 
                disabled={detail.testCases.length === 0} 
                size="sm" 
                className="h-10 gap-2 rounded-lg font-bold"
              >
                <Code2 className="h-4 w-4" /> Submit
              </Button>
            )}
          </div>
        </div>

        {/* WORKSPACE MOBILE BOTTOM NAV - IDE Mode Selector */}
        <nav className="shrink-0 h-14 bg-card border-t border-border z-[100] flex items-center justify-around px-2">
          <button 
            onClick={() => setMobileTab('problem')} 
            className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-300 ${mobileTab === 'problem' ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <div className={`p-1.5 rounded-xl transition-colors ${mobileTab === 'problem' ? 'bg-primary/15' : ''}`}>
              <FileText className={`h-5 w-5 ${mobileTab === 'problem' ? 'stroke-[2.5px]' : ''}`} />
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${mobileTab === 'problem' ? 'opacity-100' : 'opacity-60'}`}>Problem</span>
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
            <span className={`text-[10px] font-bold uppercase tracking-wider ${mobileTab === 'results' ? 'opacity-100' : 'opacity-60'}`}>Results</span>
          </button>
          
          {!contestMode && !generatorMode && (
            <button 
              onClick={() => setMobileTab('ai')} 
              className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-300 ${mobileTab === 'ai' ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <div className={`p-1.5 rounded-xl transition-colors ${mobileTab === 'ai' ? 'bg-primary/15' : ''}`}>
                <Bot className={`h-5 w-5 ${mobileTab === 'ai' ? 'stroke-[2.5px]' : ''}`} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${mobileTab === 'ai' ? 'opacity-100' : 'opacity-60'}`}>AI Tutor</span>
            </button>
          )}
        </nav>
      </div>

      {/* DESKTOP CONTENT: Original split layout */}
        {/* Left: Problem Description */}
        {showDescription && !focusMode && (
          <div className="hidden md:flex w-[340px] lg:w-[380px] shrink-0 border-r border-panel-border overflow-hidden flex-col">
            <div className="flex items-center justify-between border-b border-panel-border bg-ide-toolbar px-3 py-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Problem</span>
              <Button variant="ghost" size="sm" onClick={() => setShowDescription(false)} className="h-5 text-[10px]">
                Hide
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{roadmapProblem.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`text-[10px] ${getDifficultyBg(roadmapProblem.difficulty)}`}>{roadmapProblem.difficulty}</Badge>
                    <Badge variant="outline" className="text-[10px]">{(roadmapProblem as any).topic}</Badge>
                  </div>
                </div>

                {isGenerating && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                    <span className="text-xs text-primary font-medium">Generating full problem details...</span>
                  </div>
                )}

                {generateError && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-xs text-destructive">{generateError}</span>
                    <Button size="sm" variant="outline" className="ml-auto h-6 text-[10px]" onClick={() => generateFullDetail()}>Retry</Button>
                  </div>
                )}

                <div className="prose prose-sm max-w-none dark:prose-invert [&_p]:text-foreground [&_li]:text-foreground">
                  <ReactMarkdown>{detail.description}</ReactMarkdown>
                </div>

                {detail.examples.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Examples</h3>
                    {detail.examples.map((ex, i) => (
                      <div key={i} className="rounded-lg border border-panel-border bg-secondary/30 p-3 space-y-1">
                        <p className="text-xs font-semibold text-muted-foreground">Example {i + 1}:</p>
                        <div className="font-mono text-xs">
                          <p><span className="text-muted-foreground">Input:</span> <span className="text-foreground">{ex.input}</span></p>
                          <p><span className="text-muted-foreground">Output:</span> <span className="font-semibold text-foreground">{ex.output}</span></p>
                          {ex.explanation && <p className="text-muted-foreground mt-1">💡 {ex.explanation}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(detail as EnhancedDetail).constraints && (detail as EnhancedDetail).constraints!.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Constraints</h3>
                    <ul className="space-y-1">
                      {(detail as EnhancedDetail).constraints!.map((c, i) => (
                        <li key={i} className="text-xs text-foreground font-mono flex items-start gap-2">
                          <span className="text-muted-foreground mt-0.5">•</span>
                          <code className="bg-secondary/50 px-1.5 py-0.5 rounded text-[11px]">{c}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(detail as EnhancedDetail).hints && (detail as EnhancedDetail).hints!.length > 0 && (
                  <details className="group">
                    <summary className="text-xs font-bold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                      💡 Hints ({(detail as EnhancedDetail).hints!.length})
                    </summary>
                    <div className="mt-2 space-y-2">
                      {(detail as EnhancedDetail).hints!.map((h, i) => (
                        <div key={i} className="rounded border border-panel-border bg-primary/5 p-2 text-xs text-foreground">
                          <span className="font-semibold text-primary">Hint {i + 1}:</span> {h}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {(detail as EnhancedDetail).approach && (
                  <details className="group">
                    <summary className="text-xs font-bold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                      🧠 Approach & Complexity
                    </summary>
                    <div className="mt-2 rounded border border-panel-border bg-secondary/20 p-3 text-xs text-foreground">
                      <ReactMarkdown>{(detail as EnhancedDetail).approach!}</ReactMarkdown>
                    </div>
                  </details>
                )}

                {detail.testCases.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Built-in Test Cases</h3>
                    {detail.testCases.map((tc, i) => (
                      <div key={i} className="rounded border border-panel-border bg-secondary/20 p-2 font-mono text-[11px] space-y-0.5">
                        <p className="font-semibold text-muted-foreground">Test {i + 1}:</p>
                        {Object.entries(tc.inputs).map(([k, v]) => (
                          <p key={k}><span className="text-muted-foreground">{k}</span> = <span className="text-foreground">{v}</span></p>
                        ))}
                        <p><span className="text-muted-foreground">Expected:</span> <span className="text-success font-semibold">{tc.expected}</span></p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Center: Code Editor + Bottom */}
        <div className="hidden md:flex flex-1 flex-col overflow-hidden">
          {!showDescription && (
            <Button variant="ghost" size="sm" onClick={() => setShowDescription(true)} className="absolute z-10 left-1 top-14 h-6 text-[10px]">
              📄 Show
            </Button>
          )}

          {/* Approach Tabs — refined segmented look */}
          <div className="flex items-center border-b border-panel-border bg-card/60 px-2 h-9">
            <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-muted/40">
              {APPROACHES.map(approach => (
                <button
                  key={approach.key}
                  onClick={() => {
                    handleApproachChange(approach.key);
                    wsResetSaved(codes[approach.key]);
                  }}
                  className={`flex items-center gap-1.5 px-3 h-7 rounded text-[11px] font-medium transition-all ${
                    activeApproach === approach.key
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {approach.icon}
                  {approach.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition-all"
                title={`Regenerate ${activeApproach} signature`}
                onClick={regenerateActiveTab}
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
              <span className="text-[11px] text-muted-foreground tracking-tight font-mono">Java</span>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {APPROACHES.map(approach => (
              <div 
                key={approach.key} 
                className="absolute inset-0"
                style={{ 
                  visibility: activeApproach === approach.key ? 'visible' : 'hidden',
                  opacity: activeApproach === approach.key ? 1 : 0,
                  pointerEvents: activeApproach === approach.key ? 'auto' : 'none',
                  zIndex: activeApproach === approach.key ? 1 : 0
                }}
              >
                <CodeEditor 
                  key={`${key}-${approach.key}-${generationCount}`}
                  code={codes[approach.key]} 
                  onChange={(val) => setCodes(prev => ({ ...prev, [approach.key]: val }))} 
                />
              </div>
            ))}
          </div>

          <div onMouseDown={handleDividerMouseDown} className="resize-handle h-1 cursor-row-resize border-t border-panel-border hover:bg-primary/40 transition-colors" />

          {/* Bottom panel */}
          <div className="shrink-0 border-t border-panel-border bg-card/40" style={{ height: consoleHeight }}>
            <div className="flex items-center border-b border-panel-border bg-card/60 px-1 h-9 overflow-x-auto scrollbar-none">
              {tabItems.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setBottomTab(tab.key)}
                  className={`relative px-3 h-9 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    bottomTab === tab.key
                      ? 'text-foreground after:absolute after:left-2 after:right-2 after:bottom-0 after:h-0.5 after:bg-foreground after:rounded-full'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="h-[calc(100%-32px)] overflow-hidden">
              {bottomTab === 'description' && (
                <TestCasePanel
                  testCases={detail.testCases.map((tc, i) => ({
                    id: `wstc-${i}`,
                    user_id: '',
                    problem_id: key || '',
                    input: Object.values(tc.inputs || {})[0] || '',
                    expected_output: tc.expected || '',
                    variable_name: Object.keys(tc.inputs || {})[0] || 'arg',
                    inputs: tc.inputs || {},
                    created_at: '',
                  }))}
                  testResults={testResults}
                  onAdd={(inputs, expectedOutput) => {
                    setDetail(prev => ({
                      ...prev,
                      testCases: [...(prev.testCases || []), { inputs, expected: expectedOutput }],
                    }));
                    toast.success('Custom test case added — runs with built-in tests on Run/Submit.');
                  }}
                  onUpdate={(id, inputs, expectedOutput) => {
                    const idx = parseInt(id.replace('wstc-', ''), 10);
                    if (Number.isNaN(idx)) return;
                    setDetail(prev => {
                      const next = [...(prev.testCases || [])];
                      if (next[idx]) next[idx] = { inputs, expected: expectedOutput };
                      return { ...prev, testCases: next };
                    });
                  }}
                  onDelete={(id) => {
                    const idx = parseInt(id.replace('wstc-', ''), 10);
                    if (Number.isNaN(idx)) return;
                    setDetail(prev => ({
                      ...prev,
                      testCases: (prev.testCases || []).filter((_, i) => i !== idx),
                    }));
                  }}
                  onGenerateAI={() => window.dispatchEvent(new CustomEvent('trigger-explain', { detail: '__generate_tests__' }))}
                  isGenerating={isGeneratingTests}
                />
              )}
              {bottomTab === 'console' && (
                <ConsolePanel
                  entries={consoleEntries}
                  isRunning={isRunning || isRunningTests}
                  onClear={() => setConsoleEntries([])}
                  isCollapsed={false}
                  onToggleCollapse={() => {}}
                  isFullscreen={false}
                  onToggleFullscreen={() => {}}
                  waitingForInput={waitingForInput}
                  onStdinSubmit={handleStdinSubmit}
                />
              )}
              {bottomTab === 'results' && (
                <ScrollArea className="h-full">
                  <div className="p-3">
                    {testResults.length > 0 ? (
                      <TestResultsTable results={testResults} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground py-10">
                        Run tests to see results
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
              {bottomTab === 'analysis' && (
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-4">
                    {isAnalyzing ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <p className="text-xs text-muted-foreground">Analyzing your code complexity...</p>
                      </div>
                    ) : analysisResult ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="rounded-lg border border-panel-border bg-secondary/20 p-3">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">⏱️ Time Complexity</p>
                            <p className="text-lg font-bold font-mono text-primary">{analysisResult.timeComplexity}</p>
                          </div>
                          <div className="rounded-lg border border-panel-border bg-secondary/20 p-3">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">💾 Space Complexity</p>
                            <p className="text-lg font-bold font-mono text-primary">{analysisResult.spaceComplexity}</p>
                          </div>
                        </div>
                        {analysisResult.optimizationPossible && analysisResult.betterApproach && (
                          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                            <p className="text-[10px] uppercase tracking-wider font-bold mb-1 text-emerald-600">🚀 Better Approach</p>
                            <p className="text-xs text-foreground leading-relaxed">{analysisResult.betterApproach}</p>
                          </div>
                        )}
                        {showFullExplanation && analysisResult.fullExplanation && (
                          <div className="rounded-lg border border-panel-border bg-secondary/10 p-3">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">📖 Full Explanation</p>
                            <div className="text-xs text-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert">
                              <ReactMarkdown>{analysisResult.fullExplanation}</ReactMarkdown>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={handleFullExplanation} disabled={isExplaining}>
                            {isExplaining ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brain className="h-3 w-3" />}
                            {showFullExplanation ? 'Refresh Explanation' : 'Full Explanation'}
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={handleAnalyze}>
                            <BarChart3 className="h-3 w-3" /> Re-analyze
                          </Button>
                        </div>
                        <div className="rounded border border-panel-border bg-secondary/10 p-2 text-[10px] text-muted-foreground">
                          💡 Tip: Write different approaches in the Brute/Better/Optimal tabs, then analyze each to compare complexities.
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
                        <p className="text-xs text-muted-foreground">Click <strong>Analyze</strong> to get time & space complexity analysis</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}
              {bottomTab === 'history' && authUser && key && (
                <ExecutionHistoryPanel
                  key={historyRefreshKey}
                  userId={authUser.id}
                  problemId={key}
                  onRestoreCode={(restored) => { setCode(restored); toast.success('Code restored from history'); }}
                />
              )}
              {bottomTab === 'solutions' && (
                <SolutionComparison code={code} problemTitle={roadmapProblem.title} />
              )}
            </div>
          </div>
        </div>

        {/* Right: AI Assistant */}
        {!focusMode && !contestMode && !generatorMode && (
          <div className="hidden lg:block w-[320px] xl:w-[360px] shrink-0 border-l border-panel-border overflow-hidden">
            <AIChatPanel 
              code={code} 
              problemId={key || null} 
              problemTitle={roadmapProblem?.title || (detail as any).title}
              problemDescription={detail.description}
              problemExamples={detail.examples}
              problemConstraints={detail.constraints}
              module={(roadmapProblem as any)?.topic || 'Problem Workspace'}
              aiEnabled={true} 
            />
          </div>
        )}
        {(contestMode || generatorMode) && (
          <div className="hidden lg:flex w-[320px] xl:w-[360px] shrink-0 border-l border-panel-border flex-col items-center justify-center p-6 text-center bg-secondary/5">
            <Trophy className="h-12 w-12 text-warning mb-4 opacity-50" />
            <h3 className="text-sm font-bold text-foreground">{contestMode ? 'Contest' : 'Generator'} Mode Active</h3>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {contestMode 
                ? 'AI Assistance and community solutions are disabled during active contests to ensure a fair testing environment.'
                : 'AI assistance is restricted for generated challenges to encourage independent problem-solving.'}
            </p>
            <div className="mt-8 p-4 rounded-lg border border-panel-border bg-card/30 text-left">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Rules:</p>
              <ul className="text-[10px] text-muted-foreground space-y-2 list-disc pl-4">
                <li>No AI explanations or hints allowed.</li>
                <li>Templates and community solutions are hidden.</li>
                <li>Your time and code are being tracked separately.</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Success Celebration Modal */}
      <SuccessCelebration
        open={showCelebration}
        onClose={() => setShowCelebration(false)}
        problemTitle={roadmapProblem?.title || 'Problem'}
        passedCount={testResults.filter(r => r.status === 'PASSED').length}
        totalCount={testResults.length}
        executionTime={celebrationTime}
        onTryAgain={() => setShowCelebration(false)}
        onNextProblem={() => {
          // Find next problem in the same topic
          for (const topic of allRoadmaps) {
            const idx = topic.problems.findIndex(p => p.key === key);
            if (idx >= 0 && idx < topic.problems.length - 1) {
              navigate(`/problem/${topic.problems[idx + 1].key}`);
              setShowCelebration(false);
              return;
            }
          }
          navigate('/modules');
          setShowCelebration(false);
        }}
      />
    </div>
  );
};

export default ProblemWorkspace;
