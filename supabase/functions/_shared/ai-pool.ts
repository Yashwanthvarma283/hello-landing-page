// Shared AI key pool for all edge functions.
//
// Architecture: PRIMARY KEY ONLY — no fallbacks, no env-var keys.
// The admin sets exactly one key as `is_primary = true` in public.ai_api_keys.
// Every AI call uses that key. If the primary key is rate-limited or invalid,
// the request fails with a clear error message until the admin switches the primary.
//
// Keys are service_role-only (RLS enabled, no public policies).
// The raw api_key is never returned to the client — only masked strings.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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
  raw?: any;
  provider: string;
  keyId: string;
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
  tools?: any[];
  toolChoice?: any;
  /** Incoming request — used to attribute usage to the signed-in user. */
  req?: Request;
  /** Explicit user id (overrides req). */
  userId?: string | null;
  /** Feature name recorded in ai_usage_logs. */
  feature?: string;
}

export interface StreamResult {
  body: ReadableStream<Uint8Array>;
  provider: string;
  keyId: string;
  keyLabel: string;
  model: string;
}

// ── Cache (30 s per isolate) ──────────────────────────────────────────────────
let primaryCache: { key: PoolKey | null; at: number } | null = null;
const CACHE_MS = 30_000;

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

async function loadPrimary(force = false): Promise<PoolKey | null> {
  if (!force && primaryCache && Date.now() - primaryCache.at < CACHE_MS) {
    return primaryCache.key;
  }
  const supabase = adminClient();
  const { data } = await supabase
    .from('ai_api_keys')
    .select('*')
    .eq('is_primary', true)
    .eq('enabled', true)
    .maybeSingle();

  const key: PoolKey | null = data
    ? {
        id: data.id,
        label: data.label,
        provider: data.provider,
        base_url: data.base_url,
        api_key: data.api_key,
        model: data.model ?? '',
      }
    : null;

  primaryCache = { key, at: Date.now() };
  return key;
}

export function invalidatePoolCache() {
  primaryCache = null;
}

async function track(keyId: string, patch: Record<string, unknown>) {
  try {
    const supabase = adminClient();
    await supabase.rpc('ai_pool_track_key_usage', { p_key_id: keyId, p_patch: patch });
  } catch {
    // usage tracking must never break a request
  }
}

function resolveModel(key: PoolKey, override?: string): string {
  if (override) return override;
  if (key.model) return key.model;
  throw new Error(
    `No model configured for primary key "${key.label}". Set a default model in the Admin Dashboard → AI API Keys.`,
  );
}

async function callKey(key: PoolKey, model: string, opts: ChatOptions): Promise<Response> {
  const baseUrl = key.base_url.replace(/\/$/, '');
  return await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      ...(opts.stream ? { stream_options: { include_usage: true } } : {}),
      messages: opts.messages,
      temperature: opts.temperature ?? 0.3,
      max_tokens: opts.maxTokens ?? 4096,
      ...(opts.stream ? { stream: true } : {}),
      ...(opts.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
      ...(opts.tools ? { tools: opts.tools, tool_choice: opts.toolChoice ?? 'auto' } : {}),
    }),
  });
}


// ── Usage logging ─────────────────────────────────────────────────────────────
export async function getUserIdFromRequest(req?: Request): Promise<string | null> {
  try {
    const auth = req?.headers.get('Authorization') ?? '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token) return null;
    const { data } = await adminClient().auth.getUser(token);
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}

export interface UsageLogEntry {
  userId?: string | null;
  feature: string;
  provider: string;
  model: string;
  keyId?: string | null;
  keyLabel?: string | null;
  status: 'ok' | 'rate_limited' | 'invalid' | 'error';
  httpStatus?: number | null;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  headers?: Headers | null;
  error?: string | null;
}

export async function logAIUsage(e: UsageLogEntry) {
  try {
    const pt = Number(e.promptTokens ?? 0) || 0;
    const ct = Number(e.completionTokens ?? 0) || 0;
    await adminClient().from('ai_usage_logs').insert({
      user_id: e.userId ?? null,
      feature: e.feature || 'unknown',
      provider: e.provider || '',
      model: e.model || '',
      key_id: e.keyId ?? null,
      key_label: e.keyLabel ?? null,
      status: e.status,
      http_status: e.httpStatus ?? null,
      prompt_tokens: pt,
      completion_tokens: ct,
      total_tokens: Number(e.totalTokens ?? pt + ct) || pt + ct,
      latency_ms: e.latencyMs ?? null,
      rate_limit_remaining_requests: e.headers?.get('x-ratelimit-remaining-requests') ?? null,
      rate_limit_remaining_tokens: e.headers?.get('x-ratelimit-remaining-tokens') ?? null,
      error: e.error ? String(e.error).slice(0, 500) : null,
    });
  } catch {
    // logging must never break a request
  }
}

async function resolveUser(opts: ChatOptions): Promise<string | null> {
  if (opts.userId !== undefined) return opts.userId;
  return await getUserIdFromRequest(opts.req);
}

// ── Global AI settings ───────────────────────────────────────────────────────
export async function getAISettings(): Promise<{ ide_use_primary: boolean }> {
  try {
    const { data } = await adminClient().from('ai_settings').select('ide_use_primary').eq('id', true).maybeSingle();
    return { ide_use_primary: !!data?.ide_use_primary };
  } catch {
    return { ide_use_primary: false };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

const NO_PRIMARY =
  'No primary AI key configured. An admin must add an API key and set it as primary in the Admin Dashboard.';

async function failForStatus(
  key: PoolKey,
  res: Response,
  base: Omit<UsageLogEntry, 'status'>,
): Promise<never> {
  const text = await res.text().catch(() => '');
  if (res.status === 429) {
    track(key.id, { p_ok: false, p_status: 'rate_limited', p_error: `Rate limited: ${text.slice(0, 200)}` });
    await logAIUsage({ ...base, status: 'rate_limited', httpStatus: 429, headers: res.headers, error: text });
    throw new Error(`The primary AI key "${key.label}" has hit its rate limit. An admin must set a different key as primary.`);
  }
  if (res.status === 401 || res.status === 403) {
    track(key.id, { p_ok: false, p_status: 'invalid', p_error: `Auth failed: ${text.slice(0, 200)}` });
    await logAIUsage({ ...base, status: 'invalid', httpStatus: res.status, headers: res.headers, error: text });
    throw new Error(`The primary AI key "${key.label}" is invalid or expired. An admin must update or replace it.`);
  }
  track(key.id, { p_ok: false, p_error: `HTTP ${res.status}: ${text.slice(0, 200)}` });
  await logAIUsage({ ...base, status: 'error', httpStatus: res.status, headers: res.headers, error: text });
  throw new Error(`AI request failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
}

/**
 * Non-streaming AI chat call using the admin-configured primary key.
 * Every call (success or failure) is recorded in ai_usage_logs.
 */
export async function chatWithPrimaryAI(opts: ChatOptions): Promise<AIResult> {
  const key = await loadPrimary();
  const userId = await resolveUser(opts);
  const feature = opts.feature ?? 'unknown';
  if (!key) {
    await logAIUsage({ userId, feature, provider: '', model: '', status: 'error', error: 'No primary key' });
    throw new Error(NO_PRIMARY);
  }
  const model = resolveModel(key, opts.model);
  const started = Date.now();
  const base = { userId, feature, provider: key.provider, model, keyId: key.id, keyLabel: key.label };

  let res: Response;
  try {
    res = await callKey(key, model, opts);
  } catch (e: any) {
    track(key.id, { p_ok: false, p_error: String(e?.message ?? e) });
    await logAIUsage({ ...base, status: 'error', latencyMs: Date.now() - started, error: String(e?.message ?? e) });
    throw new Error(`AI request failed: ${String(e?.message ?? e)}`);
  }
  if (!res.ok) await failForStatus(key, res, { ...base, latencyMs: Date.now() - started });

  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  const content = msg?.content ?? '';
  const usage = data?.usage ?? {};
  const logBase = {
    ...base,
    httpStatus: res.status,
    headers: res.headers,
    latencyMs: Date.now() - started,
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
  };
  if (!content && !msg?.tool_calls?.length) {
    track(key.id, { p_ok: false, p_error: 'Empty response from provider' });
    await logAIUsage({ ...logBase, status: 'error', error: 'Empty response' });
    throw new Error('AI returned an empty response. Please try again.');
  }
  track(key.id, { p_ok: true });
  await logAIUsage({ ...logBase, status: 'ok' });
  return { content, raw: data, provider: key.provider, keyId: key.id, keyLabel: key.label, model };
}

/**
 * Streaming variant — returns the SSE stream from the primary key.
 * Token usage is read from the final SSE chunk and logged when the stream ends.
 */
export async function streamWithPrimaryAI(opts: ChatOptions): Promise<StreamResult> {
  const key = await loadPrimary();
  const userId = await resolveUser(opts);
  const feature = opts.feature ?? 'unknown';
  if (!key) {
    await logAIUsage({ userId, feature, provider: '', model: '', status: 'error', error: 'No primary key' });
    throw new Error(NO_PRIMARY);
  }
  const model = resolveModel(key, opts.model);
  const started = Date.now();
  const base = { userId, feature, provider: key.provider, model, keyId: key.id, keyLabel: key.label };

  let res: Response;
  try {
    res = await callKey(key, model, { ...opts, stream: true });
  } catch (e: any) {
    track(key.id, { p_ok: false, p_error: String(e?.message ?? e) });
    await logAIUsage({ ...base, status: 'error', latencyMs: Date.now() - started, error: String(e?.message ?? e) });
    throw new Error(`AI stream request failed: ${String(e?.message ?? e)}`);
  }
  if (!res.ok || !res.body) await failForStatus(key, res, { ...base, latencyMs: Date.now() - started });

  track(key.id, { p_ok: true });
  const [clientStream, meterStream] = res.body!.tee();
  const headers = res.headers;
  (async () => {
    const reader = meterStream.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let usage: any = null;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const j = JSON.parse(payload);
            if (j?.usage) usage = j.usage;
            else if (j?.x_groq?.usage) usage = j.x_groq.usage;
          } catch { /* partial */ }
        }
      }
    } catch { /* ignore */ }
    await logAIUsage({
      ...base,
      status: 'ok',
      httpStatus: 200,
      headers,
      latencyMs: Date.now() - started,
      promptTokens: usage?.prompt_tokens,
      completionTokens: usage?.completion_tokens,
      totalTokens: usage?.total_tokens,
    });
  })();
  return { body: clientStream, provider: key.provider, keyId: key.id, keyLabel: key.label, model };
}

/** Feature-tagged wrappers — the featureKey is recorded in usage logs. */
export async function chatWithFeatureAI(featureKey: string, opts: ChatOptions): Promise<AIResult> {
  return chatWithPrimaryAI({ ...opts, feature: opts.feature ?? featureKey });
}

export async function streamWithFeatureAI(featureKey: string, opts: ChatOptions): Promise<StreamResult> {
  return streamWithPrimaryAI({ ...opts, feature: opts.feature ?? featureKey });
}

// List models a provider exposes (used by the admin dashboard).
export async function listProviderModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/models`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`Models request failed: HTTP ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return list
    .map((m: any) => m?.id)
    .filter((id: unknown): id is string => typeof id === 'string')
    .sort();
}
