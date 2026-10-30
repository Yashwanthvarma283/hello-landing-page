import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Loader2, Sparkles, Wand2, History, Library, ChevronRight, 
  Trash2, PlayCircle, BookOpen, Clock, BarChart3 as BarChart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { parseStarterSignature, examplesToTestCases } from '@/lib/leetcode-parse';
import { useUser } from '@/lib/user-context';
import { createProblem } from '@/lib/supabase';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const TOPICS = ['Arrays', 'Strings', 'Linked Lists', 'Trees', 'Graphs', 'Dynamic Programming', 'Sorting', 'Searching', 'Hash Maps', 'Stacks & Queues', 'Recursion', 'Greedy', 'Bit Manipulation', 'Math'];

interface GeneratedProblem {
  title: string;
  description: string;
  examples: { input: string; output: string; explanation?: string }[];
  constraints: string[];
  starterCode: string;
  difficulty: string;
  topic: string;
}

const ProblemGenerator = () => {
  const navigate = useNavigate();
  const { authUser } = useUser();
  const [activeTab, setActiveTab] = useState<'generate' | 'library'>('generate');
  const [difficulty, setDifficulty] = useState<typeof DIFFICULTIES[number]>('medium');
  const [topic, setTopic] = useState('Arrays');
  const [problem, setProblem] = useState<GeneratedProblem | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedProblems, setSavedProblems] = useState<any[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

  useEffect(() => {
    if (authUser && activeTab === 'library') {
      fetchLibrary();
    }
  }, [authUser, activeTab]);

  const fetchLibrary = async () => {
    if (!authUser) return;
    setIsLoadingLibrary(true);
    try {
      const { data, error } = await supabase
        .from('problems')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('topic', 'AI Generated') // Filter for problems generated here
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setSavedProblems(data || []);
    } catch (err) {
      console.error('Library fetch error:', err);
    }
    setIsLoadingLibrary(false);
  };

  const deleteFromLibrary = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { error } = await supabase.from('problems').delete().eq('id', id);
      if (error) throw error;
      setSavedProblems(prev => prev.filter(p => p.id !== id));
      toast.success('Problem removed from library');
    } catch (err) {
      toast.error('Failed to delete problem');
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setProblem(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-problem', {
        body: { difficulty, topic },
      });
      if (error) {
        let msg = error.message;
        try { msg = (await (error as any).context?.json())?.error || msg; } catch { /* keep default */ }
        throw new Error(msg);
      }
      if (data?.problem) setProblem(data.problem);
      else throw new Error('No problem generated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate problem');
    }
    setIsGenerating(false);
  };

  const handleSaveAndPractice = async () => {
    if (!problem || !authUser) return;
    setIsSaving(true);
    try {
      const code = problem.starterCode || `public class Solution {\n    public void solve() {\n        // Your code here\n    }\n}`;
      
      // 1. Create the base problem record with 'AI Generated' topic for filtering
      const { data: newProblem, error: saveError } = await supabase
        .from('problems')
        .insert({ 
          user_id: authUser.id, 
          title: problem.title, 
          code: code,
          topic: 'AI Generated',
          difficulty: problem.difficulty
        })
        .select()
        .single();

      if (saveError) throw saveError;
      
      // 2. Prepare test cases keyed by the real method parameters
      const sig = parseStarterSignature(code);
      const paramNames = sig?.params.map(p => p.name) ?? [];
      const testCases = examplesToTestCases(problem.examples || [], paramNames);
      const { error: detailError } = await supabase
        .from('problem_test_cases')
        .insert({
          problem_key: newProblem.id,
          description: problem.description,
          examples: problem.examples,
          starter_code: code,
          test_cases: testCases,
          function_name: sig?.functionName || 'solve',
          return_type: sig?.returnType || 'void',
          params: sig?.params || [],
          constraints: problem.constraints,
          difficulty: problem.difficulty,
          topic: problem.topic
        });

      if (detailError) console.error('Error saving problem details:', detailError);

      toast.success('Problem saved to library!');
      
      // 3. Navigate to workspace
      const params = new URLSearchParams({
        title: problem.title,
        difficulty: problem.difficulty,
        generatorMode: 'true',
        genId: newProblem.id
      });
      
      setTimeout(() => navigate(`/problem/${newProblem.id}?${params.toString()}`), 500);
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error('Failed to save problem: ' + err.message);
    }
    setIsSaving(false);
  };

  const difficultyColor = (d: string) => d === 'easy' ? 'text-success border-success/30' : d === 'medium' ? 'text-warning border-warning/30' : 'text-destructive border-destructive/30';

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center gap-1 sm:gap-3 border-b border-panel-border bg-ide-toolbar px-3 sm:px-4 py-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate('/modules')} className="h-7 gap-1.5 text-xs font-medium rounded-lg">
          <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Back</span>
        </Button>
        <div className="h-4 w-px bg-border shrink-0" />
        <Wand2 className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-bold truncate">Problem Generator</span>
      </div>

      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Controls sidebar */}
        <div className="w-full lg:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-panel-border flex flex-col bg-ide-sidebar max-h-[350px] lg:max-h-none">
          <div className="flex border-b border-panel-border">
            <button 
              onClick={() => setActiveTab('generate')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors ${activeTab === 'generate' ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <Wand2 className="h-3.5 w-3.5" /> Generate
            </button>
            <button 
              onClick={() => setActiveTab('library')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-colors ${activeTab === 'library' ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <Library className="h-3.5 w-3.5" /> Library
            </button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4">
              {activeTab === 'generate' ? (
                <>
                  <h3 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Difficulty</h3>
                  <div className="flex gap-2 mb-6">
                    {DIFFICULTIES.map(d => (
                      <Button
                        key={d}
                        variant={difficulty === d ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDifficulty(d)}
                        className={`flex-1 text-xs capitalize h-8 ${difficulty !== d ? difficultyColor(d) : ''}`}
                      >
                        {d}
                      </Button>
                    ))}
                  </div>

                  <h3 className="mb-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Topic</h3>
                  <div className="flex flex-wrap gap-1.5 mb-8">
                    {TOPICS.map(t => (
                      <Badge
                        key={t}
                        variant={topic === t ? 'default' : 'outline'}
                        className={`cursor-pointer text-[10px] py-1 px-2.5 ${topic === t ? '' : 'hover:bg-muted'}`}
                        onClick={() => setTopic(t)}
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>

                  <Button onClick={handleGenerate} disabled={isGenerating} className="w-full gap-2 shadow-lg shadow-primary/20">
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isGenerating ? 'Generating...' : 'Generate Problem'}
                  </Button>

                  <div className="mt-8 rounded-xl border border-dashed border-panel-border p-4 text-center">
                    <BookOpen className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Generated problems are optimized for Java Method logic and include hidden test cases.
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Your Challenges</h3>
                    <Badge variant="secondary" className="text-[9px]">{savedProblems.length}</Badge>
                  </div>

                  {isLoadingLibrary ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground">Loading library...</p>
                    </div>
                  ) : savedProblems.length === 0 ? (
                    <div className="text-center py-10 border border-dashed border-panel-border rounded-xl bg-card/30">
                      <History className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-xs font-medium text-foreground">No saved problems</p>
                      <p className="text-[10px] text-muted-foreground mt-1 px-4">Generate and save a problem to see it here.</p>
                      <Button variant="link" size="sm" onClick={() => setActiveTab('generate')} className="text-[10px] mt-2">Go Generate</Button>
                    </div>
                  ) : (
                    savedProblems.map((p) => (
                      <div 
                        key={p.id}
                        onClick={() => navigate(`/problem/${p.id}?generatorMode=true&genId=${p.id}&title=${encodeURIComponent(p.title)}&difficulty=${p.difficulty}`)}
                        className="group relative rounded-xl border border-panel-border bg-card/50 p-3 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <h4 className="text-xs font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">{p.title}</h4>
                          <button 
                            onClick={(e) => deleteFromLibrary(p.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[9px] h-4 px-1 ${difficultyColor(p.difficulty || 'medium')}`}>
                            {p.difficulty || 'Medium'}
                          </Badge>
                          <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(p.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <ChevronRight className="absolute bottom-3 right-3 h-3 w-3 text-muted-foreground/20 group-hover:text-primary/40" />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Problem display */}
        <ScrollArea className="flex-1">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
            {!problem && !isGenerating && (
              <div className="flex flex-col items-center justify-center gap-4 py-20">
                <Wand2 className="h-16 w-16 text-muted-foreground/20" />
                <h2 className="text-xl font-bold">AI Problem Generator</h2>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Select a difficulty and topic, then click Generate to create a unique practice problem.
                </p>
              </div>
            )}

            {isGenerating && !problem && (
              <div className="flex items-center justify-center gap-3 py-20">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Generating {difficulty} {topic} problem...</span>
              </div>
            )}

            {problem && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-xl font-bold text-foreground">{problem.title}</h1>
                    <div className="mt-1 flex gap-2">
                      <Badge variant="outline" className={`text-xs capitalize ${difficultyColor(problem.difficulty)}`}>
                        {problem.difficulty}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">{problem.topic}</Badge>
                    </div>
                  </div>
                  <Button onClick={handleSaveAndPractice} disabled={isSaving} className="gap-1.5">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save & Practice
                  </Button>
                </div>

                <Card>
                  <CardHeader><CardTitle className="text-sm">Description</CardTitle></CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none text-foreground [&_code]:bg-secondary [&_code]:px-1 [&_code]:rounded">
                      <ReactMarkdown>{problem.description}</ReactMarkdown>
                    </div>
                  </CardContent>
                </Card>

                {problem.examples.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Examples</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {problem.examples.map((ex, i) => (
                        <div key={i} className="rounded-md border border-panel-border bg-secondary/50 p-3 font-mono text-xs space-y-1">
                          <div><span className="text-muted-foreground">Input: </span>{ex.input}</div>
                          <div><span className="text-muted-foreground">Output: </span>{ex.output}</div>
                          {ex.explanation && <div className="text-muted-foreground mt-1">{ex.explanation}</div>}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {problem.constraints.length > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Constraints</CardTitle></CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-4 space-y-1 text-xs text-foreground">
                        {problem.constraints.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {problem.starterCode && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Starter Code</CardTitle></CardHeader>
                    <CardContent>
                      <pre className="overflow-x-auto rounded-md bg-secondary p-3 font-mono text-xs">{problem.starterCode}</pre>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default ProblemGenerator;
