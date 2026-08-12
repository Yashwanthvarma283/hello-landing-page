import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, CheckCircle2, Circle, Bookmark, BookmarkCheck,
  Loader2, Target, Sparkles, RotateCcw, ArrowRight, AlertTriangle, Eye
} from 'lucide-react';
import { stageVisualizerCode, codeForProblem } from '@/lib/visualizer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUser } from '@/lib/user-context';
import { supabase } from '@/integrations/supabase/client';
import { type RoadmapProblem, type RoadmapTopic } from '@/lib/striver-roadmap-data';
import AppShell from '@/components/AppShell';
import { ReportIssueDialog } from '@/components/ReportIssueDialog';

interface UserProgress {
  problem_key: string;
  status: string;
  solved: boolean;
  marked_for_revision: boolean;
  attempts: number;
}

interface RoadmapPageProps {
  title: string;
  icon: React.ReactNode;
  roadmap: RoadmapTopic[];
  backPath?: string;
}

const difficultyDot = (d: string) =>
  d === 'Easy' ? 'bg-success' : d === 'Hard' ? 'bg-destructive' : 'bg-warning';

const RoadmapPage = ({ title, roadmap }: RoadmapPageProps) => {
  const navigate = useNavigate();
  const { authUser } = useUser();
  const [progress, setProgress] = useState<Record<string, UserProgress>>({});
  const [loading, setLoading] = useState(true);
  const [openTopics, setOpenTopics] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'solved' | 'unsolved' | 'revision'>('all');

  const allKeys = useMemo(() => roadmap.flatMap(t => t.problems.map(p => p.key)), [roadmap]);

  useEffect(() => {
    if (!authUser) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('user_problem_progress')
        .select('problem_key, status, solved, marked_for_revision, attempts')
        .eq('user_id', authUser.id)
        .in('problem_key', allKeys);
      const map: Record<string, UserProgress> = {};
      (data || []).forEach((p: any) => { map[p.problem_key] = p; });
      setProgress(map);
      setLoading(false);
    })();
  }, [authUser, allKeys]);

  const stats = useMemo(() => {
    const total = roadmap.reduce((s, t) => s + t.problems.length, 0);
    const solved = Object.values(progress).filter(p => p.solved).length;
    const revision = Object.values(progress).filter(p => p.marked_for_revision).length;
    const easy = roadmap.flatMap(t => t.problems).filter(p => p.difficulty === 'Easy' && progress[p.key]?.solved).length;
    const medium = roadmap.flatMap(t => t.problems).filter(p => p.difficulty === 'Medium' && progress[p.key]?.solved).length;
    const hard = roadmap.flatMap(t => t.problems).filter(p => p.difficulty === 'Hard' && progress[p.key]?.solved).length;
    return { total, solved, revision, easy, medium, hard };
  }, [progress, roadmap]);

  const recommendation = useMemo(() => {
    let weakest = { name: '', pct: 100, problem: null as RoadmapProblem | null };
    for (const topic of roadmap) {
      const solved = topic.problems.filter(p => progress[p.key]?.solved).length;
      const pct = topic.problems.length > 0 ? (solved / topic.problems.length) * 100 : 100;
      if (pct < weakest.pct) {
        const next = topic.problems.find(p => !progress[p.key]?.solved);
        if (next) weakest = { name: topic.name, pct, problem: next };
      }
    }
    return weakest.problem ? { topic: weakest.name, problem: weakest.problem } : null;
  }, [progress, roadmap]);

  const toggleTopic = (name: string) =>
    setOpenTopics(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const handlePractice = (problem: RoadmapProblem) => navigate(`/problem/${problem.key}`);

  const toggleSolved = async (problem: RoadmapProblem) => {
    if (!authUser) return;
    const existing = progress[problem.key];
    const nowSolved = !existing?.solved;
    const upsertData = {
      user_id: authUser.id,
      problem_key: problem.key,
      status: nowSolved ? 'solved' : 'attempted',
      solved: nowSolved,
      attempts: (existing?.attempts || 0) + 1,
      last_attempted: new Date().toISOString(),
      ...(nowSolved ? { solved_at: new Date().toISOString() } : {}),
    };
    if (existing) {
      await supabase.from('user_problem_progress').update(upsertData as any).eq('user_id', authUser.id).eq('problem_key', problem.key);
    } else {
      await supabase.from('user_problem_progress').insert(upsertData as any);
    }
    setProgress(prev => ({ ...prev, [problem.key]: { ...prev[problem.key], ...upsertData } as UserProgress }));
  };

  const toggleRevision = async (problem: RoadmapProblem) => {
    if (!authUser) return;
    const existing = progress[problem.key];
    const newVal = !existing?.marked_for_revision;
    if (existing) {
      await supabase.from('user_problem_progress').update({ marked_for_revision: newVal } as any).eq('user_id', authUser.id).eq('problem_key', problem.key);
    } else {
      await supabase.from('user_problem_progress').insert({
        user_id: authUser.id, problem_key: problem.key, status: 'not_started',
        solved: false, marked_for_revision: newVal, attempts: 0,
      } as any);
    }
    setProgress(prev => ({ ...prev, [problem.key]: { ...prev[problem.key], problem_key: problem.key, marked_for_revision: newVal } as UserProgress }));
  };

  const filterProblems = (problems: RoadmapProblem[]) => {
    if (filter === 'all') return problems;
    if (filter === 'solved') return problems.filter(p => progress[p.key]?.solved);
    if (filter === 'unsolved') return problems.filter(p => !progress[p.key]?.solved);
    if (filter === 'revision') return problems.filter(p => progress[p.key]?.marked_for_revision);
    return problems;
  };

  const overallPct = stats.total > 0 ? (stats.solved / stats.total) * 100 : 0;

  return (
    <AppShell title={title} subtitle={`${stats.solved} of ${stats.total} solved · ${Math.round(overallPct)}%`}>
      <div className="max-w-6xl mx-auto px-6 pt-2 pb-8 grid lg:grid-cols-[280px,1fr] gap-8 animate-in-up">
        {/* Side column */}
        <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
          <ReportIssueDialog trigger={
            <Button variant="outline" className="w-full justify-start gap-2 text-muted-foreground hover:text-warning border-dashed">
              <AlertTriangle className="h-4 w-4" /> Report Issue
            </Button>
          } />
          <div className="surface-elevated p-5 rounded-xl">
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Progress</span>
              <span className="text-sm font-semibold tabular-nums">{Math.round(overallPct)}%</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-foreground rounded-full transition-all duration-700" style={{ width: `${overallPct}%` }} />
            </div>
            <div className="text-[11px] text-muted-foreground mt-2 tabular-nums">{stats.solved} / {stats.total} problems</div>
          </div>

          <div className="surface p-5 rounded-xl space-y-3">
            <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Difficulty</div>
            {[
              { label: 'Easy', count: stats.easy },
              { label: 'Medium', count: stats.medium },
              { label: 'Hard', count: stats.hard },
            ].map(d => (
              <div key={d.label} className="flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${difficultyDot(d.label)}`} />
                  {d.label}
                </span>
                <span className="text-muted-foreground tabular-nums font-mono text-xs">{d.count}</span>
              </div>
            ))}
          </div>

          {recommendation && (
            <div className="surface-elevated p-5 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
                <Sparkles className="h-3 w-3" /> Recommended next
              </div>
              <div className="text-[13px] font-medium leading-snug">{recommendation.problem.title}</div>
              <div className="text-[11px] text-muted-foreground">{recommendation.topic}</div>
              <Button size="sm" className="w-full h-8 mt-2 text-[12px] gap-1" onClick={() => handlePractice(recommendation.problem!)}>
                Practice now <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Filter</div>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'unsolved', 'solved', 'revision'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                    filter === f
                      ? 'bg-foreground text-background border-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {stats.revision > 0 && (
            <button
              onClick={() => setFilter(filter === 'revision' ? 'all' : 'revision')}
              className="flex items-center gap-2 text-[12px] text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <RotateCcw className="h-3 w-3" /> Revision list ({stats.revision})
            </button>
          )}
        </aside>

        {/* Main list */}
        <div className="space-y-2 min-w-0">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="surface h-16 animate-pulse rounded-xl" />)}
            </div>
          ) : (
            roadmap.map((topic) => {
              const filteredProblems = filterProblems(topic.problems);
              const solvedCount = topic.problems.filter(p => progress[p.key]?.solved).length;
              const pct = topic.problems.length > 0 ? (solvedCount / topic.problems.length) * 100 : 0;
              const isOpen = openTopics.has(topic.name);
              if (filter !== 'all' && filteredProblems.length === 0) return null;

              return (
                <div key={topic.name} className="surface rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleTopic(topic.name)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-secondary/50 transition-colors text-left"
                  >
                    <div className="text-xl shrink-0">{topic.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold tracking-tight truncate">{topic.name}</span>
                        {pct >= 100 && <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden max-w-xs">
                          <div className="h-full bg-foreground rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] text-muted-foreground tabular-nums font-mono">{solvedCount}/{topic.problems.length}</span>
                      </div>
                    </div>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="border-t border-border divide-y divide-border">
                      {filteredProblems.map((problem, idx) => {
                        const p = progress[problem.key];
                        const isSolved = p?.solved;
                        const isRevision = p?.marked_for_revision;
                        return (
                          <div
                            key={problem.key}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/40 transition-colors group animate-fade-in"
                            style={{ animationDelay: `${Math.min(idx, 10) * 18}ms` }}
                          >
                            <button onClick={() => toggleSolved(problem)} aria-label="Toggle solved" className="shrink-0">
                              {isSolved ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground/60 hover:text-foreground transition-colors" />}
                            </button>
                            <span className="text-[10px] text-muted-foreground/70 font-mono tabular-nums w-6 text-right">{idx + 1}</span>
                            <button
                              onClick={() => handlePractice(problem)}
                              className={`flex-1 text-left text-[13px] font-medium truncate transition-colors ${isSolved ? 'text-muted-foreground' : 'text-foreground hover:text-foreground'}`}
                            >
                              {problem.title}
                            </button>
                            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0">
                              <span className={`h-1.5 w-1.5 rounded-full ${difficultyDot(problem.difficulty)}`} />
                              <span className="hidden sm:inline">{problem.difficulty}</span>
                            </div>
                            {p?.attempts ? (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 tabular-nums shrink-0">
                                <Target className="h-2.5 w-2.5" />{p.attempts}
                              </span>
                            ) : null}
                            <button
                              onClick={() => handleVisualize(problem)}
                              aria-label={`Visualize ${problem.title}`}
                              title="Visualize execution step by step"
                              className="shrink-0 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-muted-foreground/70 hover:text-foreground"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => toggleRevision(problem)} aria-label="Toggle revision" className="shrink-0 opacity-0 group-hover:opacity-100 data-[on=true]:opacity-100 transition-opacity" data-on={isRevision}>
                              {isRevision ? <BookmarkCheck className="h-3.5 w-3.5 text-warning" /> : <Bookmark className="h-3.5 w-3.5 text-muted-foreground/70 hover:text-warning transition-colors" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
};

export default RoadmapPage;
