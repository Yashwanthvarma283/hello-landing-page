// Admin-only management of the shared AI key pool.
// All actions require an admin session (user_roles.role = 'admin').
// Keys are stored in public.ai_api_keys (service_role-only) and are never
// returned unmasked to the client.

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { invalidatePoolCache, listProviderModels, GROQ_BASE_URL } from '../_shared/ai-pool.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const DEFAULT_BASE_URLS: Record<string, string> = {
  groq: GROQ_BASE_URL,
  lovable: 'https://ai.gateway.lovable.dev/v1',
};

function mask(key: string | null | undefined): string {
  if (!key) return '';
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 3)}••••${key.slice(-4)}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

async function testKey(base: string, apiKey: string, provider: string, model: string): Promise<{ ok: boolean; error?: string; latencyMs: number }> {
  const started = Date.now();
  const url = `${(provider === 'lovable' ? 'https://ai.gateway.lovable.dev/v1' : base).replace(/\/$/, '')}/chat/completions`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'google/gemini-3.8-flash',
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        max_tokens: 8,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}`, latencyMs: Date.now() - started };
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
  try { body = await req.json(); } catch { /* empty body */ }
  const action = body.action ?? 'list';

  try {
    switch (action) {
      case 'list': {
        const [keysRes, featRes] = await Promise.all([
          supabase.from('ai_api_keys').select('*').order('created_at', { ascending: true }),
          supabase.from('ai_feature_config').select('*'),
        ]);
        const keys = (keysRes.data ?? []).map((k: any) => ({ ...k, api_key: mask(k.api_key), has_key: !!k.api_key }));
        return json({ keys, features: featRes.data ?? [] });
      }

      case 'add_key': {
        const provider = String(body.provider ?? 'groq');
        const baseUrl = String(body.base_url || DEFAULT_BASE_URLS[provider] || '');
        const apiKey = String(body.api_key ?? '');
        const model = String(body.model ?? '');
        if (!body.label) return json({ error: 'Label is required' }, 400);
        if (provider !== 'lovable' && !apiKey) return json({ error: 'API key is required' }, 400);
        if (provider !== 'lovable' && !baseUrl) return json({ error: 'Base URL is required' }, 400);
        const { data, error } = await supabase.from('ai_api_keys').insert({
          label: String(body.label).slice(0, 100),
          provider,
          base_url: baseUrl,
          api_key: apiKey,
          model,
          enabled: body.enabled !== false,
        }).select('*').single();
        if (error) throw new Error(error.message);
        invalidatePoolCache();
        return json({ key: { ...data, api_key: mask(data.api_key), has_key: !!data.api_key } });
      }

      case 'update_key': {
        const patch: Record<string, unknown> = {};
        if (typeof body.label === 'string') patch.label = body.label.slice(0, 100);
        if (typeof body.model === 'string') patch.model = body.model;
        if (typeof body.base_url === 'string' && body.base_url) patch.base_url = body.base_url;
        if (typeof body.enabled === 'boolean') {
          patch.enabled = body.enabled;
          patch.status = body.enabled ? 'active' : 'disabled';
        }
        if (body.reset_status) { patch.status = 'active'; patch.last_error = null; patch.error_count = 0; }
        if (typeof body.api_key === 'string' && body.api_key.trim()) patch.api_key = body.api_key.trim();
        const { data, error } = await supabase.from('ai_api_keys').update(patch).eq('id', body.id).select('*').single();
        if (error) throw new Error(error.message);
        invalidatePoolCache();
        return json({ key: { ...data, api_key: mask(data.api_key), has_key: !!data.api_key } });
      }

      case 'delete_key': {
        // Unassign the key from all features so the pool stays coherent.
        const { data: feats } = await supabase.from('ai_feature_config').select('*');
        for (const f of feats ?? []) {
          const ids: string[] = Array.isArray(f.key_ids) ? f.key_ids : [];
          if (ids.includes(body.id)) {
            await supabase.from('ai_feature_config').update({
              key_ids: ids.filter((i) => i !== body.id),
            }).eq('feature_key', f.feature_key);
          }
        }
        const { error } = await supabase.from('ai_api_keys').delete().eq('id', body.id);
        if (error) throw new Error(error.message);
        invalidatePoolCache();
        return json({ ok: true });
      }

      case 'test_key': {
        const { data: key, error } = await supabase.from('ai_api_keys').select('*').eq('id', body.id).single();
        if (error || !key) throw new Error(error?.message ?? 'Key not found');
        const apiKey = key.api_key || (key.provider === 'lovable' ? Deno.env.get('LOVABLE_API_KEY') ?? '' : '');
        const result = await testKey(key.base_url, apiKey, key.provider, key.model);
        await supabase.from('ai_api_keys').update({
          status: result.ok ? 'active' : (result.error?.includes('429') ? 'rate_limited' : 'invalid'),
          last_error: result.ok ? null : result.error ?? 'test failed',
          last_used_at: new Date().toISOString(),
        }).eq('id', key.id);
        invalidatePoolCache();
        return json(result);
      }

      case 'list_models': {
        const provider = String(body.provider ?? 'groq');
        let baseUrl = String(body.base_url || DEFAULT_BASE_URLS[provider] || GROQ_BASE_URL);
        let apiKey = String(body.api_key ?? '');
        if (body.key_id) {
          const { data: key } = await supabase.from('ai_api_keys').select('*').eq('id', body.key_id).single();
          if (key) {
            baseUrl = key.provider === 'lovable' ? 'https://ai.gateway.lovable.dev/v1' : key.base_url;
            apiKey = key.api_key || (key.provider === 'lovable' ? Deno.env.get('LOVABLE_API_KEY') ?? '' : '');
          }
        }
        if (provider === 'lovable' && !apiKey) apiKey = Deno.env.get('LOVABLE_API_KEY') ?? '';
        if (!apiKey) return json({ error: 'No API key available for this provider' }, 400);
        try {
          const models = await listProviderModels(baseUrl, apiKey);
          return json({ models });
        } catch (e: any) {
          return json({ error: String(e?.message ?? e) }, 400);
        }
      }

      case 'set_feature': {
        if (!body.feature_key) return json({ error: 'feature_key is required' }, 400);
        const patch = {
          feature_key: String(body.feature_key),
          model: String(body.model ?? ''),
          key_ids: Array.isArray(body.key_ids) ? body.key_ids : [],
          enabled: body.enabled !== false,
        };
        const { data, error } = await supabase.from('ai_feature_config')
          .upsert(patch, { onConflict: 'feature_key' })
          .select('*').single();
        if (error) throw new Error(error.message);
        invalidatePoolCache();
        return json({ feature: data });
      }

      case 'stats': {
        const { data: keys } = await supabase.from('ai_api_keys').select('id,label,status,usage_count,error_count,last_used_at,last_error').order('usage_count', { ascending: false });
        return json({ stats: keys ?? [] });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e: any) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});
