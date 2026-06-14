import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Trophy, Medal, Users, Crown, TrendingUp, Flame, 
  Search, Mail, Calendar, Award, Clock, Loader2, User, ChevronRight,
  TrendingDown, Star, Activity, PieChart, CheckCircle2, History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUser } from '@/lib/user-context';
import { 
  searchUsers, PublicProfile, sendDirectMessage, 
  fetchDirectMessages, fetchUserPublicStats 
} from '@/lib/supabase';
import { supabase } from '@/integrations/supabase/client';
import { fetchStreaksForUsers } from '@/lib/streak';
import AppShell from '@/components/AppShell';
import { STRIVER_ROADMAP } from '@/lib/striver-roadmap-data';
import { NEETCODE_ROADMAP } from '@/lib/neetcode-roadmap-data';
import { LEETCODE_TOP150_ROADMAP } from '@/lib/leetcode-top150-data';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { 
  Dialog, DialogContent, DialogDescription, DialogFooter, 
  DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface PublicCosmetics {
  theme?: { name: string; meta?: any };
  avatar_frame?: { name: string; meta?: any };
  banner?: { name: string; meta?: any };
  name_glow?: { name: string; meta?: any };
  profile_title?: { name: string; meta?: any };
  leaderboard_glow?: { name: string; meta?: any };
  [k: string]: any;
}

interface DetailedStats {
  difficulty: { Easy: number, Medium: number, Hard: number },
  topics: Record<string, number>,
  totalSolved: number,
  totalAttempted: number,
  recentSolved: any[]
}

export default function Leaderboard() {
  const navigate = useNavigate();
  const { authUser } = useUser();
  const [entries, setEntries] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<PublicProfile | null>(null);
  
  // Message Dialog
  const [messageOpen, setMessageOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  // LeetCode-style stats
  const [selectedUserStats, setSelectedUserStats] = useState<DetailedStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const ALL_PROBLEMS = useMemo(() => {
    const roadmaps = [...STRIVER_ROADMAP, ...NEETCODE_ROADMAP, ...LEETCODE_TOP150_ROADMAP];
    const map = new Map<string, { title: string, difficulty: string, topic: string }>();
    roadmaps.forEach(t => {
      t.problems.forEach(p => {
        map.set(p.key, { title: p.title, difficulty: p.difficulty, topic: t.name });
      });
    });
    return map;
  }, []);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadSelectedUserStats(selectedUser.user_id);
    } else {
      setSelectedUserStats(null);
    }
  }, [selectedUser]);

  const loadSelectedUserStats = async (userId: string) => {
    setStatsLoading(true);
    try {
      const progress = await fetchUserPublicStats(userId);
      const solved = progress.filter(p => p.solved);
      
      const difficulty = { Easy: 0, Medium: 0, Hard: 0 };
      const topics: Record<string, number> = {};
      const recent: any[] = [];
      
      solved.forEach(p => {
        const details = ALL_PROBLEMS.get(p.problem_key);
        if (details) {
          const d = (details.difficulty as 'Easy' | 'Medium' | 'Hard') || 'Medium';
          difficulty[d]++;
          topics[details.topic] = (topics[details.topic] || 0) + 1;
          recent.push({
            key: p.problem_key,
            title: details.title,
            difficulty: details.difficulty,
            date: p.last_attempted
          });
        }
      });

      // Sort recent by date
      recent.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setSelectedUserStats({
        difficulty,
        topics,
        totalSolved: solved.length,
        totalAttempted: progress.length,
        recentSolved: recent.slice(0, 5)
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to load user stats");
    } finally {
      setStatsLoading(false);
    }
  };

  const loadLeaderboard = async (query = '') => {
    setLoading(true);
    try {
      const results = await searchUsers(query);
      setEntries(results);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (val: string) => {
    setSearchQuery(val);
    loadLeaderboard(val);
  };

  const handleSendMessage = async () => {
    if (!selectedUser || !content.trim() || !authUser) return;
    setSending(true);
    try {
      await sendDirectMessage(authUser.id, selectedUser.user_id, subject || "No Subject", content);
      toast.success(`Message sent to ${selectedUser.username}`);
      setMessageOpen(false);
      setSubject('');
      setContent('');
    } catch (error) {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const getRankBadge = (idx: number) => {
    if (idx === 0) return <Crown className="h-5 w-5 text-yellow-500 animate-bounce" />;
    if (idx === 1) return <Medal className="h-5 w-5 text-gray-400" />;
    if (idx === 2) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="text-xs font-mono text-muted-foreground w-5 text-center">#{idx + 1}</span>;
  };

  const maxSolved = useMemo(() => Math.max(...entries.map(e => e.solved_count), 1), [entries]);

  return (
    <AppShell title="Leaderboard" subtitle="See how you rank against the community">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-12rem)]">
        
        {/* Main Leaderboard List */}
        <div className="lg:col-span-7 flex flex-col gap-4 overflow-hidden">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input 
              placeholder="Search users by name or ID..."
              className="pl-10 bg-card/50 border-sidebar-border focus:ring-1 focus:ring-primary/20"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          <Card className="flex-1 overflow-hidden border-sidebar-border bg-card/50 flex flex-col">
            <CardHeader className="py-4 px-6 border-b border-sidebar-border bg-sidebar-accent/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  Community Rankings
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {entries.length} Users
                </Badge>
              </div>
            </CardHeader>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground animate-pulse">Calculating rankings...</p>
                  </div>
                ) : entries.length === 0 ? (
                  <div className="text-center py-20">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground/20 mb-3" />
                    <p className="text-sm text-muted-foreground font-medium">No users found</p>
                  </div>
                ) : (
                  entries.map((user, idx) => (
                    <button
                      key={user.user_id}
                      onClick={() => setSelectedUser(user)}
                      className={`w-full text-left p-3 rounded-xl transition-all duration-200 flex items-center gap-4 group ${selectedUser?.user_id === user.user_id ? 'bg-primary/10 shadow-sm ring-1 ring-primary/20' : 'hover:bg-sidebar-accent/50'}`}
                    >
                      <div className="flex items-center justify-center shrink-0">
                        {getRankBadge(idx)}
                      </div>
                      
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold border border-primary/10 shadow-inner">
                        {user.username[0].toUpperCase()}
                      </div>

                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm truncate">{user.username}</span>
                          {idx === 0 && <Badge className="h-4 px-1 text-[8px] bg-yellow-500/20 text-yellow-500 border-yellow-500/30">TOP</Badge>}
                          {user.user_id === authUser?.id && <Badge className="h-4 px-1 text-[8px] bg-primary/20 text-primary border-primary/30">YOU</Badge>}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-2">
                          <span>ID: {user.display_id}</span>
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/30"></span>
                          <span>Joined {new Date(user.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-foreground">{user.solved_count}</div>
                        <div className="text-[8px] uppercase font-bold text-muted-foreground tracking-tighter">Solved</div>
                        <Progress value={(user.solved_count / maxSolved) * 100} className="w-12 h-1 mt-1 bg-primary/10" />
                      </div>
                      
                      <ChevronRight className={`h-4 w-4 text-muted-foreground/30 transition-transform group-hover:translate-x-0.5 ${selectedUser?.user_id === user.user_id ? 'translate-x-0.5 text-primary/50' : ''}`} />
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Details Panel */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <Card className="flex-1 overflow-hidden border-sidebar-border bg-card/50 flex flex-col shadow-xl shadow-primary/5 relative">
            {selectedUser ? (
              <>
                {/* Profile Header */}
                <div className="h-32 bg-gradient-to-br from-primary/10 via-background to-transparent border-b border-sidebar-border relative overflow-hidden shrink-0">
                  <div className="absolute top-0 right-0 p-4">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10" onClick={() => setMessageOpen(true)}>
                      <Mail className="h-4 w-4 text-primary" />
                    </Button>
                  </div>
                  <div className="absolute -bottom-8 left-6 flex items-end gap-5">
                    <div className="h-20 w-20 rounded-2xl bg-card border-4 border-background shadow-2xl flex items-center justify-center text-3xl font-black text-primary animate-in zoom-in-50 duration-300">
                      {selectedUser.username[0].toUpperCase()}
                    </div>
                    <div className="pb-4 space-y-1 text-left">
                      <h2 className="text-xl font-black tracking-tight leading-none">{selectedUser.username}</h2>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="w-fit text-[9px] font-mono border-primary/20 text-primary px-1.5 py-0">ID: {selectedUser.display_id}</Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 leading-none">
                          <Clock className="h-3 w-3" /> Active {selectedUser.last_active ? formatDistanceToNow(new Date(selectedUser.last_active)) + ' ago' : 'Never'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Profile Content */}
                <ScrollArea className="flex-1 mt-10">
                  <div className="p-6 pt-2 space-y-8">
                    {!statsLoading && selectedUserStats ? (
                      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        
                        {/* Difficulty Summary */}
                        <div className="grid grid-cols-3 gap-2">
                          {(['Easy', 'Medium', 'Hard'] as const).map(d => {
                            const count = selectedUserStats.difficulty[d];
                            const colors = {
                              Easy: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-500',
                              Medium: 'border-amber-500/20 bg-amber-500/5 text-amber-500',
                              Hard: 'border-rose-500/20 bg-rose-500/5 text-rose-500'
                            };
                            return (
                              <div key={d} className={`p-3 rounded-xl border ${colors[d]} text-center`}>
                                <div className="text-xl font-black">{count}</div>
                                <div className="text-[8px] uppercase font-bold tracking-widest opacity-70">{d}</div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Topics */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <PieChart className="h-3 w-3" /> Topic Proficiency
                            </h3>
                            <Badge variant="secondary" className="text-[9px] font-mono">{Object.keys(selectedUserStats.topics).length} Tags</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(selectedUserStats.topics)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 10)
                              .map(([topic, count]) => (
                                <div key={topic} className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-sidebar-accent/50 border border-sidebar-border/50 text-[10px] font-medium transition-colors hover:bg-sidebar-accent">
                                  <span>{topic}</span>
                                  <span className="text-primary font-bold">{count}</span>
                                </div>
                              ))
                            }
                            {Object.keys(selectedUserStats.topics).length === 0 && (
                              <p className="text-xs text-muted-foreground italic py-4 text-center w-full">No topics completed yet.</p>
                            )}
                          </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="space-y-4">
                          <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <History className="h-3 w-3" /> Recent Solutions
                          </h3>
                          <div className="space-y-2">
                            {selectedUserStats.recentSolved.length > 0 ? (
                              selectedUserStats.recentSolved.map(p => (
                                <div key={p.key} className="flex items-center justify-between p-3 rounded-xl bg-sidebar-accent/20 border border-sidebar-border/30 group hover:border-primary/20 transition-all">
                                  <div className="flex items-center gap-3">
                                    <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold truncate max-w-[150px]">{p.title}</span>
                                      <span className="text-[8px] text-muted-foreground">{formatDistanceToNow(new Date(p.date))} ago</span>
                                    </div>
                                  </div>
                                  <Badge variant="outline" className={`text-[8px] font-bold uppercase px-1.5 ${
                                    p.difficulty === 'Easy' ? 'text-emerald-500 border-emerald-500/20' :
                                    p.difficulty === 'Medium' ? 'text-amber-500 border-amber-500/20' :
                                    'text-rose-500 border-rose-500/20'
                                  }`}>
                                    {p.difficulty}
                                  </Badge>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-8 bg-sidebar-accent/10 rounded-2xl border border-dashed border-sidebar-border">
                                <Activity className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
                                <p className="text-[10px] text-muted-foreground font-medium">No recent activity found</p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Overall Stats */}
                        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-sidebar-border/50">
                          <div className="space-y-1">
                            <div className="text-[9px] font-bold text-muted-foreground uppercase">Accuracy</div>
                            <div className="text-lg font-black">{Math.round((selectedUserStats.totalSolved / (selectedUserStats.totalAttempted || 1)) * 100)}%</div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-[9px] font-bold text-muted-foreground uppercase">Total Solved</div>
                            <div className="text-lg font-black text-primary">{selectedUserStats.totalSolved}</div>
                          </div>
                        </div>

                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-30">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Synchronizing Data</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="p-4 border-t border-sidebar-border bg-sidebar-accent/10 shrink-0">
                  <Button className="w-full gap-2 shadow-lg shadow-primary/10 h-11" onClick={() => setMessageOpen(true)}>
                    <Mail className="h-4 w-4" /> 
                    Contact {selectedUser.username}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
                <div className="relative">
                  <div className="absolute -inset-4 bg-primary/10 rounded-full blur-xl animate-pulse" />
                  <div className="h-20 w-20 rounded-full bg-sidebar-accent flex items-center justify-center relative border border-primary/20 shadow-xl">
                    <User className="h-10 w-10 text-primary/40" />
                  </div>
                </div>
                <div className="max-w-xs space-y-2">
                  <h3 className="text-xl font-black tracking-tight">Select a Developer</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Click on any user in the leaderboard to explore their full coding profile, topic proficiency, and recent solved problems.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Send Message Dialog */}
      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent className="sm:max-w-[425px] border-sidebar-border bg-card shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              Message {selectedUser?.username}
            </DialogTitle>
            <DialogDescription className="text-xs">
              This message will be sent to the user's internal mailbox.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subject" className="text-[10px] uppercase font-bold text-muted-foreground">Subject</Label>
              <Input 
                id="subject"
                placeholder="Message subject..."
                className="bg-sidebar-accent/50 border-sidebar-border"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content" className="text-[10px] uppercase font-bold text-muted-foreground">Message Body</Label>
              <Textarea 
                id="content"
                placeholder="Type your message here..."
                className="min-h-[150px] bg-sidebar-accent/50 border-sidebar-border resize-none"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="bg-sidebar-accent/30 -mx-6 -mb-6 p-6">
            <Button variant="ghost" onClick={() => setMessageOpen(false)} className="text-xs">Cancel</Button>
            <Button disabled={!content.trim() || sending} onClick={handleSendMessage} className="gap-2 shadow-lg shadow-primary/10">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Mail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Send({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>
    </svg>
  );
}
