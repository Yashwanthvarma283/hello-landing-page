import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Users, Send, Play, CheckCircle2, MessageSquare, 
  LogOut, Loader2, Sparkles, Trophy, Crown, UserX, RefreshCw, X, Shuffle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/user-context';
import AppShell from '@/components/AppShell';
import CodeEditor from '@/components/CodeEditor';
import ReactMarkdown from 'react-markdown';
import { getProblemDetail } from '@/lib/striver-problem-details';
import { STRIVER_ROADMAP } from '@/lib/striver-roadmap-data';
import { NEETCODE_ROADMAP } from '@/lib/neetcode-roadmap-data';
import { LEETCODE_TOP150_ROADMAP } from '@/lib/leetcode-top150-data';

const ALL_ROADMAPS = [...STRIVER_ROADMAP, ...NEETCODE_ROADMAP, ...LEETCODE_TOP150_ROADMAP];
const ALL_PROBLEMS = ALL_ROADMAPS.flatMap(t => t.problems.map(p => ({ ...p, topic: t.name })));

export default function Lobby() {
  const { code: roomCode } = useParams();
  const navigate = useNavigate();
  const { authUser } = useUser();

  const [lobby, setLobby] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<any>(null);
  const [code, setCode] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [myStatus, setMyStatus] = useState<'active' | 'left' | 'not_joined'>('not_joined');
  const [aiFeedback, setAiFeedback] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  const channelRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fetchParticipants = useCallback(async (lobbyId: string) => {
    const { data } = await supabase
      .from('lobby_participants')
      .select('*, profile:user_id(username)')
      .eq('lobby_id', lobbyId)
      .order('joined_at', { ascending: true });
    setParticipants(data || []);
    return data || [];
  }, []);

  const fetchLobby = useCallback(async () => {
    const { data, error } = await supabase
      .from('interview_lobbies')
      .select('*, host:host_id(username)')
      .eq('code', roomCode)
      .single();

    if (error || !data) {
      toast.error('Lobby not found or has been closed');
      navigate('/interview');
      return;
    }

    if (data.closed_at) {
      toast.info('This lobby has been closed by the host');
      navigate('/interview');
      return;
    }

    setLobby(data);
    setIsHost(data.host_id === authUser?.id);
    setCode(data.current_code || '');

    if (data.problem_key) {
      const p = ALL_PROBLEMS.find(p => p.key === data.problem_key);
      if (p) {
        const detail = getProblemDetail(p.key, p.title, p.difficulty);
        setProblem({ ...p, detail });

        // If in coding/review phase, enhance description in background
        if (data.status !== 'waiting') {
          (async () => {
            try {
              const { data: dbData } = await supabase
                .from('problem_test_cases')
                .select('*')
                .eq('problem_key', p.key)
                .maybeSingle();

              if (dbData?.description) {
                setProblem((prev: any) => {
                  if (prev?.key !== p.key) return prev;
                  if (dbData.starter_code) setCode(dbData.starter_code);
                  return {
                    ...prev,
                    detail: { ...prev.detail, description: dbData.description }
                  };
                });
              } else {
                const { data: edgeData } = await supabase.functions.invoke('generate-problem-detail', {
                  body: { problem_key: p.key, title: p.title },
                });
                if (edgeData?.detail?.description) {
                  setProblem((prev: any) => {
                    if (prev?.key !== p.key) return prev;
                    if (edgeData.detail.starterCode) setCode(edgeData.detail.starterCode);
                    return {
                      ...prev,
                      detail: { ...prev.detail, description: edgeData.detail.description }
                    };
                  });
                }
              }
            } catch (e) {
              console.error("Lobby join enhancement failed:", e);
            }
          })();
        }
      }
    }

    // Determine my participation status
    const parts = await fetchParticipants(data.id);
    const me = parts.find((p: any) => p.user_id === authUser?.id);
    if (me) {
      setMyStatus(me.status === 'active' ? 'active' : 'left');
    } else if (data.host_id === authUser?.id) {
      // Host auto-joins
      await joinAsParticipant(data, true);
      setMyStatus('active');
    } else {
      setMyStatus('not_joined');
    }

    // Fetch initial messages
    const { data: msgs } = await supabase
      .from('lobby_messages')
      .select('*')
      .eq('lobby_id', data.id)
      .order('created_at', { ascending: true });
    setMessages(msgs || []);

    // Subscribe to real-time — broadcast is instant, postgres_changes is fallback
    const channel = supabase.channel(`lobby:${data.id}`, {
      config: { broadcast: { self: false } }
    })
      // ── Broadcast (instant, no DB round-trip needed) ─────────────
      .on('broadcast', { event: 'lobby-state-change' }, ({ payload }) => {
        const isPlaceholder = (c: string) => !c || c.trim().length < 50 || c.includes('// 🤖 AI is generating') || c.includes('public void solve()');
        setLobby((prev: any) => ({ ...prev, ...payload }));
        if (payload.problem_key) {
          const p = ALL_PROBLEMS.find(p => p.key === payload.problem_key);
          if (p) {
            const detail = getProblemDetail(p.key, p.title, p.difficulty);
            if (payload.enhanced_description) {
              detail.description = payload.enhanced_description;
            }
            setProblem({ ...p, detail });
          }
        }
        if (payload.current_code !== undefined && isPlaceholder(code)) {
          setCode(payload.current_code);
        }
      })
      .on('broadcast', { event: 'lobby-closed' }, () => {
        toast.info('The host has closed this lobby');
        navigate('/interview');
      })
      .on('broadcast', { event: 'participant-update' }, () => {
        fetchParticipants(data.id);
      })
      .on('broadcast', { event: 'code-sync' }, ({ payload }) => {
        if (payload.senderId !== authUser?.id) setCode(payload.code);
      })
      .on('broadcast', { event: 'chat-message' }, ({ payload }) => {
        setMessages(prev => prev.some(m => m.id === payload.id) ? prev : [...prev, payload]);
      })
      // ── Postgres Changes (fallback for page refresh / late joiners) ─
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'interview_lobbies',
        filter: `id=eq.${data.id}`
      }, ({ new: row }) => {
        if (row.closed_at) { toast.info('This lobby was closed'); navigate('/interview'); return; }
        setLobby((prev: any) => ({ ...prev, ...row }));
        if (row.problem_key) {
          const p = ALL_PROBLEMS.find(p => p.key === row.problem_key);
          if (p) setProblem({ ...p, detail: getProblemDetail(p.key, p.title, p.difficulty) });
        }
        if (row.current_code !== undefined) setCode(row.current_code);
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'lobby_participants',
        filter: `lobby_id=eq.${data.id}`
      }, () => fetchParticipants(data.id))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log('[Lobby] Realtime connected:', data.id);
      });

    channelRef.current = channel;
    setLoading(false);
  }, [roomCode, authUser, navigate, fetchParticipants]);

  useEffect(() => {
    if (!roomCode || !authUser) return;
    fetchLobby();
    return () => { channelRef.current?.unsubscribe(); };
  }, [roomCode, authUser]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const joinAsParticipant = async (lobbyData: any, asHost = false) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', authUser?.id)
      .single();

    await supabase.from('lobby_participants').upsert({
      lobby_id: lobbyData.id,
      user_id: authUser?.id,
      username: profile?.username,
      role: asHost ? 'host' : 'participant',
      status: 'active',
      left_at: null
    }, { onConflict: 'lobby_id,user_id' });
  };

  const handleJoin = async () => {
    if (!lobby || !authUser) return;
    await joinAsParticipant(lobby);
    setMyStatus('active');
    // Broadcast so others see participant list update instantly
    channelRef.current?.send({ type: 'broadcast', event: 'participant-update', payload: {} });
    toast.success('Joined the lobby!');
  };

  const handleLeave = async () => {
    if (!lobby || !authUser) return;
    await supabase.from('lobby_participants')
      .update({ status: 'left', left_at: new Date().toISOString() })
      .eq('lobby_id', lobby.id)
      .eq('user_id', authUser.id);
    // Broadcast so others see participant list update instantly
    channelRef.current?.send({ type: 'broadcast', event: 'participant-update', payload: {} });
    setMyStatus('left');
    toast.info('You left the lobby. Use Rejoin to come back.');
  };

  const handleCloseLobby = async () => {
    if (!lobby || !isHost) return;
    await supabase.from('interview_lobbies')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('id', lobby.id);
    // Broadcast so all participants are redirected instantly
    channelRef.current?.send({ type: 'broadcast', event: 'lobby-closed', payload: {} });
    toast.success('Lobby closed');
    navigate('/interview');
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !lobby || !authUser) return;
    const myParticipant = participants.find(p => p.user_id === authUser.id);
    const senderName = myParticipant?.profile?.username || myParticipant?.username || authUser.email?.split('@')[0] || 'User';
    
    const tempId = `temp-${Date.now()}`;
    const msg = {
      id: tempId,
      lobby_id: lobby.id,
      sender_id: authUser.id,
      sender_name: senderName,
      content: newMessage.trim(),
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, msg]);
    setNewMessage('');

    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event: 'chat-message', payload: msg });
    }
    await supabase.from('lobby_messages').insert({
      lobby_id: lobby.id,
      sender_id: authUser.id,
      content: msg.content
    });
  };

  const handleSyncCode = (newCode: string) => {
    setCode(newCode);
    channelRef.current?.send({
      type: 'broadcast', event: 'code-sync',
      payload: { code: newCode, senderId: authUser?.id }
    });
  };

  const pickRandomProblem = async () => {
    if (!isHost || !lobby) return;
    const picked = ALL_PROBLEMS[Math.floor(Math.random() * ALL_PROBLEMS.length)];
    const detail = getProblemDetail(picked.key, picked.title, picked.difficulty);
    const starterCode = detail.starterCode || '// Write your solution here';
    const update = { problem_key: picked.key, status: 'coding', current_code: starterCode };
    
    // Update local state immediately for host
    setProblem({ ...picked, detail });
    setCode(starterCode);
    setLobby((prev: any) => ({ ...prev, ...update }));

    // Broadcast instantly to all participants
    channelRef.current?.send({
      type: 'broadcast', event: 'lobby-state-change',
      payload: update
    });

    // Persist to DB
    await supabase.from('interview_lobbies').update(update).eq('id', lobby.id);
    toast.success(`Problem set: ${picked.title}`);

    // Background enhancement (non-blocking)
    try {
      const { data: dbData } = await supabase
        .from('problem_test_cases')
        .select('*')
        .eq('problem_key', picked.key)
        .maybeSingle();

      const generated = dbData?.description ? {
        description: dbData.description,
        starterCode: dbData.starter_code
      } : (await supabase.functions.invoke('generate-problem-detail', {
        body: { problem_key: picked.key, title: picked.title },
      }))?.data?.detail;

      if (generated?.description) {
          const enhancedUpdate = {
            problem_key: picked.key,
            current_code: generated.starterCode || starterCode,
            // We can't easily save the whole description in the DB column right now,
            // but we can broadcast it to everyone in the room.
          };

          // Update local state
          setProblem((prev: any) => ({
            ...prev,
            detail: {
              ...prev.detail,
              description: generated.description,
              starterCode: generated.starterCode || prev.detail.starterCode,
            }
          }));
          
          const isPlaceholder = (c: string) => !c || c.trim().length < 50 || c.includes('// 🤖 AI is generating') || c.includes('public void solve()');
          if (generated.starterCode && isPlaceholder(code)) setCode(generated.starterCode);

          // Broadcast enhanced version to everyone
          channelRef.current?.send({
            type: 'broadcast',
            event: 'lobby-state-change',
            payload: {
              ...enhancedUpdate,
              enhanced_description: generated.description // Custom field for broadcast
            }
          });

          // Also update DB with the new starter code if it changed
          if (generated.starterCode) {
            await supabase.from('interview_lobbies').update({ current_code: generated.starterCode }).eq('id', lobby.id);
          }
        }
    } catch (e) {
      console.error("Lobby enhancement failed:", e);
    }
  };

  // Alias for change during coding
  const changeQuestion = pickRandomProblem;
  const handleSubmit = async () => {
    if (analyzing || !lobby) return;
    setAnalyzing(true);
    try {
      const { data } = await supabase.functions.invoke('analyze-complexity', {
        body: { code, mode: 'interview-feedback', problemTitle: problem?.title },
      });
      setAiFeedback(data?.suggestion || data?.bestApproach || 'Analysis complete.');
      await supabase.from('interview_lobbies').update({ status: 'review' }).eq('id', lobby.id);
    } catch {
      toast.error('AI analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground font-mono">Connecting to lobby...</p>
    </div>
  );

  const activeParticipants = participants.filter(p => p.status === 'active');

  return (
    <AppShell title={`Lobby: ${roomCode}`} subtitle="Real-time Collaborative Interview">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-xs gap-1.5 px-3 py-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            {roomCode}
          </Badge>
          <span className="text-xs text-muted-foreground">{activeParticipants.length} active participant{activeParticipants.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          {myStatus === 'active' && !isHost && (
            <Button variant="ghost" size="sm" onClick={handleLeave} className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive">
              <LogOut className="h-3.5 w-3.5" /> Leave
            </Button>
          )}
          {myStatus === 'left' && (
            <Button size="sm" onClick={handleJoin} className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700">
              <RefreshCw className="h-3.5 w-3.5" /> Rejoin
            </Button>
          )}
          {myStatus === 'not_joined' && !isHost && (
            <Button size="sm" onClick={handleJoin} className="h-8 gap-1.5 text-xs">
              <Users className="h-3.5 w-3.5" /> Join Lobby
            </Button>
          )}
          {isHost && (
            <Button variant="destructive" size="sm" onClick={handleCloseLobby} className="h-8 gap-1.5 text-xs">
              <X className="h-3.5 w-3.5" /> Close Lobby
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-14rem)]">
        {/* Left: Participants + Chat */}
        <div className="lg:col-span-3 flex flex-col gap-3 overflow-hidden">
          {/* Participants */}
          <Card className="surface-elevated rounded-2xl shrink-0">
            <CardHeader className="py-3 px-4 border-b border-sidebar-border">
              <CardTitle className="text-xs flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Participants ({activeParticipants.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-1.5 max-h-48 overflow-y-auto">
              {participants.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-2">No participants yet</p>
              ) : participants.map((p: any) => (
                <div key={p.id} className={`flex items-center justify-between px-2 py-1.5 rounded-lg transition-all ${p.status === 'active' ? 'bg-primary/5 border border-primary/10' : 'opacity-40 bg-muted/20'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${p.role === 'host' ? 'bg-primary text-primary-foreground' : 'bg-amber-500 text-white'}`}>
                      {(p.profile?.username || p.username || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold leading-none">{p.profile?.username || p.username || 'Unknown'}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{p.status === 'left' ? 'Left' : p.role}</p>
                    </div>
                  </div>
                  {p.role === 'host' && <Crown className="h-3 w-3 text-primary shrink-0" />}
                  {p.status === 'left' && <UserX className="h-3 w-3 text-muted-foreground shrink-0" />}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Chat */}
          <Card className="surface-elevated rounded-2xl flex-1 flex flex-col overflow-hidden">
            <CardHeader className="py-3 px-4 border-b border-sidebar-border shrink-0">
              <CardTitle className="text-xs flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> Chat
              </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-2">
                {messages.map((m, i) => (
                  <div key={m.id || i} className={`flex flex-col ${m.sender_id === authUser?.id ? 'items-end' : 'items-start'}`}>
                    {m.sender_id !== authUser?.id && (
                      <span className="text-[9px] text-muted-foreground px-1 mb-0.5">{m.sender_name || 'User'}</span>
                    )}
                    <div className={`px-3 py-1.5 rounded-2xl text-xs max-w-[90%] ${m.sender_id === authUser?.id ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-sidebar-accent border border-sidebar-border rounded-tl-none'}`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
            <div className="p-3 border-t border-sidebar-border bg-sidebar-accent/20 shrink-0">
              {myStatus === 'active' ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Message..."
                    className="h-8 text-xs bg-card"
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  />
                  <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleSendMessage}>
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <p className="text-center text-[10px] text-muted-foreground italic py-1">
                  {myStatus === 'left' ? 'Rejoin to chat' : 'Join to participate'}
                </p>
              )}
            </div>
          </Card>
        </div>

        {/* Center: Problem & Editor */}
        <div className="lg:col-span-9 flex flex-col gap-4 overflow-hidden">
          {/* Spectator Banner */}
          {myStatus !== 'active' && (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
              <p className="text-xs text-amber-400 font-semibold">
                {myStatus === 'left' ? '👀 You left this lobby — you\'re viewing in read-only mode' : '👋 Click "Join Lobby" to participate in this session'}
              </p>
              <Button size="sm" onClick={handleJoin} className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-black gap-1">
                <RefreshCw className="h-3 w-3" /> {myStatus === 'left' ? 'Rejoin' : 'Join'}
              </Button>
            </div>
          )}

          {lobby?.status === 'waiting' ? (
            <Card className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6 surface-elevated rounded-3xl border-primary/20">
              <div className="relative">
                <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl animate-pulse" />
                <div className="h-24 w-24 rounded-full bg-sidebar-accent flex items-center justify-center relative border border-primary/30 shadow-2xl">
                  <Play className="h-12 w-12 text-primary animate-pulse" />
                </div>
              </div>
              <div className="max-w-md space-y-4">
                <h2 className="text-2xl font-black tracking-tight">Waiting to start</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {isHost
                    ? `${activeParticipants.length} participant${activeParticipants.length !== 1 ? 's' : ''} in the room. Pick a problem when ready!`
                    : 'Wait for the host to pick a problem. You can chat in the meantime.'}
                </p>
                {isHost && (
                  <Button onClick={pickRandomProblem} className="gap-2 px-8 h-12 text-base font-bold shadow-xl shadow-primary/20">
                    <Sparkles className="h-5 w-5" /> Initialize Problem
                  </Button>
                )}
              </div>
            </Card>
          ) : lobby?.status === 'coding' ? (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[380px,1fr] gap-4 overflow-hidden">
              <Card className="surface-elevated rounded-2xl overflow-auto border-sidebar-border shadow-xl">
                <CardContent className="p-5 space-y-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <Badge className={`text-[10px] ${
                        problem?.difficulty === 'Easy' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                        problem?.difficulty === 'Medium' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                        'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      }`}>{problem?.difficulty}</Badge>
                      <h2 className="text-xl font-black leading-tight tracking-tight text-foreground">{problem?.title}</h2>
                      <Badge variant="outline" className="text-[9px] font-mono opacity-50">{problem?.topic}</Badge>
                    </div>
                    {isHost && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={changeQuestion}
                        className="shrink-0 h-8 px-2 gap-1.5 text-[10px] border-primary/30 text-primary hover:bg-primary/10 shadow-lg shadow-primary/5"
                      >
                        <Shuffle className="h-3 w-3" /> Change
                      </Button>
                    )}
                  </div>

                  <div className="prose prose-sm dark:prose-invert text-[12px] leading-relaxed text-foreground/90 border-t border-sidebar-border pt-4">
                    <ReactMarkdown>{problem?.detail?.description || ''}</ReactMarkdown>
                  </div>

                  {problem?.detail?.examples?.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">Examples</h3>
                      <div className="space-y-3">
                        {problem.detail.examples.map((ex: any, i: number) => (
                          <div key={i} className="rounded-xl border border-sidebar-border bg-sidebar-accent/30 p-3 font-mono text-[10px] space-y-1.5 relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary/40 transition-colors" />
                            <p><span className="text-muted-foreground font-bold">Input:</span> <span className="text-foreground/80">{ex.input}</span></p>
                            <p><span className="text-muted-foreground font-bold">Output:</span> <span className="text-primary font-bold">{ex.output}</span></p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {problem?.detail?.constraints?.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/80">Constraints</h3>
                      <ul className="list-disc list-inside space-y-1">
                        {problem.detail.constraints.map((c: string, i: number) => (
                          <li key={i} className="text-[10px] text-muted-foreground font-mono leading-normal">{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className="surface-elevated rounded-2xl overflow-hidden flex flex-col border-sidebar-border">
                <div className="flex-1">
                  <CodeEditor code={code} onChange={myStatus === 'active' ? handleSyncCode : () => {}} />
                </div>
                <div className="p-3 border-t border-sidebar-border bg-sidebar-accent/20 flex justify-between items-center">
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Real-time Sync · {activeParticipants.length} online
                  </div>
                  <div className="flex items-center gap-2">
                    {isHost && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={changeQuestion}
                        className="h-8 gap-1.5 text-[10px] text-muted-foreground hover:text-primary"
                      >
                        <Shuffle className="h-3 w-3" /> New Question
                      </Button>
                    )}
                    {myStatus === 'active' && (
                      <Button size="sm" onClick={handleSubmit} disabled={analyzing} className="gap-2 h-9">
                        {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Finish Interview
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          ) : (
            <Card className="flex-1 surface-elevated rounded-3xl border-primary/20 p-8 overflow-auto">
              <div className="max-w-2xl mx-auto space-y-8">
                <div className="text-center space-y-2">
                  <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trophy className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-3xl font-black">Interview Completed!</h2>
                  <p className="text-sm text-muted-foreground">Here's the AI feedback for this session.</p>
                </div>
                <div className="p-6 rounded-2xl bg-sidebar-accent/50 border border-sidebar-border space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5" /> Performance Review
                  </h3>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{aiFeedback || 'Analysis will appear here once submitted.'}</ReactMarkdown>
                  </div>
                </div>
                <Button variant="outline" className="w-full h-12" onClick={() => navigate('/interview')}>
                  Back to Simulator
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
