// Admin-only management of the shared AI key pool.
// All actions require an admin session (user_roles.role = 'admin').
// Keys are stored in public.ai_api_keys (service_role-only) and are never
// returned unmasked to the client.
//
// Architecture: one key is marked is_primary = true.
// ALL AI features in the app use ONLY that primary key.
// No auto-fallback — if the primary key hits a limit, AI features fail until
// the admin manually sets a different key as primary.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { invalidatePoolCache, listProviderModels, GROQ_BASE_URL } from '../_shared/ai-pool.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const DEFAULT_BASE_URLS: Record<string, string> = {
  groq: GROQ_BASE_URL,
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
};

function mask(key: string | null | undefined): string {
  if (!key) return '';
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getAdminUser(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: userData } = await supabase.auth.getUser(token);
  const userId = userData?.user?.id;
  if (!userId) return null;
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
  return isAdmin ? userId : null;
}

async function testKey(
  base: string,
  apiKey: string,
  model: string,
): Promise<{ ok: boolean; error?: string; latencyMs: number }> {
  const started = Date.now();
  const url = `${base.replace(/\/$/, '')}/chat/completions`;
  const defaultModel =
    model ||
    (base.includes('groq')
      ? 'llama-3.3-70b-versatile'
      : base.includes('openai')
      ? 'gpt-4o-mini'
      : base.includes('googleapis')
      ? 'gemini-1.5-flash'
      : 'llama-3.1-8b-instant');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: defaultModel,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        max_tokens: 8,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        error: `HTTP ${res.status}: ${text.slice(0, 200)}`,
        latencyMs: Date.now() - started,
      };
    }
    return { ok: true, latencyMs: Date.now() - started };
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? e), latencyMs: Date.now() - started };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const adminId = await getAdminUser(req);
  if (!adminId) return json({ error: 'Admin access required' }, 403);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine for list */
  }
  const action = body.action ?? 'list';

  try {
    switch (action) {
      // ── LIST ──────────────────────────────────────────────────────────────
      case 'list': {
        const { data, error } = await supabase
          .from('ai_api_keys')
          .select('*')
          .order('created_at', { ascending: true });
        if (error) throw new Error(error.message);
        const keys = (data ?? []).map((k: any) => ({
          ...k,
          api_key: mask(k.api_key),
          has_key: !!k.api_key,
        }));
        return json({ keys });
      }

      // ── ADD KEY ───────────────────────────────────────────────────────────
      case 'add_key': {
        if (!body.label) return json({ error: 'Label is required' }, 400);
        if (!body.api_key?.trim()) return json({ error: 'API key is required' }, 400);

        const provider = String(body.provider ?? 'groq');
        const baseUrl = String(body.base_url || DEFAULT_BASE_URLS[provider] || GROQ_BASE_URL);
        if (!baseUrl) return json({ error: 'Base URL is required' }, 400);

        const { data, error } = await supabase
          .from('ai_api_keys')
          .insert({
            label: String(body.label).slice(0, 100),
            provider,
            base_url: baseUrl,
            api_key: String(body.api_key).trim(),
            model: String(body.model ?? ''),
            enabled: true,
            is_primary: false,
          })
          .select('*')
          .single();
        if (error) throw new Error(error.message);
        invalidatePoolCache();
        return json({ key: { ...data, api_key: mask(data.api_key), has_key: !!data.api_key } });
      }

      // ── UPDATE KEY ────────────────────────────────────────────────────────
      case 'update_key': {
        if (!body.id) return json({ error: 'id is required' }, 400);
        const patch: Record<string, unknown> = {};
        if (typeof body.label === 'string') patch.label = body.label.slice(0, 100);
        if (typeof body.model === 'string') patch.model = body.model;
        if (typeof body.base_url === 'string' && body.base_url) patch.base_url = body.base_url;
        if (typeof body.api_key === 'string' && body.api_key.trim())
          patch.api_key = body.api_key.trim();
        // Allow marking as primary via update_key too (same as set_primary)
        if (body.is_primary === true) {
          // clear existing primary first
          await supabase
            .from('ai_api_keys')
            .update({ is_primary: false })
            .neq('id', body.id)
            .eq('is_primary', true);
          patch.is_primary = true;
        }

        const { data, error } = await supabase
          .from('ai_api_keys')
          .update(patch)
          .eq('id', body.id)
          .select('*')
          .single();
        if (error) throw new Error(error.message);
        invalidatePoolCache();
        return json({ key: { ...data, api_key: mask(data.api_key), has_key: !!data.api_key } });
      }

      // ── DELETE KEY ────────────────────────────────────────────────────────
      case 'delete_key': {
        if (!body.id) return json({ error: 'id is required' }, 400);
        const { error } = await supabase.from('ai_api_keys').delete().eq('id', body.id);
        if (error) throw new Error(error.message);
        invalidatePoolCache();
        return json({ ok: true });
      }

      // ── SET PRIMARY ───────────────────────────────────────────────────────
      // Clears all other primaries, sets the target key as primary.
      // Also updates the default model for that key if provided.
      case 'set_primary': {
        if (!body.id) return json({ error: 'id is required' }, 400);

        // 1. Unset any existing primary
        await supabase
          .from('ai_api_keys')
          .update({ is_primary: false })
          .eq('is_primary', true);

        // 2. Set new primary + optional model
        const patch: Record<string, unknown> = { is_primary: true, enabled: true };
        if (typeof body.model === 'string' && body.model.trim()) {
          patch.model = body.model.trim();
        }

        const { data, error } = await supabase
          .from('ai_api_keys')
          .update(patch)
          .eq('id', body.id)
          .select('*')
          .single();
        if (error) throw new Error(error.message);
        invalidatePoolCache();
        return json({ key: { ...data, api_key: mask(data.api_key), has_key: !!data.api_key } });
      }

      // ── UNSET PRIMARY ─────────────────────────────────────────────────────
      case 'unset_primary': {
        await supabase.from('ai_api_keys').update({ is_primary: false }).eq('is_primary', true);
        invalidatePoolCache();
        return json({ ok: true });
      }

      // ── GET PRIMARY ───────────────────────────────────────────────────────
      case 'get_primary': {
        const { data: key } = await supabase
          .from('ai_api_keys')
          .select('*')
          .eq('is_primary', true)
          .maybeSingle();
        if (!key) return json({ primary: null });
        return json({ primary: { ...key, api_key: mask(key.api_key), has_key: !!key.api_key } });
      }

      // ── TEST KEY ──────────────────────────────────────────────────────────
      case 'test_key': {
        if (!body.id) return json({ error: 'id is required' }, 400);
        const { data: key, error } = await supabase
          .from('ai_api_keys')
          .select('*')
          .eq('id', body.id)
          .single();
        if (error || !key) throw new Error(error?.message ?? 'Key not found');
        const testModel = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : key.model;
        const result = await testKey(key.base_url, key.api_key, testModel);
        await supabase
          .from('ai_api_keys')
          .update({
            status: result.ok ? 'active' : result.error?.includes('429') ? 'rate_limited' : 'invalid',
            last_error: result.ok ? null : result.error ?? 'test failed',
            last_used_at: new Date().toISOString(),
          })
          .eq('id', key.id);
        invalidatePoolCache();
        return json(result);
      }

      // ── LIST MODELS ───────────────────────────────────────────────────────
      // Fetches available models from the provider using the key stored in DB or directly passed.
      case 'list_models': {
        let baseUrl = typeof body.base_url === 'string' ? body.base_url.trim() : '';
        let apiKey = typeof body.api_key === 'string' ? body.api_key.trim() : '';

        if (body.key_id) {
          const { data: key } = await supabase
            .from('ai_api_keys')
            .select('*')
            .eq('id', body.key_id)
            .single();
          if (key) {
            baseUrl = key.base_url;
            apiKey = key.api_key;
          }
        }

        if (!apiKey) return json({ error: 'Key not found or no API key provided' }, 400);
        try {
          const models = await listProviderModels(baseUrl || GROQ_BASE_URL, apiKey);
          return json({ models });
        } catch (e: any) {
          return json({ error: String(e?.message ?? e) }, 400);
        }
      }

      // ── STATS ─────────────────────────────────────────────────────────────
      case 'stats': {
        const { data: keys } = await supabase
          .from('ai_api_keys')
          .select('id,label,status,usage_count,error_count,last_used_at,last_error,is_primary')
          .order('is_primary', { ascending: false });
        return json({ stats: keys ?? [] });
      }

      // ── GLOBAL SETTINGS (IDE chatbot override) ───────────────────────────
      case 'get_settings': {
        const { data } = await supabase.from('ai_settings').select('*').eq('id', true).maybeSingle();
        return json({ settings: { ide_use_primary: !!data?.ide_use_primary, updated_at: data?.updated_at ?? null } });
      }
      case 'set_ide_override': {
        const enabled = body.enabled === true;
        const { error } = await supabase
          .from('ai_settings')
          .upsert({ id: true, ide_use_primary: enabled, updated_at: new Date().toISOString(), updated_by: adminId });
        if (error) throw new Error(error.message);
        return json({ settings: { ide_use_primary: enabled } });
      }

      // ── USAGE ANALYTICS ───────────────────────────────────────────────────
      case 'usage_analytics': {
        const days = Math.min(Math.max(Number(body.days) || 7, 1), 90);
        const since = new Date(Date.now() - days * 86400_000).toISOString();
        const rows: any[] = [];
        for (let from = 0; from < 50_000; from += 1000) {
          const { data, error } = await supabase
            .from('ai_usage_logs')
            .select('id,created_at,user_id,feature,provider,model,key_label,status,http_status,prompt_tokens,completion_tokens,total_tokens,latency_ms,rate_limit_remaining_requests,rate_limit_remaining_tokens,error')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .range(from, from + 999);
          if (error) throw new Error(error.message);
          rows.push(...(data ?? []));
          if (!data || data.length < 1000) break;
        }
        const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
        const names: Record<string, { username: string; email: string | null }> = {};
        for (let i = 0; i < userIds.length; i += 200) {
          const { data } = await supabase.from('profiles').select('id,username,email').in('id', userIds.slice(i, i + 200));
          for (const p of data ?? []) names[p.id] = { username: p.username, email: p.email };
        }
        const agg = (keyFn: (r: any) => string) => {
          const m = new Map<string, any>();
          for (const r of rows) {
            const k = keyFn(r);
            const a = m.get(k) ?? { key: k, requests: 0, ok: 0, rate_limited: 0, errors: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, features: {} as Record<string, number>, last_at: r.created_at };
            a.requests++;
            if (r.status === 'ok') a.ok++; else if (r.status === 'rate_limited') a.rate_limited++; else a.errors++;
            a.prompt_tokens += r.prompt_tokens || 0;
            a.completion_tokens += r.completion_tokens || 0;
            a.total_tokens += r.total_tokens || 0;
            a.features[r.feature] = (a.features[r.feature] ?? 0) + 1;
            if (r.created_at > a.last_at) a.last_at = r.created_at;
            m.set(k, a);
          }
          return [...m.values()].sort((x, y) => y.total_tokens - x.total_tokens || y.requests - x.requests);
        };
        const byUser = agg((r) => r.user_id ?? 'anonymous').map((u) => ({
          ...u,
          user_id: u.key === 'anonymous' ? null : u.key,
          username: names[u.key]?.username ?? (u.key === 'anonymous' ? 'Anonymous / system' : 'Unknown user'),
          email: names[u.key]?.email ?? null,
        }));
        const byFeature = agg((r) => r.feature);
        const byModel = agg((r) => r.model || 'unknown');
        const recent = rows.slice(0, 200).map((r) => ({ ...r, username: r.user_id ? names[r.user_id]?.username ?? 'Unknown' : 'Anonymous' }));
        const totals = byFeature.reduce(
          (t, f) => ({ requests: t.requests + f.requests, total_tokens: t.total_tokens + f.total_tokens, rate_limited: t.rate_limited + f.rate_limited, errors: t.errors + f.errors }),
          { requests: 0, total_tokens: 0, rate_limited: 0, errors: 0 },
        );
        return json({ days, totals: { ...totals, users: userIds.length }, byUser, byFeature, byModel, recent });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
