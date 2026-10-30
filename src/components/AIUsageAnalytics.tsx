import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Users, Zap, AlertTriangle, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;

interface Agg {
  key: string;
  requests: number;
  ok: number;
  rate_limited: number;
  errors: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  features: Record<string, number>;
  last_at: string;
  user_id?: string | null;
  username?: string;
  email?: string | null;
}

interface LogRow {
  id: string;
  created_at: string;
  username: string;
  feature: string;
  provider: string;
  model: string;
  key_label: string | null;
  status: string;
  http_status: number | null;
  total_tokens: number;
  latency_ms: number | null;
  rate_limit_remaining_requests: string | null;
  rate_limit_remaining_tokens: string | null;
  error: string | null;
}

interface Analytics {
  days: number;
  totals: { requests: number; total_tokens: number; rate_limited: number; errors: number; users: number };
  byUser: Agg[];
  byFeature: Agg[];
  byModel: Agg[];
  recent: LogRow[];
}

async function fetchAnalytics(days: number): Promise<Analytics> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-key-admin`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "usage_analytics", days }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

const fmt = (n: number) => n.toLocaleString();

const statusVariant = (s: string) =>
  s === "ok" ? "secondary" : s === "rate_limited" ? "outline" : "destructive";

const Stat = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <Icon className="h-3.5 w-3.5" /> {label}
    </div>
    <p className="mt-1 text-xl font-bold text-foreground">{value}</p>
  </div>
);

const AggTable = ({ rows, nameLabel, nameOf }: { rows: Agg[]; nameLabel: string; nameOf: (r: Agg) => React.ReactNode }) => {
  const max = Math.max(1, ...rows.map((r) => r.total_tokens));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border text-left">
            <th className="py-2 pr-3 font-medium">{nameLabel}</th>
            <th className="py-2 pr-3 font-medium text-right">Requests</th>
            <th className="py-2 pr-3 font-medium text-right">Prompt</th>
            <th className="py-2 pr-3 font-medium text-right">Completion</th>
            <th className="py-2 pr-3 font-medium">Total tokens</th>
            <th className="py-2 pr-3 font-medium text-right">Rate-limited</th>
            <th className="py-2 pr-3 font-medium text-right">Errors</th>
            <th className="py-2 font-medium">Last used</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-border/50 align-top">
              <td className="py-2 pr-3">{nameOf(r)}</td>
              <td className="py-2 pr-3 text-right">{fmt(r.requests)}</td>
              <td className="py-2 pr-3 text-right">{fmt(r.prompt_tokens)}</td>
              <td className="py-2 pr-3 text-right">{fmt(r.completion_tokens)}</td>
              <td className="py-2 pr-3 min-w-[140px]">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${(r.total_tokens / max) * 100}%` }} />
                  </div>
                  <span className="tabular-nums">{fmt(r.total_tokens)}</span>
                </div>
              </td>
              <td className="py-2 pr-3 text-right">{r.rate_limited || "–"}</td>
              <td className="py-2 pr-3 text-right">{r.errors || "–"}</td>
              <td className="py-2 text-muted-foreground whitespace-nowrap">{new Date(r.last_at).toLocaleString()}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No AI usage in this period.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-card p-4 space-y-3">
    <h3 className="text-sm font-bold text-foreground">{title}</h3>
    {children}
  </div>
);

const AIUsageAnalytics = () => {
  const [days, setDays] = useState(7);
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchAnalytics(days));
    } catch (e: any) {
      toast.error("Failed to load AI usage: " + e.message);
    }
    setLoading(false);
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const users = useMemo(() => {
    const q = userFilter.trim().toLowerCase();
    return (data?.byUser ?? []).filter((u) => !q || `${u.username} ${u.email ?? ""}`.toLowerCase().includes(q));
  }, [data, userFilter]);

  const recent = useMemo(
    () => (data?.recent ?? []).filter((r) => !selectedUser || r.username === selectedUser),
    [data, selectedUser],
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 p-1 bg-card border border-border rounded-xl">
          {[1, 7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {d === 1 ? "24h" : `${d}d`}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={load} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat icon={Activity} label="Requests" value={fmt(data?.totals.requests ?? 0)} />
        <Stat icon={Zap} label="Total tokens" value={fmt(data?.totals.total_tokens ?? 0)} />
        <Stat icon={Users} label="Active users" value={fmt(data?.totals.users ?? 0)} />
        <Stat icon={AlertTriangle} label="Rate-limited" value={fmt(data?.totals.rate_limited ?? 0)} />
        <Stat icon={AlertTriangle} label="Errors" value={fmt(data?.totals.errors ?? 0)} />
      </div>

      <Section title="Usage by feature">
        <AggTable rows={data?.byFeature ?? []} nameLabel="Feature" nameOf={(r) => <span className="font-mono">{r.key}</span>} />
      </Section>

      <Section title="Usage by user">
        <Input placeholder="Filter by username or email…" value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="max-w-xs h-8 text-xs" />
        <AggTable
          rows={users}
          nameLabel="User"
          nameOf={(r) => (
            <button className="text-left" onClick={() => setSelectedUser(selectedUser === r.username ? null : r.username ?? null)}>
              <div className="font-medium text-foreground hover:underline">{r.username}</div>
              {r.email && <div className="text-[10px] text-muted-foreground">{r.email}</div>}
              <div className="mt-1 flex flex-wrap gap-1">
                {Object.entries(r.features).sort((a, b) => b[1] - a[1]).map(([f, n]) => (
                  <Badge key={f} variant="secondary" className="text-[9px] px-1.5">{f} · {n}</Badge>
                ))}
              </div>
            </button>
          )}
        />
      </Section>

      <Section title="Usage by model">
        <AggTable rows={data?.byModel ?? []} nameLabel="Model" nameOf={(r) => <span className="font-mono">{r.key}</span>} />
      </Section>

      <Section title={selectedUser ? `Recent requests — ${selectedUser}` : "Recent requests"}>
        {selectedUser && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedUser(null)}>Show all users</Button>
        )}
        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground sticky top-0 bg-card">
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 font-medium">Time</th>
                <th className="py-2 pr-3 font-medium">User</th>
                <th className="py-2 pr-3 font-medium">Feature</th>
                <th className="py-2 pr-3 font-medium">Model</th>
                <th className="py-2 pr-3 font-medium text-right">Tokens</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 pr-3 font-medium">Rate limit left (req / tok)</th>
                <th className="py-2 font-medium text-right">Latency</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-b border-border/50" title={r.error ?? ""}>
                  <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="py-1.5 pr-3">{r.username}</td>
                  <td className="py-1.5 pr-3 font-mono">{r.feature}</td>
                  <td className="py-1.5 pr-3 font-mono">{r.model || "–"}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{fmt(r.total_tokens)}</td>
                  <td className="py-1.5 pr-3">
                    <Badge variant={statusVariant(r.status) as any} className="text-[9px]">
                      {r.status}{r.http_status ? ` ${r.http_status}` : ""}
                    </Badge>
                  </td>
                  <td className="py-1.5 pr-3 text-muted-foreground">
                    {r.rate_limit_remaining_requests ?? "–"} / {r.rate_limit_remaining_tokens ?? "–"}
                  </td>
                  <td className="py-1.5 text-right text-muted-foreground">{r.latency_ms != null ? `${r.latency_ms} ms` : "–"}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No requests logged yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
};

export default AIUsageAnalytics;
