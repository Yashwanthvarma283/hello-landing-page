import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Loader2, Trash2, Download, Copy, Check, Layers, Square, Github, Terminal, Code2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CodeEditor from '@/components/CodeEditor';
import { executeJavaCode, stopExecution, type ExecutionStatus as ExecStatusType } from '@/lib/executor';
import { useUser } from '@/lib/user-context';
import { getGitHubSettings, pushFileToGitHub } from '@/lib/github';
import { supabase } from '@/integrations/supabase/client';
import { useAutosave } from '@/hooks/use-autosave';

const TEMPLATES: Record<string, string> = {
  'Hello World': `import java.util.*;

public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
  'Array Operations': `import java.util.*;

public class Main {
    public static void main(String[] args) {
        int[] arr = {5, 2, 8, 1, 9, 3};
        Arrays.sort(arr);
        System.out.println("Sorted: " + Arrays.toString(arr));
        System.out.println("Sum: " + Arrays.stream(arr).sum());
        System.out.println("Max: " + Arrays.stream(arr).max().getAsInt());
    }
}`,
  'HashMap Example': `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Map<String, Integer> map = new HashMap<>();
        String[] words = {"apple", "banana", "apple", "cherry", "banana", "apple"};
        
        for (String w : words) {
            map.put(w, map.getOrDefault(w, 0) + 1);
        }
        
        map.forEach((k, v) -> System.out.println(k + ": " + v));
    }
}`,
  'Linked List': `import java.util.*;

public class Main {
    static class ListNode {
        int val;
        ListNode next;
        ListNode(int v) { val = v; }
    }
    
    static ListNode reverse(ListNode head) {
        ListNode prev = null, curr = head;
        while (curr != null) {
            ListNode next = curr.next;
            curr.next = prev;
            prev = curr;
            curr = next;
        }
        return prev;
    }
    
    public static void main(String[] args) {
        ListNode head = new ListNode(1);
        head.next = new ListNode(2);
        head.next.next = new ListNode(3);
        head.next.next.next = new ListNode(4);
        
        ListNode rev = reverse(head);
        while (rev != null) {
            System.out.print(rev.val + " -> ");
            rev = rev.next;
        }
        System.out.println("null");
    }
}`,
  'Binary Search': `import java.util.*;

public class Main {
    static int binarySearch(int[] arr, int target) {
        int lo = 0, hi = arr.length - 1;
        while (lo <= hi) {
            int mid = lo + (hi - lo) / 2;
            if (arr[mid] == target) return mid;
            else if (arr[mid] < target) lo = mid + 1;
            else hi = mid - 1;
        }
        return -1;
    }
    
    public static void main(String[] args) {
        int[] arr = {1, 3, 5, 7, 9, 11, 13};
        System.out.println("Index of 7: " + binarySearch(arr, 7));
        System.out.println("Index of 4: " + binarySearch(arr, 4));
    }
}`,
  'Stack & Queue': `import java.util.*;

public class Main {
    public static void main(String[] args) {
        // Stack usage - check balanced parentheses
        String expr = "({[()]})";
        Stack<Character> stack = new Stack<>();
        boolean valid = true;
        for (char c : expr.toCharArray()) {
            if ("({[".indexOf(c) >= 0) stack.push(c);
            else {
                if (stack.isEmpty()) { valid = false; break; }
                char top = stack.pop();
                if ((c == ')' && top != '(') || (c == '}' && top != '{') || (c == ']' && top != '['))
                    { valid = false; break; }
            }
        }
        valid = valid && stack.isEmpty();
        System.out.println(expr + " is " + (valid ? "valid" : "invalid"));
    }
}`,
};

const CodePlayground = () => {
  const navigate = useNavigate();
  const { authUser, profile } = useUser();
  const [code, setCode] = useState(TEMPLATES['Hello World']);
  const [output, setOutput] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [execTime, setExecTime] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isCodeLoading, setIsCodeLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'editor' | 'output'>('editor');

  // Autosave logic
  const autosaveCode = useCallback(async (val: string) => {
    if (!authUser) return;
    try {
      await supabase.from('user_code_saves').upsert({
        user_id: authUser.id,
        problem_key: 'playground',
        code: val,
        language: 'java',
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'user_id,problem_key' });
    } catch (e) {
      console.error('Playground autosave failed:', e);
    }
  }, [authUser]);

  const { isSaving: isAutoSaving, isDirty: codeIsDirty, resetSavedValue } = useAutosave(code, autosaveCode, {
    delay: 1000,
    maxDelay: 2000,
    enabled: !!authUser && !isCodeLoading,
    key: 'playground',
  });

  // Load saved code on mount
  useEffect(() => {
    if (!authUser) {
      setIsCodeLoading(false);
      return;
    }
    
    const loadSaved = async () => {
      try {
        const { data } = await supabase
          .from('user_code_saves')
          .select('code')
          .eq('user_id', authUser.id)
          .eq('problem_key', 'playground')
          .maybeSingle();
        
        if (data && (data as any).code) {
          setCode((data as any).code);
          resetSavedValue((data as any).code);
        }
      } catch (e) {
        console.error('Failed to load playground code:', e);
      } finally {
        setIsCodeLoading(false);
      }
    };
    
    loadSaved();
  }, [authUser]);

  const handleRun = async () => {
    if (running) return;
    setRunning(true);
    setActiveTab('output');
    setOutput(['▶ Compiling and running...']);
    const start = Date.now();
    try {
      const result = await executeJavaCode(code, () => {});
      const elapsed = Date.now() - start;
      setExecTime(elapsed);
      if (result.success) {
        setOutput(result.output ? result.output.split('\n') : ['(no output)']);
      } else {
        setOutput(result.error ? result.error.split('\n') : ['Execution failed']);
      }
    } catch (err: any) {
      setOutput([err?.message || 'Execution failed']);
    }
    setRunning(false);
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'Main.java'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Copied!');
    setTimeout(() => setCopied(false), 2000);
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
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filePath = `Java Codes/Playground_${timestamp}.java`;
      
      const res = await pushFileToGitHub(
        gh.token, 
        gh.repo, 
        filePath, 
        code, 
        `Playground Save: ${timestamp}`
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

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex items-center gap-1 sm:gap-2 border-b border-panel-border bg-ide-toolbar px-2 sm:px-3 py-1.5 overflow-x-auto scrollbar-none shrink-0">
        <Button variant="ghost" size="sm" onClick={() => navigate('/modules')} className="h-7 gap-1 text-xs shrink-0">
          <ArrowLeft className="h-3 w-3" /> <span className="hidden sm:inline">Back</span>
        </Button>
        <div className="h-4 w-px bg-border shrink-0" />
        <span className="font-bold text-foreground text-sm shrink-0 flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-primary fill-primary/20" />
          <span className="hidden sm:inline">Code Playground</span>
          <span className="sm:hidden">Play</span>
        </span>
        <Badge variant="outline" className="text-[10px] shrink-0 font-black hidden sm:inline-flex">JAVA</Badge>
        
        <div className="flex items-center gap-1 shrink-0 ml-1 sm:ml-2">
          <Select onValueChange={(v) => setCode(TEMPLATES[v] || code)}>
            <SelectTrigger className="h-7 w-[92px] sm:w-36 text-[10px] rounded-lg bg-secondary/50 border-transparent"><SelectValue placeholder="Templates" /></SelectTrigger>
            <SelectContent>
              {Object.keys(TEMPLATES).map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 mr-2">
            {isAutoSaving ? (
              <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-2.5 w-2.5 animate-spin" /> Saving
              </span>
            ) : codeIsDirty ? (
              <span className="text-[9px] text-warning flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-warning" /> Unsaved
              </span>
            ) : (
              <span className="text-[9px] text-emerald-500 flex items-center gap-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Saved
              </span>
            )}
          </div>

          <Button size="sm" variant="ghost" onClick={handleCopy} className="h-7 w-7 p-0 rounded-lg" title="Copy Code">
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </Button>
          
          <Button 
            size="sm" 
            variant="outline" 
            onClick={handleGitHubPush} 
            disabled={isPushing} 
            className="h-7 gap-1.5 text-xs text-primary border-primary/20 hover:bg-primary/10 rounded-lg hidden sm:inline-flex"
          >
            {isPushing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Github className="h-3 w-3" />}
            <span className="hidden md:inline">Sync</span>
          </Button>

          <Button size="sm" onClick={handleRun} disabled={running} className="h-7 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-4 rounded-lg shadow-lg shadow-primary/20 transition-all active:scale-95">
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
            Run
          </Button>
          
          {running && (
            <Button size="sm" variant="destructive" onClick={() => { stopExecution(); setRunning(false); }} className="h-7 w-7 p-0 rounded-lg">
              <Square className="h-3 w-3 fill-current" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-panel-sidebar/20">
        {/* Desktop Layout */}
        <div className="hidden md:flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-hidden border-r border-panel-border">
            <CodeEditor code={code} onChange={setCode} />
          </div>
          <div className="w-[400px] flex flex-col bg-panel-sidebar/40">
            <div className="border-b border-panel-border bg-ide-toolbar/50 px-3 py-1.5 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Terminal className="h-3 w-3" /> Console Output
              </span>
              {output.length > 0 && (
                <Button variant="ghost" size="sm" className="h-5 text-[10px] hover:text-destructive" onClick={() => setOutput([])}>Clear</Button>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 font-mono text-[11px] space-y-1">
                {output.length === 0 ? (
                  <p className="text-muted-foreground/50 italic">Execution output will appear here...</p>
                ) : output.map((line, i) => (
                  <p key={i} className={`${line.startsWith('▶') ? 'text-primary font-bold' : line.toLowerCase().includes('error') ? 'text-destructive' : 'text-foreground/90'}`}>{line}</p>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Mobile Layout (Tabs) */}
        <div className="md:hidden flex-1 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col">
            <div className="flex-1 overflow-hidden">
              <TabsContent value="editor" className="h-full m-0 p-0 overflow-hidden">
                <CodeEditor code={code} onChange={setCode} />
              </TabsContent>
              <TabsContent value="output" className="h-full m-0 p-0 flex flex-col bg-black/20">
                <div className="p-3 border-b border-white/5 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Output</span>
                  <Button variant="ghost" size="sm" className="h-5 text-[10px]" onClick={() => setOutput([])}>Clear</Button>
                </div>
                <ScrollArea className="flex-1">
                  <div className="p-4 font-mono text-[11px] space-y-1">
                    {output.length === 0 ? (
                      <p className="text-muted-foreground/40 italic">Run code to see results</p>
                    ) : output.map((line, i) => (
                      <p key={i} className={`${line.startsWith('▶') ? 'text-primary' : line.toLowerCase().includes('error') ? 'text-destructive' : 'text-foreground'}`}>{line}</p>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </div>
            <TabsList className="h-12 w-full bg-ide-toolbar border-t border-panel-border rounded-none p-1 shrink-0">
              <TabsTrigger value="editor" className="flex-1 gap-2 font-bold text-xs rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all">
                <Code2 className="h-4 w-4" /> Editor
              </TabsTrigger>
              <TabsTrigger value="output" className="flex-1 gap-2 font-bold text-xs rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary transition-all">
                <Terminal className="h-4 w-4" /> Console
                {output.length > 0 && <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default CodePlayground;
