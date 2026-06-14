import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Map, Code2, BookOpen, Brain, Timer, MessageSquare, Zap, Dices, Plus, Sparkles,
  Layers, GraduationCap, Clock, Building2, Award, Trophy, Share2, Target,
  AlertTriangle, Activity, Calendar, Bookmark, FileSpreadsheet, BarChart3,
  TrendingUp, RotateCcw, Search, Flame, ArrowRight, Smartphone, ShoppingBag,
  Mail, Settings as SettingsIcon, Shield, Coins, User, Home
} from 'lucide-react';
import { useUser } from '@/lib/user-context';
import { supabase } from '@/integrations/supabase/client';
import { STRIVER_ROADMAP, getTotalProblems } from '@/lib/striver-roadmap-data';
import { NEETCODE_ROADMAP, getNeetcodeTotalProblems } from '@/lib/neetcode-roadmap-data';
import { LEETCODE_TOP150_ROADMAP, getLeetcodeTop150TotalProblems } from '@/lib/leetcode-top150-data';
import AppShell from '@/components/AppShell';

interface ModuleCard {
  id: string; title: string; subtitle: string; icon: React.ReactNode; route: string;
  category: 'roadmap' | 'practice' | 'study' | 'social' | 'tools';
}

const MODULES: ModuleCard[] = [
  { id: 'striver', title: 'DSA Master Sheet', subtitle: '454 curated problems', icon: <Map className="h-4 w-4" />, route: '/striver', category: 'roadmap' },
  { id: 'neetcode', title: 'Interview Essentials 150', subtitle: '150 essential problems', icon: <Code2 className="h-4 w-4" />, route: '/neetcode', category: 'roadmap' },
  { id: 'leetcode150', title: 'Top 150 Coding Problems', subtitle: '150 must-do problems', icon: <BookOpen className="h-4 w-4" />, route: '/leetcode150', category: 'roadmap' },
  { id: 'learning-path', title: 'Adaptive Path', subtitle: 'AI-personalized roadmap', icon: <Brain className="h-4 w-4" />, route: '/learning-path', category: 'roadmap' },

  { id: 'contest', title: 'Contest Mode', subtitle: 'Timed problem solving', icon: <Timer className="h-4 w-4" />, route: '/contest', category: 'practice' },
  { id: 'interview', title: 'Mock Interview', subtitle: 'Simulate real interviews', icon: <MessageSquare className="h-4 w-4" />, route: '/interview', category: 'practice' },
  { id: 'playground', title: 'Code Playground', subtitle: 'Free-form Java sandbox', icon: <Zap className="h-4 w-4" />, route: '/playground', category: 'practice' },
  { id: 'generator', title: 'Problem Generator', subtitle: 'AI-generated challenges', icon: <Dices className="h-4 w-4" />, route: '/generator', category: 'practice' },
  { id: 'quick-practice', title: 'Quick Practice', subtitle: 'Mental coding & MCQs', icon: <Smartphone className="h-4 w-4" />, route: '/quick-practice', category: 'practice' },
  { id: 'custom', title: 'Custom Problems', subtitle: 'Create your own problems', icon: <Plus className="h-4 w-4" />, route: '/custom-problems', category: 'practice' },
  { id: 'code-review', title: 'AI Code Review', subtitle: 'Quality & best practices', icon: <Sparkles className="h-4 w-4" />, route: '/code-review', category: 'practice' },

  { id: 'flashcards', title: 'Flashcards', subtitle: '30+ DSA concept cards', icon: <Layers className="h-4 w-4" />, route: '/flashcards', category: 'study' },
  { id: 'cheatsheet', title: 'Cheat Sheet', subtitle: 'Quick algorithm reference', icon: <BookOpen className="h-4 w-4" />, route: '/cheatsheet', category: 'study' },
  { id: 'patterns', title: 'Patterns Library', subtitle: 'Common coding patterns', icon: <GraduationCap className="h-4 w-4" />, route: '/patterns', category: 'study' },
  { id: 'learning', title: 'Learning Mode', subtitle: 'Interactive lessons', icon: <Brain className="h-4 w-4" />, route: '/learning', category: 'study' },
  { id: 'spaced', title: 'Spaced Repetition', subtitle: 'SM-2 review scheduling', icon: <Clock className="h-4 w-4" />, route: '/spaced-repetition', category: 'study' },
  { id: 'company', title: 'Company Tags', subtitle: '20 companies, 400+ mappings', icon: <Building2 className="h-4 w-4" />, route: '/company-tags', category: 'study' },
  { id: 'today-review', title: "Today's Review", subtitle: 'Spaced repetition queue', icon: <RotateCcw className="h-4 w-4" />, route: '/today-review', category: 'study' },
  { id: 'bigo', title: 'Big-O Visualizer', subtitle: 'Interactive complexity chart', icon: <BarChart3 className="h-4 w-4" />, route: '/bigo', category: 'study' },

  { id: 'achievements', title: 'Achievements', subtitle: 'Badges & milestones', icon: <Award className="h-4 w-4" />, route: '/achievements', category: 'social' },
  { id: 'leaderboard', title: 'Leaderboard', subtitle: 'Compete with others', icon: <Trophy className="h-4 w-4" />, route: '/leaderboard', category: 'social' },
  { id: 'community', title: 'Community Solutions', subtitle: 'Share & learn from others', icon: <Share2 className="h-4 w-4" />, route: '/community', category: 'social' },
  { id: 'discuss', title: 'Discussion Forum', subtitle: 'Per-problem discussions', icon: <MessageSquare className="h-4 w-4" />, route: '/discuss', category: 'social' },
  { id: 'streak-calendar', title: 'Activity Calendar', subtitle: 'GitHub-style heatmap', icon: <Calendar className="h-4 w-4" />, route: '/streak-calendar', category: 'social' },
  { id: 'profile', title: 'My Profile', subtitle: 'Stats, badges & progress', icon: <Target className="h-4 w-4" />, route: '/profile', category: 'social' },

  { id: 'planner', title: 'Study Planner', subtitle: 'Daily goals & streaks', icon: <Calendar className="h-4 w-4" />, route: '/study-planner', category: 'tools' },
  { id: 'weak-topics', title: 'Weak Topic Analyzer', subtitle: 'Find & fix weak areas', icon: <AlertTriangle className="h-4 w-4" />, route: '/weak-topics', category: 'tools' },
  { id: 'complexity', title: 'Complexity Tracker', subtitle: 'Track execution trends', icon: <Activity className="h-4 w-4" />, route: '/complexity', category: 'tools' },
  { id: 'goals', title: 'Weekly Goals', subtitle: 'Track weekly targets', icon: <Target className="h-4 w-4" />, route: '/goals', category: 'tools' },
  { id: 'pomodoro', title: 'Pomodoro Timer', subtitle: 'Focus & break cycles', icon: <Clock className="h-4 w-4" />, route: '/pomodoro', category: 'tools' },
  { id: 'bookmarks', title: 'Bookmarks', subtitle: 'Saved for revision', icon: <Bookmark className="h-4 w-4" />, route: '/bookmarks', category: 'tools' },
  { id: 'export', title: 'Progress Export', subtitle: 'CSV & JSON export', icon: <FileSpreadsheet className="h-4 w-4" />, route: '/export', category: 'tools' },
  { id: 'analytics', title: 'Study Analytics', subtitle: 'Visualize progress', icon: <BarChart3 className="h-4 w-4" />, route: '/analytics', category: 'tools' },
  { id: 'dashboard', title: 'Performance Dashboard', subtitle: 'Unified overview', icon: <TrendingUp className="h-4 w-4" />, route: '/dashboard', category: 'tools' },
  { id: 'search', title: 'Problem Search', subtitle: 'Search 750+ problems', icon: <Search className="h-4 w-4" />, route: '/search', category: 'tools' },
  { id: 'submissions', title: 'Submission History', subtitle: 'Past submissions', icon: <Code2 className="h-4 w-4" />, route: '/submissions', category: 'tools' },
];

const CATEGORY_INFO: Record<string, { label: string; description: string }> = {
  roadmap: { label: 'Roadmaps', description: 'Curated problem sequences to build mastery' },
  practice: { label: 'Practice', description: 'Sharpen your skills with focused challenges' },
  study: { label: 'Study & Learn', description: 'Concepts, patterns, and reference material' },
  social: { label: 'Community', description: 'Share, compete, and track your journey' },
  tools: { label: 'Productivity', description: 'Plan, analyze, and optimize your practice' },
};

const ModuleSelector = () => {
  const navigate = useNavigate();
  const { authUser } = useUser();
  const [solvedCount, setSolvedCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const totalProblems = getTotalProblems() + getNeetcodeTotalProblems() + getLeetcodeTop150TotalProblems();

  useEffect(() => {
    if (!authUser) return;
    supabase.from('user_problem_progress').select('problem_key, solved, last_attempted')
      .eq('user_id', authUser.id).eq('solved', true)
      .then(({ data, error }) => {
        if (error || !data) return;
        setSolvedCount(data.length);
        const dates = data.filter((p: any) => p.last_attempted)
          .map((p: any) => new Date(p.last_attempted).toDateString());
        const unique = [...new Set(dates)].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        
        let s = 0;
        const today = new Date();
        for (let i = 0; i < unique.length; i++) {
          const expected = new Date(today);
          expected.setDate(expected.getDate() - i);
          if (unique[i] === expected.toDateString()) s++; 
          else if (i === 0) {
            // Check if streak was active yesterday
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            if (unique[i] === yesterday.toDateString()) {
              // Streak still alive from yesterday
              continue; 
            }
            break;
          } else break;
        }
        setStreak(s);
      }).then(undefined, (err: any) => console.error("Streak calculation error:", err));
  }, [authUser]);

  const categories: Array<keyof typeof CATEGORY_INFO> = ['roadmap', 'practice', 'study', 'social', 'tools'];
  const pct = totalProblems > 0 ? (solvedCount / totalProblems) * 100 : 0;

  return (
    <AppShell title="All modules" subtitle={`${MODULES.length} tools across ${categories.length} categories`}>
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-12 animate-in-up">
        {/* Hero */}
        <section className="grid md:grid-cols-[1.5fr,1fr] gap-8 items-end">
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-balance">
              Welcome back.
              <span className="block text-muted-foreground">Pick where you left off.</span>
            </h1>
            <p className="text-[15px] text-muted-foreground max-w-md leading-relaxed">
              A focused workspace for deliberate practice — roadmaps, drills, study, and analytics in one place.
            </p>
          </div>

          {/* Stat ring */}
          <div className="surface-elevated p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Overall</div>
                <div className="text-2xl font-semibold tabular-nums tracking-tight">{solvedCount}<span className="text-muted-foreground text-base font-normal"> / {totalProblems}</span></div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1 justify-end"><Flame className="h-3 w-3" /> Streak</div>
                <div className="text-2xl font-semibold tabular-nums tracking-tight">{streak}<span className="text-muted-foreground text-base font-normal"> day{streak === 1 ? '' : 's'}</span></div>
              </div>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-foreground rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-[11px] text-muted-foreground mt-2 tabular-nums">{pct.toFixed(1)}% complete</div>
          </div>
        </section>

        {/* Categories */}
        {categories.map(cat => {
          const items = MODULES.filter(m => m.category === cat);
          return (
            <section key={cat} className="space-y-4">
              <header className="flex items-baseline justify-between gap-4">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{CATEGORY_INFO[cat].label}</h2>
                  <p className="text-[13px] text-foreground/80 mt-1">{CATEGORY_INFO[cat].description}</p>
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums">{items.length}</span>
              </header>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-stagger">
                {items.map(mod => (
                  <button
                    key={mod.id}
                    onClick={() => navigate(mod.route)}
                    className="card-interactive group text-left rounded-xl border border-border bg-card p-4 flex items-center gap-3.5"
                  >
                    <div className="h-9 w-9 rounded-lg bg-secondary text-foreground flex items-center justify-center shrink-0 group-hover:bg-foreground group-hover:text-background transition-colors">
                      {mod.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-foreground truncate">{mod.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">{mod.subtitle}</div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
};

export default ModuleSelector;
