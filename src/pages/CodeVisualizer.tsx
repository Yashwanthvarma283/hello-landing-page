import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight, Loader2,
  Eye, Terminal, Layers, Boxes, RotateCcw, AlertTriangle, Code2, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import AppShell from '@/components/AppShell';
import CodeEditor from '@/components/CodeEditor';
import { supabase } from '@/integrations/supabase/client';
import {
  DEFAULT_VISUALIZER_CODE, readStagedVisualizerCode,
} from '@/lib/visualizer';

interface Frame { name: string; locals: Record<string, string> }
interface HeapObject { id: string; type: string; value: string }
interface TraceStep {
  line: number;
  event?: string;
  frames?: Frame[];
  heap?: HeapObject[];
  stdout?: string;
  note?: string;
  error?: string;
}

const SPEEDS = [
  { label: '0.5x', value: '1600' },
  { label: '1x', value: '900' },
  { label: '2x', value: '450' },
  { label: '4x', value: '220' },
];

const CodeVisualizer = () => {
  const navigate = useNavigate();
  const staged = useMemo(() => readStagedVisualizerCode(), []);
  const [code, setCode] = useState(staged?.code?.trim() ? staged.code : DEFAULT_VISUALIZER_CODE);
  const [title, setTitle] = useState(staged?.title || '');
  const [stdin, setStdin] = useState(staged?.stdin || '');
  const [showEditor, setShowEditor] = useState(false);

  const [steps, setSteps] = useState<TraceStep[]>([]);
  const [summary, setSummary] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState('900');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const codeLines = useMemo(() => code.split('\n'), [code]);
  const current = steps[index];
  const total = steps.length;

  const stop = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setIsPlaying(false);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  // Playback loop
  useEffect(() => {
    if (!isPlaying || total === 0) return;
    if (index >= total - 1) { setIsPlaying(false); return; }
    timerRef.current = setTimeout(() => setIndex(i => Math.min(i + 1, total - 1)), Number(speed));
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isPlaying, index, total, speed]);

  // Keep the executing line in view
  useEffect(() => {
    if (!current) return;
    lineRefs.current[current.line]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [current]);

  // Keyboard controls (Python Tutor style)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && /INPUT|TEXTAREA/.test(el.tagName)) return;
      if (e.key === 'ArrowRight') { stop(); setIndex(i => Math.min(i + 1, Math.max(total - 1, 0))); }
      else if (e.key === 'ArrowLeft') { stop(); setIndex(i => Math.max(i - 1, 0)); }
      else if (e.key === ' ') { e.preventDefault(); setIsPlaying(p => !p); }
      else if (e.key === 'Home') { stop(); setIndex(0); }
      else if (e.key === 'End') { stop(); setIndex(Math.max(total - 1, 0)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, stop]);

  const runTrace = async () => {
    stop();
    setIsLoading(true);
    setError('');
    setSteps([]);
    setSummary('');
    setTruncated(false);
    setIndex(0);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('visualize-trace', {
        body: { code, stdin },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      if (data?.compileError) {
        setError(data.compileError);
      } else if (!data?.steps?.length) {
        setError('No steps could be produced for this code.');
      } else {
        setSteps(data.steps as TraceStep[]);
        setSummary(data.summary || '');
        setTruncated(!!data.truncated);
        setShowEditor(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to visualize code');
    }
    setIsLoading(false);
  };

  const frames = current?.frames?.length ? current.frames : [];
  const heap = current?.heap?.length ? current.heap : [];

  return (
    <AppShell
      title="Code Visualizer"
      subtitle={title ? `Step through: ${title}` : 'Step through Java execution, line by line'}
    >
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 pb-24 md:pb-10 pt-2 space-y-3 animate-in-up">
        {/* Top bar */}
        <div className="surface rounded-xl p-3 flex flex-wrap items-center gap-2">
          <Button onClick={runTrace} disabled={isLoading || !code.trim()} size="sm" className="h-8 gap-1.5 text-xs font-semibold">
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
            {steps.length ? 'Re-visualize' : 'Visualize execution'}
          </Button>
          <Button onClick={() => setShowEditor(v => !v)} size="sm" variant="outline" className="h-8 gap-1.5 text-xs">
            <Code2 className="h-3.5 w-3.5" /> {showEditor ? 'Hide editor' : 'Edit code'}
          </Button>
          <Button onClick={() => navigate('/playground')} size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-muted-foreground">
            <Terminal className="h-3.5 w-3.5" /> Open in playground
          </Button>
          <div className="ml-auto text-[11px] text-muted-foreground hidden sm:block">
            ← / → step · Space play/pause · Home / End jump
          </div>
        </div>

        {showEditor && (
          <div className="surface rounded-xl overflow-hidden">
            <div className="h-[320px]">
              <CodeEditor code={code} onChange={(v) => setCode(v || '')} />
            </div>
            <div className="border-t border-border p-3 space-y-1.5">
              <div className="text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">Standard input (optional)</div>
              <Textarea value={stdin} onChange={(e) => setStdin(e.target.value)} rows={2} placeholder="Input consumed by Scanner / BufferedReader" className="text-xs font-mono" />
            </div>
          </div>
        )}

        {error && (
          <div className="surface rounded-xl p-3 flex items-start gap-2 text-[13px] text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span className="whitespace-pre-wrap break-words">{error}</span>
          </div>
        )}

        {summary && (
          <div className="surface rounded-xl p-3 flex items-start gap-2 text-[13px] text-muted-foreground">
            <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-foreground" />
            <span>{summary}</span>
          </div>
        )}

        {/* Player controls */}
        {total > 0 && (
          <div className="surface-elevated rounded-xl p-3 space-y-3 sticky top-16 z-10">
            <div className="flex flex-wrap items-center gap-1.5">
              <Button variant="outline" size="icon" className="h-8 w-8" title="First step" onClick={() => { stop(); setIndex(0); }} disabled={index === 0}>
                <SkipBack className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" title="Back 1 step" onClick={() => { stop(); setIndex(i => Math.max(i - 1, 0)); }} disabled={index === 0}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" className="h-8 w-8" title={isPlaying ? 'Stop' : 'Play'} onClick={() => (isPlaying ? stop() : setIsPlaying(true))}>
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" title="Forward 1 step" onClick={() => { stop(); setIndex(i => Math.min(i + 1, total - 1)); }} disabled={index >= total - 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" title="Last step" onClick={() => { stop(); setIndex(total - 1); }} disabled={index >= total - 1}>
                <SkipForward className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Reset" onClick={() => { stop(); setIndex(0); }}>
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>

              <span className="text-xs font-mono tabular-nums text-muted-foreground ml-1">
                Step {index + 1} / {total}
              </span>

              <div className="ml-auto flex items-center gap-2">
                <Select value={speed} onValueChange={(v) => setSpeed(v)}>
                  <SelectTrigger className="h-8 w-[88px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPEEDS.map(s => <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={String(index)} onValueChange={(v) => { stop(); setIndex(Number(v)); }}>
                  <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {steps.map((s, i) => (
                      <SelectItem key={i} value={String(i)} className="text-xs">
                        {i + 1}. line {s.line}{s.note ? ` — ${s.note.slice(0, 40)}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Slider
              value={[index]}
              min={0}
              max={Math.max(total - 1, 0)}
              step={1}
              onValueChange={([v]) => { stop(); setIndex(v); }}
            />

            {current?.note && (
              <div className="text-[13px] leading-relaxed">
                <Badge variant="secondary" className="mr-2 text-[10px] uppercase">{current.event || 'step'}</Badge>
                {current.note}
              </div>
            )}
            {truncated && (
              <div className="text-[11px] text-warning">Trace truncated — the program runs longer than the step limit.</div>
            )}
          </div>
        )}

        {/* Main panes */}
        <div className="grid gap-3 lg:grid-cols-[1.15fr,1fr]">
          {/* Code with execution pointer */}
          <div className="surface rounded-xl overflow-hidden min-w-0">
            <div className="px-3 py-2 border-b border-border text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
              Java code
            </div>
            <ScrollArea className="h-[420px]">
              <div className="py-2 font-mono text-[12px] leading-[1.6]">
                {codeLines.map((line, i) => {
                  const n = i + 1;
                  const isCurrent = current?.line === n;
                  return (
                    <div
                      key={n}
                      ref={(el) => { lineRefs.current[n] = el; }}
                      className={`flex items-start gap-2 px-3 ${isCurrent ? 'bg-foreground/10 border-l-2 border-foreground' : 'border-l-2 border-transparent'}`}
                    >
                      <span className="w-8 shrink-0 text-right text-muted-foreground/60 tabular-nums select-none">{n}</span>
                      <span className="w-4 shrink-0 text-foreground">{isCurrent ? '▶' : ''}</span>
                      <pre className="whitespace-pre-wrap break-words flex-1 m-0 bg-transparent p-0">{line || ' '}</pre>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Frames / heap / output */}
          <div className="space-y-3 min-w-0">
            <div className="surface rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-border flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
                <Layers className="h-3 w-3" /> Frames
              </div>
              <ScrollArea className="max-h-[210px]">
                <div className="p-3 space-y-2">
                  {frames.length === 0 && (
                    <div className="text-[12px] text-muted-foreground">No frames yet — press “Visualize execution”.</div>
                  )}
                  {frames.map((f, i) => (
                    <div key={`${f.name}-${i}`} className={`rounded-lg border p-2 ${i === frames.length - 1 ? 'border-foreground/40 bg-secondary/40' : 'border-border'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] font-semibold">{f.name}</span>
                        {i === frames.length - 1 && <Badge className="text-[9px] h-4 px-1.5">current</Badge>}
                      </div>
                      <div className="space-y-1">
                        {Object.entries(f.locals || {}).map(([k, v]) => (
                          <div key={k} className="flex items-center gap-2 text-[11px] font-mono">
                            <span className="min-w-[70px] text-right text-muted-foreground">{k}</span>
                            <span className="text-muted-foreground/60">=</span>
                            <span className="rounded bg-secondary px-1.5 py-0.5 break-all">{v}</span>
                          </div>
                        ))}
                        {Object.keys(f.locals || {}).length === 0 && (
                          <div className="text-[11px] text-muted-foreground">no locals</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="surface rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-border flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
                <Boxes className="h-3 w-3" /> Objects on the heap
              </div>
              <ScrollArea className="max-h-[190px]">
                <div className="p-3 space-y-2">
                  {heap.length === 0 && <div className="text-[12px] text-muted-foreground">No objects allocated.</div>}
                  {heap.map((o) => (
                    <div key={o.id} className="rounded-lg border border-border p-2">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-mono font-semibold">{o.id}</span>
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{o.type}</Badge>
                      </div>
                      <div className="font-mono text-[11px] break-all">{o.value}</div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="surface rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-border flex items-center gap-1.5 text-[11px] uppercase tracking-[0.08em] font-semibold text-muted-foreground">
                <Terminal className="h-3 w-3" /> Program output
              </div>
              <ScrollArea className="max-h-[170px]">
                <pre className="p-3 font-mono text-[11.5px] whitespace-pre-wrap break-words m-0 bg-transparent">
                  {current?.stdout || (total ? '(nothing printed yet)' : '')}
                  {current?.error ? `\n${current.error}` : ''}
                </pre>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default CodeVisualizer;
