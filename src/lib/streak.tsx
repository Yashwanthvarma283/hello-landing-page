import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/user-context';

export interface StreakData {
  current: number;
  longest: number;
  weekActivity: { date: string; count: number }[];
  totalSolved: number;
}

export function computeStreakFromDates(isoDates: string[]): StreakData {
  const days = new Set(
    isoDates.map(d => new Date(d).toISOString().slice(0, 10))
  );
  const today = new Date();
  let current = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) current++;
    else if (i > 0) break;
  }
  // longest
  const sorted = [...days].sort();
  let longest = 0, run = 0, prev: Date | null = null;
  for (const k of sorted) {
    const d = new Date(k);
    if (prev && (d.getTime() - prev.getTime()) === 86400000) run++;
    else run = 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const week: StreakData['weekActivity'] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = isoDates.filter(sd => new Date(sd).toISOString().slice(0, 10) === key).length;
    week.push({ date: key, count });
  }
  return { current, longest, weekActivity: week, totalSolved: isoDates.length };
}

export async function fetchStreakForUser(userId: string): Promise<StreakData> {
  const { data } = await supabase
    .from('user_problem_progress')
    .select('solved, solved_at, last_attempted')
    .eq('user_id', userId)
    .eq('solved', true);
  const dates = (data ?? [])
    .map((r: any) => r.solved_at || r.last_attempted)
    .filter(Boolean) as string[];
  return computeStreakFromDates(dates);
}

export function useStreak() {
  const { authUser } = useUser();
  const [data, setData] = useState<StreakData>({ current: 0, longest: 0, weekActivity: [], totalSolved: 0 });
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!authUser?.id) return;
    setLoading(true);
    fetchStreakForUser(authUser.id).then(d => { setData(d); setLoading(false); });
  }, [authUser?.id]);
  return { ...data, loading };
}

/** Fetch streak (current only) for many users in one round-trip. */
export async function fetchStreaksForUsers(userIds: string[]): Promise<Record<string, number>> {
  if (!userIds.length) return {};
  const { data } = await supabase
    .from('user_problem_progress')
    .select('user_id, solved_at, last_attempted')
    .in('user_id', userIds)
    .eq('solved', true);
  const grouped: Record<string, string[]> = {};
  (data ?? []).forEach((r: any) => {
    const d = r.solved_at || r.last_attempted;
    if (!d) return;
    (grouped[r.user_id] ||= []).push(d);
  });
  const out: Record<string, number> = {};
  for (const uid of userIds) {
    out[uid] = computeStreakFromDates(grouped[uid] || []).current;
  }
  return out;
}

/** Mini bar graph component for use in topbar / rows */
export function StreakBars({ data, color = 'currentColor', height = 14 }: { data: { count: number }[]; color?: string; height?: number }) {
  const max = Math.max(1, ...data.map(d => d.count));
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {data.map((d, i) => (
        <div
          key={i}
          className="w-[3px] rounded-[1px] transition-all"
          style={{
            height: `${Math.max(2, (d.count / max) * height)}px`,
            background: d.count > 0 ? color : 'hsl(var(--muted))',
            opacity: d.count > 0 ? 0.9 : 0.4,
          }}
        />
      ))}
    </div>
  );
}
