// Shared AI key pool for all edge functions.
// Keys + per-feature model selection live in `public.ai_api_keys` / `public.ai_feature_config`,
// managed from the admin dashboard. Secrets are never exposed to the client:
// the tables are service_role-only (RLS enabled, no policies).
//
// Rotation: tries each enabled key in turn; 429 marks the key rate_limited,
// 401/403 marks it invalid, and the call moves on to the next key.
// Falls back to legacy GROQ_API_KEY_* env secrets, then the built-in LOVABLE_API_KEY,
// so features keep working even with an empty pool.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const LOVABLE_URL = 'https://ai.gateway.lovable.dev/v1';
export const LOVABLE_DEFAULT_MODEL = 'google/gemini-3.8-flash';
export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

export interface PoolKey {
  id: string;
  label: string;
  provider: string;
  base_url: string;
  api_key: string;
  model: string;
}

export interface AIResult {
  content: string;
  provider: string;
  keyId: string | null;
  keyLabel: string;
  model: string;
}

export interface ChatOptions {
  messages: any[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  responseFormat?: 'json' | 'text';
  stream?: boolean;
}

let rotationCursor = 0;

export interface StreamResult {
  body: ReadableStream<Uint8Array>;
  provider: string;
  keyId: string | null;
  keyLabel: string;
  model: string;
}

// ── config cache (30s per isolate) ───────────────────────────────────────────
let cache: { keys: PoolKey[]; features: Record<string, { model: string; key_ids: string[]; enabled: boolean }>; at: number } | null = null;
const CACHE_MS = 30_000;

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

async function loadConfig(force = false) {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache;
  const supabase = adminClient();
  const [keysRes, featRes] = await Promise.all([
    supabase.from('ai_api_keys').select('*').order('created_at', { ascending: true }),
    supabase.from('ai_feature_config').select('*'),
  ]);
  const keys: PoolKey[] = (keysRes.data ?? []).filter((k: any) => k.enabled).map((k: any) => ({
    id: k.id, label: k.label, provider: k.provider, base_url: k.base_url, api_key: k.api_key, model: k.model,
  }));
  const features: Record<string, { model: string; key_ids: string[]; enabled: boolean }> = {};
  for (const f of featRes.data ?? []) {
    features[f.feature_key] = { model: f.model, key_ids: f.key_ids ?? [], enabled: f.enabled !== false };
  }
  cache = { keys, features, at: Date.now() };
  return cache;
}

export function invalidatePoolCache() {
  cache = null;
}

async function track(keyId: string, patch: Record<string, unknown>) {
  try {
    const supabase = adminClient();
    await supabase.rpc('ai_pool_track_key_usage', { p_key_id: keyId, p_patch: patch });
  } catch {
    // usage tracking must never break a request
  }
}

async function resolveModel(key: PoolKey, feature: { model: string } | undefined, override?: string): Promise<string> {
  if (override) return override;
  if (feature?.model) return feature.model;
  if (key.model) return key.model;
  if (key.provider === 'lovable') return LOVABLE_DEFAULT_MODEL;
  throw new Error(`No model selected for key "${key.label}". Pick a model in the admin dashboard (AI APIs).`);
}

async function callKey(
  key: PoolKey,
  model: string,
  opts: ChatOptions,
): Promise<Response> {
  const baseUrl = key.provider === 'lovable' ? LOVABLE_URL : key.base_url.replace(/\/$/, '');
  const apiKey = key.api_key || (key.provider === 'lovable' ? Deno.env.get('LOVABLE_API_KEY') ?? '' : '');
  return await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 4096,
      ...(opts.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
}

// Legacy env rotation (kept as last-resort fallback so nothing breaks mid-migration).
async function legacyGroqFallback(opts: ChatOptions, model: string): Promise<AIResult | null> {
  const keys: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const k = Deno.env.get(`GROQ_API_KEY_${i}`);
    if (k) keys.push(k);
  }
  if (keys.length === 0) return null;
  let lastErr = '';
  for (const key of keys) {
    try {
      const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: opts.messages, temperature: opts.temperature ?? 0.3, max_tokens: opts.maxTokens ?? 4096 }),
      });
      if (!res.ok) { lastErr = `HTTP ${res.status}`; continue; }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content ?? '';
      if (content) return { content, provider: 'groq-legacy', keyId: null, keyLabel: 'env key', model };
    } catch (e) {
      lastErr = String(e?.message ?? e);
    }
  }
  console.error('ai-pool: legacy groq fallback failed:', lastErr);
  return null;
}

async function lovableFallback(opts: ChatOptions, model: string): Promise<AIResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('No AI keys configured. Ask the admin to add API keys in the admin dashboard.');
  const res = await fetch(`${LOVABLE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: opts.messages, temperature: opts.temperature ?? 0.3, max_tokens: opts.maxTokens ?? 4096 }),
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error('RATE_LIMIT: Too many requests, please wait a moment and try again.');
    if (res.status === 402) throw new Error('CREDITS: AI credits exhausted. Please top up to keep using this feature.');
    throw new Error(`AI request failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return { content: data?.choices?.[0]?.message?.content ?? '', provider: 'lovable', keyId: null, keyLabel: 'built-in', model };
}

export async function chatWithFeatureAI(featureKey: string, opts: ChatOptions): Promise<AIResult> {
  const { keys, features } = await loadConfig();
  const feature = features[featureKey];
  if (feature && feature.enabled === false) {
    // Feature is disabled in the pool: go straight to the built-in fallback.
    return await lovableFallback(opts, opts.model || feature.model || LOVABLE_DEFAULT_MODEL);
  }

  let candidates = keys;
  if (feature && feature.key_ids.length > 0) {
    const allowed = new Set(feature.key_ids);
    const scoped = keys.filter((k) => allowed.has(k.id));
    if (scoped.length > 0) candidates = scoped;
  }

  let lastErr = '';
  for (let attempt = 0; attempt < candidates.length; attempt++) {
    const key = candidates[(attempt + rotationCursor) % candidates.length];
    const model = await resolveModel(key, feature, opts.model);
    try {
      const res = await callKey(key, model, opts);
      if (res.status === 429) {
        lastErr = `${key.label} -> rate limited (429)`;
        track(key.id, { p_status: 'rate_limited', p_error: lastErr, p_ok: false });
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        lastErr = `${key.label} -> invalid key (HTTP ${res.status})`;
        track(key.id, { p_status: 'invalid', p_error: lastErr, p_ok: false });
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        lastErr = `${key.label} -> HTTP ${res.status}: ${text.slice(0, 200)}`;
        track(key.id, { p_status: 'active', p_error: lastErr, p_ok: false });
        continue;
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content ?? '';
      if (!content) { lastErr = `${key.label} -> empty response`; continue; }
      rotationCursor = (rotationCursor + 1) % Math.max(candidates.length, 1);
      track(key.id, { p_ok: true });
      return { content, provider: key.provider, keyId: key.id, keyLabel: key.label, model };
    } catch (e) {
      lastErr = `${key.label} -> ${String(e?.message ?? e)}`;
    }
  }
  rotationCursor++;

  // Pool exhausted or empty: legacy env keys, then the built-in Lovable key.
  if (lastErr) console.error(`ai-pool[${featureKey}]: all pool keys failed: ${lastErr}`);
  const legacy = await legacyGroqFallback(opts, opts.model || feature?.model || LOVABLE_DEFAULT_MODEL);
  if (legacy) return legacy;
  return await lovableFallback(opts, opts.model || feature?.model || LOVABLE_DEFAULT_MODEL);
}

// List models a provider exposes (used by the admin dashboard).
export async function listProviderModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/models`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`Models request failed: HTTP ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return list.map((m: any) => m?.id).filter((id: unknown): id is string => typeof id === 'string').sort();
}
