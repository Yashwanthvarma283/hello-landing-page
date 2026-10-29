import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Timer, Loader2, CheckCircle2, Shuffle, Building2, BookOpen, History, Users, RefreshCw, ArrowLeft, Terminal, Code2, Sparkles, Clock, Layout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser } from '@/lib/user-context';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { STRIVER_ROADMAP } from '@/lib/striver-roadmap-data';
import { NEETCODE_ROADMAP } from '@/lib/neetcode-roadmap-data';
import { LEETCODE_TOP150_ROADMAP } from '@/lib/leetcode-top150-data';
import { getProblemDetail } from '@/lib/striver-problem-details';
import CodeEditor from '@/components/CodeEditor';
import ReactMarkdown from 'react-markdown';

// ─── Problem pool helpers ────────────────────────────────────────

const MODULES = {
  striver: { label: 'DSA Master Sheet', data: STRIVER_ROADMAP },
  neetcode: { label: 'Interview Essentials 150', data: NEETCODE_ROADMAP },
  leetcode150: { label: 'Top 150 Coding Problems', data: LEETCODE_TOP150_ROADMAP },
};

type ModuleKey = keyof typeof MODULES | 'all';

const ALL_ROADMAPS = [...STRIVER_ROADMAP, ...NEETCODE_ROADMAP, ...LEETCODE_TOP150_ROADMAP];
const ALL_PROBLEMS = ALL_ROADMAPS.flatMap(t => t.problems.map(p => ({ ...p, topic: t.name })));

const TITLE_LOOKUP = new Map<string, typeof ALL_PROBLEMS[0]>();
ALL_PROBLEMS.forEach(p => {
  const normalized = p.title.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!TITLE_LOOKUP.has(normalized)) TITLE_LOOKUP.set(normalized, p);
});

function findBySlug(slug: string) {
  const normalized = slug.replace(/-/g, '');
  if (TITLE_LOOKUP.has(normalized)) return TITLE_LOOKUP.get(normalized)!;
  const terms = slug.split('-').filter(Boolean);
  for (const [key, prob] of TITLE_LOOKUP) {
    if (terms.every(t => key.includes(t))) return prob;
  }
  return null;
}

const COMPANY_TAGS: Record<string, string[]> = {
  'Google': ['two-sum', 'median-two-sorted', 'merge-intervals', 'lru-cache', 'trapping-rain', 'longest-substring', 'course-schedule', 'number-of-islands', 'valid-parentheses', 'container-most-water', 'three-sum', 'group-anagrams', 'product-except-self', 'top-k-frequent', 'coin-change', 'climbing-stairs', 'maximum-subarray', 'best-time-buy-sell', 'binary-search', 'search-rotated', 'word-break', 'longest-increasing', 'edit-distance', 'rotate-image', 'spiral-matrix', 'longest-palindrome', 'decode-ways', 'unique-paths', 'jump-game', 'house-robber', 'word-search', 'subsets', 'permutations', 'combination-sum', 'find-median-stream', 'sliding-window-max', 'daily-temperatures', 'task-scheduler'],
  'Amazon': ['two-sum', 'add-two-numbers', 'lru-cache', 'merge-intervals', 'number-of-islands', 'word-break', 'product-except-self', 'merge-k-sorted', 'trapping-rain', 'longest-substring', 'valid-parentheses', 'three-sum', 'group-anagrams', 'top-k-frequent', 'coin-change', 'climbing-stairs', 'maximum-subarray', 'best-time-buy-sell', 'binary-search', 'search-rotated', 'reverse-linked-list', 'merge-two-sorted', 'longest-palindrome', 'decode-string', 'daily-temperatures', 'task-scheduler', 'subsets', 'permutations', 'combination-sum', 'word-search', 'jump-game', 'unique-paths', 'house-robber'],
  'Meta': ['two-sum', 'longest-substring', 'valid-parentheses', 'merge-intervals', 'product-except-self', 'three-sum', 'group-anagrams', 'top-k-frequent', 'coin-change', 'number-of-islands', 'word-break', 'container-most-water', 'trapping-rain', 'lru-cache', 'best-time-buy-sell', 'maximum-subarray', 'reverse-linked-list', 'longest-palindrome', 'decode-ways', 'unique-paths', 'subsets', 'permutations', 'combination-sum', 'generate-parentheses', 'word-search', 'jump-game', 'house-robber', 'daily-temperatures', 'find-median-stream'],
  'Microsoft': ['two-sum', 'reverse-linked-list', 'lru-cache', 'merge-intervals', 'product-except-self', 'spiral-matrix', 'number-of-islands', 'word-search', 'group-anagrams', 'three-sum', 'valid-parentheses', 'trapping-rain', 'longest-substring', 'top-k-frequent', 'coin-change', 'climbing-stairs', 'maximum-subarray', 'best-time-buy-sell', 'binary-search', 'search-rotated', 'longest-palindrome', 'decode-ways', 'unique-paths', 'jump-game', 'house-robber', 'subsets', 'permutations', 'daily-temperatures', 'task-scheduler'],
  'Apple': ['two-sum', 'valid-parentheses', 'merge-two-sorted', 'best-time-buy-sell', 'three-sum', 'container-most-water', 'number-of-islands', 'reverse-linked-list', 'climbing-stairs', 'maximum-subarray', 'binary-search', 'group-anagrams', 'product-except-self', 'top-k-frequent', 'coin-change', 'merge-intervals', 'lru-cache', 'longest-substring', 'decode-ways', 'unique-paths', 'house-robber', 'word-search', 'subsets', 'longest-palindrome', 'jump-game', 'daily-temperatures'],
  'Bloomberg': ['two-sum', 'valid-parentheses', 'merge-intervals', 'lru-cache', 'three-sum', 'group-anagrams', 'top-k-frequent', 'coin-change', 'number-of-islands', 'word-break', 'product-except-self', 'best-time-buy-sell', 'maximum-subarray', 'reverse-linked-list', 'trapping-rain', 'longest-substring', 'daily-temperatures', 'sliding-window-max', 'task-scheduler', 'decode-ways', 'unique-paths', 'house-robber'],
  'Uber': ['two-sum', 'merge-intervals', 'word-break', 'number-of-islands', 'course-schedule', 'lru-cache', 'longest-substring', 'three-sum', 'valid-parentheses', 'group-anagrams', 'product-except-self', 'top-k-frequent', 'coin-change', 'best-time-buy-sell', 'binary-search', 'search-rotated', 'reverse-linked-list', 'unique-paths', 'jump-game', 'daily-temperatures', 'subsets', 'combination-sum'],
  'Goldman Sachs': ['two-sum', 'trapping-rain', 'median-two-sorted', 'lru-cache', 'number-of-islands', 'coin-change', 'edit-distance', 'longest-increasing', 'three-sum', 'valid-parentheses', 'group-anagrams', 'product-except-self', 'top-k-frequent', 'best-time-buy-sell', 'binary-search', 'merge-intervals', 'decode-ways', 'unique-paths', 'house-robber', 'daily-temperatures'],
  'TikTok / ByteDance': ['two-sum', 'lru-cache', 'merge-intervals', 'trapping-rain', 'longest-substring', 'three-sum', 'number-of-islands', 'valid-parentheses', 'group-anagrams', 'product-except-self', 'top-k-frequent', 'coin-change', 'best-time-buy-sell', 'binary-search', 'search-rotated', 'reverse-linked-list', 'word-break', 'longest-palindrome', 'decode-ways', 'unique-paths', 'jump-game', 'subsets', 'permutations', 'daily-temperatures', 'sliding-window-max'],
  'Netflix': ['lru-cache', 'merge-intervals', 'top-k-frequent', 'find-median-stream', 'course-schedule', 'longest-substring', 'two-sum', 'three-sum', 'number-of-islands', 'coin-change', 'longest-increasing', 'product-except-self', 'group-anagrams', 'daily-temperatures', 'unique-paths', 'house-robber', 'decode-ways'],
};

const COMPANY_NAMES = Object.keys(COMPANY_TAGS);

// ─── Component ───────────────────────────────────────────────────

const InterviewSimulator = () => {
  const { authUser } = useUser();
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState('all');
  const [timeLimit, setTimeLimit] = useState(30);
  const [source, setSource] = useState<'random' | 'module' | 'company' | 'solved'>('random');
  const [selectedModule, setSelectedModule] = useState<ModuleKey>('all');
  const [selectedCompany, setSelectedCompany] = useState(COMPANY_NAMES[0]);
  const [phase, setPhase] = useState<'setup' | 'coding' | 'review'>('setup');
  const [problem, setProblem] = useState<any>(null);
  const [code, setCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [aiFeedback, setAiFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [solvedKeys, setSolvedKeys] = useState<Set<string>>(new Set());
  const [roomCode, setRoomCode] = useState('');
  const [lobbyHistory, setLobbyHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'problem' | 'code'>('problem');
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (!authUser) return;
    supabase.from('interview_results').select('*').eq('user_id', authUser.id).order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => setHistory(data || []));
    supabase.from('user_problem_progress').select('problem_key').eq('user_id', authUser.id).eq('solved', true)
      .then(({ data }) => setSolvedKeys(new Set((data || []).map(d => d.problem_key))));
    supabase.from('lobby_participants')
      .select('*, lobby:lobby_id(*)')
      .eq('user_id', authUser.id)
      .order('joined_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setLobbyHistory((data || []).filter(d => d.lobby)));
  }, [authUser, phase]);

  useEffect(() => {
    if (phase !== 'coding') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [phase]);

  const problemPool = useMemo(() => {
    let pool: typeof ALL_PROBLEMS = [];
    if (source === 'solved') {
      pool = ALL_PROBLEMS.filter(p => solvedKeys.has(p.key));
    } else if (source === 'company') {
      const slugs = COMPANY_TAGS[selectedCompany] || [];
      pool = slugs.map(s => findBySlug(s)).filter(Boolean) as typeof ALL_PROBLEMS;
    } else if (source === 'module') {
      if (selectedModule === 'all') {
        pool = ALL_PROBLEMS;
      } else {
        const mod = MODULES[selectedModule];
        pool = mod.data.flatMap(t => t.problems.map(p => ({ ...p, topic: t.name })));
      }
    } else {
      pool = ALL_PROBLEMS;
    }

    if (difficulty !== 'all') {
      pool = pool.filter(p => p.difficulty === difficulty);
    }

    const seen = new Set<string>();
    return pool.filter(p => {
      if (seen.has(p.key)) return false;
      seen.add(p.key);
      return true;
    });
  }, [source, selectedModule, selectedCompany, difficulty, solvedKeys]);

  const startInterview = async () => {
    if (problemPool.length === 0) return;
    const picked = problemPool[Math.floor(Math.random() * problemPool.length)];
    setLoading(true);
    const detail = getProblemDetail(picked.key, picked.title, picked.difficulty);
    setProblem({ ...picked, detail });
    setCode(detail.starterCode);
    setTimeLeft(timeLimit * 60);
    setAiFeedback('');
    setPhase('coding');
    setLoading(false);

    try {
      // Check shared Supabase DB cache first
      const { data: dbData } = await supabase
        .from('problem_test_cases')
        .select('*')
        .eq('problem_key', picked.key)
        .maybeSingle();

      if (dbData && dbData.description) {
        setProblem((prev: any) => {
          if (prev?.key !== picked.key) return prev;
          if (dbData.starter_code) setCode(dbData.starter_code);
          return {
            ...prev,
            detail: {
              ...prev.detail,
              description: dbData.description,
              starterCode: dbData.starter_code || prev.detail.starterCode,
              testCases: dbData.test_cases || prev.detail.testCases,
            }
          };
        });
      } else {
        const { data: edgeData } = await supabase.functions.invoke('generate-problem-detail', {
          body: { problem_key: picked.key, title: picked.title, difficulty: picked.difficulty },
        });
        if (edgeData?.detail?.description) {
          const d = edgeData.detail;
          setProblem((prev: any) => {
            if (prev?.key !== picked.key) return prev;
            if (d.starterCode) setCode(d.starterCode);
            return {
              ...prev,
              detail: {
                ...prev.detail,
                description: d.description,
                starterCode: d.starterCode || prev.detail.starterCode,
                testCases: d.testCases || prev.detail.testCases,
              }
            };
          });
        }
      }
    } catch (e) {}
  };

  const handleSubmit = async () => {
    clearInterval(timerRef.current);
    setPhase('review');
    setLoading(true);
    const elapsed = timeLimit * 60 - timeLeft;
    try {
      const { data } = await supabase.functions.invoke('analyze-complexity', {
        body: { code, mode: 'interview-feedback', problemTitle: problem?.title },
      });
      const feedback = data?.suggestion || data?.bestApproach || 'Good attempt! Review your approach and optimize.';
      const score = Math.max(10, Math.min(100, Math.round(
        (timeLeft > 0 ? 30 : 0) + (feedback.toLowerCase().includes('optimal') ? 40 : 20) + 30
      )));
      setAiFeedback(typeof feedback === 'string' ? feedback : JSON.stringify(feedback));
      if (authUser) {
        await supabase.from('interview_results').insert({
          user_id: authUser.id,
          problem_title: problem?.title || 'Unknown',
          difficulty: problem?.difficulty || 'Medium',
          time_taken_seconds: elapsed,
          score,
          ai_feedback: feedback,
          code_snapshot: code,
        } as any);
      }
    } catch {
      setAiFeedback('Could not get AI feedback. Review your solution manually.');
    }
    setLoading(false);
  };

  const createLobby = async () => {
    if (!authUser) return;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const { data, error } = await supabase.from('interview_lobbies').insert({
        code,
        host_id: authUser.id,
        status: 'waiting'
      } as any).select().single();
      if (error) throw error;
      navigate(`/lobby/${code}`);
    } catch (error) {
      toast.error("Failed to create lobby");
    }
  };

  const joinLobby = async () => {
    if (!authUser || !roomCode) return;
    try {
      const { data, error } = await supabase.from('interview_lobbies')
        .update({ guest_id: authUser.id } as any)
        .eq('code', roomCode.toUpperCase())
        .select()
        .single();
      if (error) throw error;
      navigate(`/lobby/${roomCode.toUpperCase()}`);
    } catch (error) {
      toast.error("Lobby not found or full");
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (!authUser) return <div className="flex h-screen items-center justify-center bg-background"><p className="text-foreground">Please log in</p></div>;

  return (
    <div className="h-full bg-background flex flex-col">
      <div className="flex items-center gap-1 sm:gap-3 border-b border-panel-border bg-ide-toolbar px-3 sm:px-4 py-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate('/modules')} className="h-7 gap-1.5 text-xs font-medium rounded-lg">
          <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Back</span>
        </Button>
        <div className="h-4 w-px bg-border shrink-0" />
        <Users className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-bold truncate">Interview Simulator</span>
        
        {phase === 'coding' && (
          <div className={`ml-auto px-3 py-1 rounded-full font-mono text-xs font-bold flex items-center gap-2 ${timeLeft < 60 ? 'bg-destructive/10 text-destructive animate-pulse' : 'bg-secondary text-foreground'}`}>
            <Timer className="h-3 w-3" /> {fmt(timeLeft)}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {phase === 'setup' && (
          <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-8 animate-in-up">
            <div className="text-center sm:text-left space-y-2">
              <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">Mock Interview</h1>
              <p className="text-sm text-muted-foreground max-w-md leading-relaxed">Simulate real technical interviews with AI-generated feedback and peer lobbies.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 space-y-6">
                <Card className="rounded-3xl border-2 border-primary/10 bg-card/50 backdrop-blur-xl overflow-hidden shadow-2xl">
                  <CardHeader className="pb-2 border-b border-white/5 bg-white/5">
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                      <Layout className="h-4 w-4 text-primary" /> Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 ml-1">Question Source</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {([
                          { key: 'random' as const, label: 'Random', icon: <Shuffle className="h-4 w-4" /> },
                          { key: 'module' as const, label: 'Modules', icon: <BookOpen className="h-4 w-4" /> },
                          { key: 'company' as const, label: 'Company', icon: <Building2 className="h-4 w-4" /> },
                          { key: 'solved' as const, label: `Solved`, icon: <CheckCircle2 className="h-4 w-4" /> },
                        ]).map(s => (
                          <button
                            key={s.key}
                            onClick={() => setSource(s.key)}
                            className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 px-3 py-4 text-[11px] font-black transition-all active:scale-95 ${
                              source === s.key
                                ? 'border-primary bg-primary/10 text-primary shadow-lg shadow-primary/10'
                                : 'border-white/5 bg-secondary/30 text-muted-foreground hover:border-white/10 hover:bg-secondary/50'
                            }`}
                          >
                            {s.icon} {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {source === 'module' && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">Select Module</label>
                          <Select value={selectedModule} onValueChange={v => setSelectedModule(v as ModuleKey)}>
                            <SelectTrigger className="h-12 rounded-xl bg-secondary/50 border-transparent"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Roadmaps</SelectItem>
                              <SelectItem value="striver">DSA Master Sheet</SelectItem>
                              <SelectItem value="neetcode">Interview Essentials 150</SelectItem>
                              <SelectItem value="leetcode150">Top 150 Coding Problems</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {source === 'company' && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">Select Company</label>
                          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                            <SelectTrigger className="h-12 rounded-xl bg-secondary/50 border-transparent"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {COMPANY_NAMES.map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">Difficulty</label>
                        <Select value={difficulty} onValueChange={setDifficulty}>
                          <SelectTrigger className="h-12 rounded-xl bg-secondary/50 border-transparent"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Any Difficulty</SelectItem>
                            <SelectItem value="Easy">Easy</SelectItem>
                            <SelectItem value="Medium">Medium</SelectItem>
                            <SelectItem value="Hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-muted-foreground uppercase ml-1">Time (minutes)</label>
                        <Select value={String(timeLimit)} onValueChange={v => setTimeLimit(Number(v))}>
                          <SelectTrigger className="h-12 rounded-xl bg-secondary/50 border-transparent"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[15, 30, 45, 60].map(m => <SelectItem key={m} value={String(m)}>{m} Minutes</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                           <Sparkles className="h-4 w-4 text-primary" />
                         </div>
                         <div>
                           <p className="text-[11px] font-black text-foreground">{problemPool.length} Problems Match</p>
                           <p className="text-[9px] text-muted-foreground">Ready to simulate {difficulty === 'all' ? 'mixed' : difficulty} difficulty</p>
                         </div>
                       </div>
                       <Button onClick={startInterview} disabled={problemPool.length === 0} className="h-10 px-6 gap-2 rounded-xl font-black shadow-lg shadow-primary/20">
                         <Play className="h-4 w-4 fill-current" /> Start Session
                       </Button>
                    </div>
                  </CardContent>
                </Card>

                {history.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 px-2">
                      <History className="h-4 w-4 text-muted-foreground" /> Performance History
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {history.map((h: any) => (
                        <div key={h.id} className="p-4 rounded-2xl bg-card border border-panel-border hover:border-primary/20 transition-all group flex flex-col justify-between h-24">
                          <div className="flex items-start justify-between">
                            <span className="text-[13px] font-bold text-foreground truncate max-w-[150px]">{h.problem_title}</span>
                            <Badge className="text-[10px] h-4 bg-primary/10 text-primary border-0">{h.score}%</Badge>
                          </div>
                          <div className="flex items-center justify-between mt-auto">
                            <div className="flex items-center gap-2">
                               <Badge variant="outline" className="text-[9px] h-4">{h.difficulty}</Badge>
                               <span className="text-[10px] text-muted-foreground">{fmt(h.time_taken_seconds)} taken</span>
                            </div>
                            <span className="text-[9px] text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-4 space-y-6">
                <Card className="rounded-3xl border-2 border-primary/20 bg-primary/5 overflow-hidden shadow-xl">
                  <CardHeader className="pb-2 bg-primary/10">
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-primary">
                      <Users className="h-4 w-4" /> Multiplayer Lobby
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <p className="text-[11px] text-primary/80 font-medium leading-relaxed">
                      Practice with a peer in real-time. One acts as the interviewer while the other codes.
                    </p>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="CODE" 
                        className="h-11 text-xs font-black tracking-widest rounded-xl bg-white/10 border-transparent placeholder:text-primary/30" 
                        value={roomCode}
                        onChange={e => setRoomCode(e.target.value)}
                      />
                      <Button 
                        variant="secondary" 
                        className="h-11 px-4 font-black rounded-xl"
                        onClick={joinLobby}
                      >
                         Join
                      </Button>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full h-11 font-black rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                      onClick={createLobby}
                    >
                       Create Private Lobby
                    </Button>
                  </CardContent>
                </Card>

                {lobbyHistory.length > 0 && (
                   <Card className="rounded-3xl border border-panel-border overflow-hidden">
                     <CardHeader className="py-3 px-4 bg-secondary/30">
                       <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                         <History className="h-4 w-4 text-muted-foreground" /> Recent Lobbies
                       </CardTitle>
                     </CardHeader>
                     <CardContent className="p-0">
                        <ScrollArea className="h-[250px]">
                           <div className="divide-y divide-white/5">
                             {lobbyHistory.map((entry: any) => {
                               const lobby = entry.lobby;
                               const isOpen = !lobby.closed_at && lobby.status !== 'closed';
                               return (
                                 <div key={entry.id} className="p-4 flex items-center justify-between group hover:bg-white/5 transition-colors">
                                   <div>
                                     <p className="text-xs font-black text-primary font-mono">{lobby.code}</p>
                                     <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(entry.joined_at).toLocaleDateString()}</p>
                                   </div>
                                   {isOpen && (
                                     <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1.5 rounded-lg text-primary hover:bg-primary/10" onClick={() => navigate(`/lobby/${lobby.code}`)}>
                                       <RefreshCw className="h-3 w-3" /> Rejoin
                                     </Button>
                                   )}
                                 </div>
                               );
                             })}
                           </div>
                        </ScrollArea>
                     </CardContent>
                   </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {phase === 'coding' && problem && (
          <div className="h-full flex flex-col lg:flex-row overflow-hidden">
            {/* Desktop Layout */}
            <div className="hidden lg:flex flex-1 overflow-hidden">
               <div className="w-[450px] h-full border-r border-panel-border bg-panel-sidebar/40 overflow-auto">
                  <div className="p-8 space-y-8">
                    <div className="space-y-4">
                       <Badge className={`${problem.difficulty === 'Easy' ? 'bg-emerald-500/10 text-emerald-500' : problem.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'}`}>{problem.difficulty}</Badge>
                       <h2 className="text-3xl font-black text-foreground tracking-tight">{problem.title}</h2>
                    </div>
                    <div className="prose prose-sm prose-invert max-w-none text-foreground/80 leading-relaxed">
                       <ReactMarkdown>{problem.detail?.description || ''}</ReactMarkdown>
                    </div>
                    {problem.detail?.examples?.length > 0 && (
                      <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Examples</h3>
                        <div className="space-y-3">
                          {problem.detail.examples.map((ex: any, i: number) => (
                            <div key={i} className="p-4 rounded-2xl bg-secondary/30 border border-white/5 font-mono text-[11px] space-y-2">
                               <p><span className="text-muted-foreground">Input:</span> {ex.input}</p>
                               <p><span className="text-primary font-bold">Output:</span> {ex.output}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
               </div>
               <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1"><CodeEditor code={code} onChange={setCode} /></div>
                  <div className="h-14 border-t border-panel-border bg-ide-toolbar/50 px-6 flex items-center justify-end">
                    <Button onClick={handleSubmit} disabled={loading} className="gap-2 font-black shadow-lg shadow-primary/20">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Submit Final Solution
                    </Button>
                  </div>
               </div>
            </div>

            {/* Mobile Layout (Tabs) */}
            <div className="lg:hidden flex-1 flex flex-col overflow-hidden">
               <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col">
                  <div className="flex-1 overflow-hidden">
                    <TabsContent value="problem" className="h-full m-0 p-0">
                      <ScrollArea className="h-full">
                        <div className="p-6 space-y-6">
                           <div className="space-y-2">
                             <Badge variant="outline" className="text-[10px]">{problem.difficulty}</Badge>
                             <h2 className="text-2xl font-black">{problem.title}</h2>
                           </div>
                           <div className="prose prose-sm prose-invert max-w-none text-foreground/70 leading-relaxed text-[13px]">
                              <ReactMarkdown>{problem.detail?.description || ''}</ReactMarkdown>
                           </div>
                        </div>
                      </ScrollArea>
                    </TabsContent>
                    <TabsContent value="code" className="h-full m-0 p-0 flex flex-col">
                       <div className="flex-1"><CodeEditor code={code} onChange={setCode} /></div>
                       <div className="p-3 border-t border-panel-border flex justify-end">
                          <Button onClick={handleSubmit} disabled={loading} className="w-full gap-2 font-black h-12 rounded-xl">
                             Submit Final Solution
                          </Button>
                       </div>
                    </TabsContent>
                  </div>
                  <TabsList className="h-14 w-full bg-ide-toolbar border-t border-panel-border rounded-none p-1 shrink-0">
                     <TabsTrigger value="problem" className="flex-1 gap-2 font-bold text-xs rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                        <BookOpen className="h-4 w-4" /> Problem
                     </TabsTrigger>
                     <TabsTrigger value="code" className="flex-1 gap-2 font-bold text-xs rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                        <Code2 className="h-4 w-4" /> Code
                     </TabsTrigger>
                  </TabsList>
               </Tabs>
            </div>
          </div>
        )}

        {phase === 'review' && (
          <div className="max-w-7xl mx-auto p-4 sm:p-10 space-y-6 animate-in-up">
            <div className="text-center space-y-4">
               <div className="h-20 w-20 rounded-3xl bg-primary/10 text-primary mx-auto flex items-center justify-center rotate-6 border-2 border-primary/20 shadow-2xl">
                  <Sparkles className="h-10 w-10" />
               </div>
               <h1 className="text-3xl font-black">AI Assessment</h1>
               <p className="text-sm text-muted-foreground">Your interview has been analyzed by our expert system.</p>
            </div>

            <Card className="rounded-3xl border-2 border-panel-border overflow-hidden bg-card/50 backdrop-blur-xl">
              <CardContent className="p-8">
                {loading ? (
                  <div className="flex flex-col items-center gap-4 py-20">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm font-black text-muted-foreground animate-pulse">Processing code quality...</p>
                  </div>
                ) : (
                  <div className="prose prose-sm prose-invert max-w-none text-foreground/90 leading-relaxed">
                    <ReactMarkdown>{aiFeedback}</ReactMarkdown>
                  </div>
                )}
              </CardContent>
            </Card>

            {!loading && (
              <Button onClick={() => setPhase('setup')} variant="outline" className="w-full h-14 text-md font-black rounded-2xl border-2 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-300">
                Finish & Exit Session
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default InterviewSimulator;
