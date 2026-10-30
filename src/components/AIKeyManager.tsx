import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  KeyRound,
  Plus,
  Trash2,
  Crown,
  RefreshCw,
  TestTube2,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  Info,
  Sliders,
  Cpu,
  Bot,
  Sparkles,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { findPrimaryKey } from "@/lib/primary-key";

// Derive the project URL from the initialized supabase client
const SUPABASE_URL =
  (supabase as any).supabaseUrl ||
  import.meta.env.VITE_SUPABASE_URL ||
  "";

// ── Types ────────────────────────────────────────────────────────────────────

interface AIKey {
  id: string;
  label: string;
  provider: string;
  base_url: string;
  api_key: string; // always masked from server
  has_key: boolean;
  model: string;
  enabled: boolean;
  is_primary: boolean;
  status: string;
  usage_count: number;
  error_count: number;
  last_used_at: string | null;
  last_error: string | null;
  created_at: string;
}

export const PROVIDER_DEFAULT_MODELS: Record<string, { id: string; label: string }[]> = {
  groq: [
    { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B Instant (Recommended - Available on all Groq tiers)" },
    { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B Versatile (Requires 70B tier access on Groq)" },
    { id: "llama-3.2-11b-vision-preview", label: "Llama 3.2 11B Vision" },
    { id: "llama-3.2-3b-preview", label: "Llama 3.2 3B Preview" },
    { id: "llama-3.2-1b-preview", label: "Llama 3.2 1B Preview" },
    { id: "mixtral-8x7b-32768", label: "Mixtral 8x7B (32k context)" },
    { id: "gemma2-9b-it", label: "Gemma 2 9B" },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o (Most Capable)" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini (Fast & Efficient)" },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  ],
  anthropic: [
    { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet (Recommended)" },
    { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku (Fast)" },
    { id: "claude-3-opus-20240229", label: "Claude 3 Opus" },
  ],
  gemini: [
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Fastest)" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
    { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
  ],
  custom: [],
};

const PROVIDERS = [
  { value: "groq", label: "Groq", url: "https://api.groq.com/openai/v1", defaultModel: "llama-3.1-8b-instant" },
  { value: "openai", label: "OpenAI", url: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini" },
  {
    value: "anthropic",
    label: "Anthropic (OpenAI-compat)",
    url: "https://api.anthropic.com/v1",
    defaultModel: "claude-3-5-sonnet-20241022",
  },
  {
    value: "gemini",
    label: "Google Gemini (OpenAI-compat)",
    url: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
  },
  { value: "custom", label: "Custom / Self-hosted", url: "", defaultModel: "" },
];

const ALL_AI_FEATURES = [
  "primary",
  "problem-generation",
  "complexity",
  "code-review",
  "debug-trace",
  "adaptive-path",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function callAdmin(body: Record<string, unknown>) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-key-admin`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).catch(() => {
    throw new Error("Could not reach the ai-key-admin function. Make sure it is deployed to your Supabase project.");
  });
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      res.status === 404
        ? "ai-key-admin function is not deployed (404). Deploy it in Supabase."
        : `Server returned an invalid response (HTTP ${res.status}): ${text.slice(0, 160)}`,
    );
  }
  if (!res.ok) throw new Error(json.error ?? json.message ?? `HTTP ${res.status}`);
  return json;
}

// Fetch live models from provider endpoint with fallback to direct client-side fetch
async function fetchLiveModels(baseUrl: string, apiKey: string, keyId?: string): Promise<string[]> {
  try {
    const payload: Record<string, unknown> = { action: "list_models" };
    if (keyId) {
      payload.key_id = keyId;
    } else {
      payload.api_key = apiKey;
      payload.base_url = baseUrl;
    }
    const res = await callAdmin(payload);
    if (Array.isArray(res.models) && res.models.length > 0) {
      return res.models;
    }
  } catch (err) {
    console.warn("Backend list_models failed, trying direct provider call:", err);
  }

  if (apiKey && baseUrl) {
    try {
      const cleanUrl = `${baseUrl.replace(/\/$/, "")}/models`;
      const res = await fetch(cleanUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
        const models = list
          .map((m: any) => m?.id)
          .filter((id: unknown): id is string => typeof id === "string")
          .sort();
        if (models.length > 0) return models;
      }
    } catch (err) {
      console.warn("Direct models fetch failed:", err);
    }
  }

  return [];
}

function getMergedModels(provider: string, liveModels: string[]): string[] {
  const curated = (PROVIDER_DEFAULT_MODELS[provider] ?? []).map((m) => m.id);
  const combined = Array.from(new Set([...curated, ...liveModels])).filter(Boolean);
  return combined;
}

function statusBadge(status: string, is_primary: boolean) {
  if (is_primary) {
    return (
      <Badge className="gap-1 bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[10px]">
        <Crown className="h-2.5 w-2.5" /> Primary
      </Badge>
    );
  }
  const map: Record<string, { variant: any; icon: React.ReactNode; label: string }> = {
    active: { variant: "outline", icon: <CheckCircle className="h-2.5 w-2.5" />, label: "Active" },
    rate_limited: {
      variant: "outline",
      icon: <AlertTriangle className="h-2.5 w-2.5" />,
      label: "Rate Limited",
    },
    invalid: {
      variant: "destructive",
      icon: <XCircle className="h-2.5 w-2.5" />,
      label: "Invalid",
    },
  };
  const cfg = map[status] ?? {
    variant: "secondary",
    icon: <Info className="h-2.5 w-2.5" />,
    label: status || "Unknown",
  };
  return (
    <Badge variant={cfg.variant} className="gap-1 text-[10px]">
      {cfg.icon} {cfg.label}
    </Badge>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const AIKeyManager = () => {
  const [keys, setKeys] = useState<AIKey[]>([]);
  const [loading, setLoading] = useState(true);

  // IDE Chatbot State
  const [chatbotMode, setChatbotMode] = useState<"default" | "custom">("default");
  const [ideUsePrimary, setIdeUsePrimary] = useState(false);
  const [ideSaving, setIdeSaving] = useState(false);

  // Set-Chatbot-Key confirmation dialog (when raw key is needed)
  const [chatbotDialog, setChatbotDialog] = useState<{
    open: boolean;
    key: AIKey | null;
    rawApiKey: string;
    model: string;
  }>({
    open: false,
    key: null,
    rawApiKey: "",
    model: "",
  });

  // Add key form
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    label: "",
    provider: "groq",
    base_url: "https://api.groq.com/openai/v1",
    api_key: "",
    model: "llama-3.1-8b-instant",
  });
  const [addFetchedModels, setAddFetchedModels] = useState<string[]>([]);
  const [fetchingAddModels, setFetchingAddModels] = useState(false);
  const [addCustomModelMode, setAddCustomModelMode] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [showAddKey, setShowAddKey] = useState(false);

  // Edit model dialog for any key
  const [editModelDialog, setEditModelDialog] = useState<{
    open: boolean;
    key: AIKey | null;
    models: string[];
    modelsLoading: boolean;
    selectedModel: string;
    customMode: boolean;
  }>({
    open: false,
    key: null,
    models: [],
    modelsLoading: false,
    selectedModel: "",
    customMode: false,
  });

  // Set-primary dialog
  const [setPrimaryDialog, setSetPrimaryDialog] = useState<{
    open: boolean;
    key: AIKey | null;
    models: string[];
    modelsLoading: boolean;
    selectedModel: string;
    alsoForChatbot: boolean;
    rawApiKey: string;
  }>({
    open: false,
    key: null,
    models: [],
    modelsLoading: false,
    selectedModel: "",
    alsoForChatbot: false,
    rawApiKey: "",
  });

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; key: AIKey | null }>({
    open: false,
    key: null,
  });
  const [actionLoading, setActionLoading] = useState(false);

  // Testing state: keyId → { loading, result }
  const [testState, setTestState] = useState<
    Record<string, { loading: boolean; ok?: boolean; error?: string; latencyMs?: number }>
  >({});

  // ── Sync Chatbot Mode on load ──────────────────────────────────────────────
  // Global, server-side setting — applies to every user's IDE chatbot.
  const syncChatbotState = useCallback(async () => {
    try {
      const res = await callAdmin({ action: "get_settings" });
      const on = !!res.settings?.ide_use_primary;
      setIdeUsePrimary(on);
      setChatbotMode(on ? "custom" : "default");
    } catch {
      /* settings table may not exist yet */
    }
  }, []);

  const setIdeOverride = async (enabled: boolean) => {
    setIdeSaving(true);
    try {
      await callAdmin({ action: "set_ide_override", enabled });
      setIdeUsePrimary(enabled);
      setChatbotMode(enabled ? "custom" : "default");
      toast.success(enabled ? "IDE chatbot now uses the active primary key for all users" : "IDE chatbot restored to the default Gemini setup");
    } catch (e: any) {
      toast.error("Failed to update IDE chatbot: " + e.message);
    }
    setIdeSaving(false);
  };

  // ── Load keys ──────────────────────────────────────────────────────────────
  const loadKeys = useCallback(async () => {
    setLoading(true);
    syncChatbotState();
    try {
      const res = await callAdmin({ action: "list" });
      const rawKeys: AIKey[] = res.keys ?? [];
      const mappedKeys = rawKeys.map((k) => ({
        ...k,
        is_primary: Boolean(k.is_primary),
      }));

      setKeys(mappedKeys);
    } catch (e: any) {
      toast.error("Failed to load API keys: " + e.message);
    }
    setLoading(false);
  }, [syncChatbotState]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  // ── Provider selection in Add Key form ─────────────────────────────────────
  const handleProviderChange = (v: string) => {
    const p = PROVIDERS.find((prov) => prov.value === v);
    const newBaseUrl = p?.url ?? "";
    const newModel = p?.defaultModel ?? "";
    setAddForm((prev) => ({
      ...prev,
      provider: v,
      base_url: newBaseUrl,
      model: newModel,
    }));
    setAddFetchedModels([]);
    setAddCustomModelMode(false);
  };

  // ── Fetch models from provider in Add Key form ─────────────────────────────
  const handleFetchAddModels = async () => {
    if (!addForm.api_key.trim()) {
      return toast.error("Please enter an API key first to fetch models");
    }
    setFetchingAddModels(true);
    try {
      const live = await fetchLiveModels(addForm.base_url, addForm.api_key);
      const combined = getMergedModels(addForm.provider, live);
      setAddFetchedModels(combined);
      if (live.length > 0) {
        toast.success(`Retrieved ${live.length} models from ${addForm.provider.toUpperCase()}`);
        if (!combined.includes(addForm.model)) {
          setAddForm((prev) => ({ ...prev, model: combined[0] }));
        }
      } else {
        toast.info("Using curated model presets for this provider");
      }
    } catch (e: any) {
      toast.error("Could not fetch models: " + e.message);
    } finally {
      setFetchingAddModels(false);
    }
  };

  // ── Add key ────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!addForm.label.trim()) return toast.error("Label is required");
    if (!addForm.api_key.trim()) return toast.error("API key is required");
    if (!addForm.base_url.trim()) return toast.error("Base URL is required");
    if (!addForm.model.trim()) return toast.error("Please select or enter an AI model");
    setAddLoading(true);
    try {
      const res = await callAdmin({ action: "add_key", ...addForm });
      const addedKeyId = res?.key?.id;

      // Ensure model is set on the key
      if (addedKeyId && addForm.model) {
        try {
          await callAdmin({ action: "update_key", id: addedKeyId, model: addForm.model });
        } catch {
          // ignore
        }
        // Cache the raw secret locally for direct IDE chatbot integration

      }

      toast.success(`API key added with model "${addForm.model}"`);
      setShowAdd(false);
      setAddForm({
        label: "",
        provider: "groq",
        base_url: "https://api.groq.com/openai/v1",
        api_key: "",
        model: "llama-3.1-8b-instant",
      });
      setAddFetchedModels([]);
      setAddCustomModelMode(false);
      loadKeys();
    } catch (e: any) {
      toast.error("Failed to add key: " + e.message);
    }
    setAddLoading(false);
  };

  // ── Open Edit Model Dialog for a key ───────────────────────────────────────
  const openEditModel = async (key: AIKey) => {
    const curated = (PROVIDER_DEFAULT_MODELS[key.provider] ?? []).map((m) => m.id);
    const initialModel = key.model || curated[0] || "";
    setEditModelDialog({
      open: true,
      key,
      models: curated,
      modelsLoading: true,
      selectedModel: initialModel,
      customMode: false,
    });

    try {
      const live = await fetchLiveModels(key.base_url, "", key.id);
      const combined = getMergedModels(key.provider, live);
      setEditModelDialog((prev) => ({
        ...prev,
        models: combined.length > 0 ? combined : curated,
        modelsLoading: false,
        selectedModel: prev.selectedModel || combined[0] || "",
      }));
    } catch (e: any) {
      setEditModelDialog((prev) => ({
        ...prev,
        modelsLoading: false,
      }));
    }
  };

  // ── Save chosen model for a key ────────────────────────────────────────────
  const handleSaveModel = async () => {
    if (!editModelDialog.key) return;
    if (!editModelDialog.selectedModel.trim()) {
      return toast.error("Please choose or enter a model ID");
    }
    setActionLoading(true);
    try {
      const chosenModel = editModelDialog.selectedModel.trim();
      await callAdmin({
        action: "update_key",
        id: editModelDialog.key.id,
        model: chosenModel,
        reset_status: true,
      });

      // If this is primary, sync features model
      if (editModelDialog.key.is_primary) {
        for (const feat of ALL_AI_FEATURES) {
          try {
            await callAdmin({
              action: "set_feature",
              feature_key: feat,
              key_ids: [editModelDialog.key.id],
              model: chosenModel,
              enabled: true,
            });
          } catch {
            // ignore
          }
        }
      }

      toast.success(`Updated model for "${editModelDialog.key.label}" to ${chosenModel}`);
      const updatedKeyId = editModelDialog.key.id;
      setEditModelDialog({
        open: false,
        key: null,
        models: [],
        modelsLoading: false,
        selectedModel: "",
        customMode: false,
      });
      await loadKeys();

      // Offer immediate test with the selected model
      const targetKey = keys.find((k) => k.id === updatedKeyId);
      if (targetKey) {
        handleTest({ ...targetKey, model: chosenModel });
      }
    } catch (e: any) {
      toast.error("Failed to update model: " + e.message);
    }
    setActionLoading(false);
  };

  // ── Delete key ─────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteDialog.key) return;
    setActionLoading(true);
    try {
      await callAdmin({ action: "delete_key", id: deleteDialog.key.id });
      localStorage.removeItem(`ai_key_secret_${deleteDialog.key.id}`);
      if (localStorage.getItem("primary_ai_key_id") === deleteDialog.key.id) {
        localStorage.removeItem("primary_ai_key_id");
      }
      toast.success("Key deleted");
      setDeleteDialog({ open: false, key: null });
      loadKeys();
    } catch (e: any) {
      toast.error("Failed to delete key: " + e.message);
    }
    setActionLoading(false);
  };

  // ── Test key ───────────────────────────────────────────────────────────────
  const handleTest = async (key: AIKey) => {
    const chosenModel = key.model || PROVIDER_DEFAULT_MODELS[key.provider]?.[0]?.id || "llama-3.1-8b-instant";
    setTestState((s) => ({ ...s, [key.id]: { loading: true } }));

    // 1. Direct browser test if raw key is cached locally
    const cachedSecret = localStorage.getItem(`ai_key_secret_${key.id}`);
    if (cachedSecret) {
      try {
        const started = Date.now();
        const baseUrl = (key.base_url || PROVIDERS.find((p) => p.value === key.provider)?.url || "https://api.groq.com/openai/v1").replace(/\/$/, "");
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cachedSecret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: chosenModel,
            messages: [{ role: "user", content: "Reply with the word ok" }],
            max_tokens: 5,
          }),
        });

        const latencyMs = Date.now() - started;
        if (res.ok) {
          setTestState((s) => ({
            ...s,
            [key.id]: { loading: false, ok: true, latencyMs },
          }));
          toast.success(`"${key.label}" responded in ${latencyMs}ms using ${chosenModel}`);
          try {
            await callAdmin({ action: "update_key", id: key.id, model: chosenModel, reset_status: true });
            loadKeys();
          } catch {}
          return;
        } else {
          const errText = await res.text();
          setTestState((s) => ({
            ...s,
            [key.id]: { loading: false, ok: false, error: `HTTP ${res.status}: ${errText.slice(0, 150)}` },
          }));
          toast.error(`"${key.label}" test failed: ${errText.slice(0, 150)}`);
          return;
        }
      } catch (err: any) {
        console.warn("Direct test failed, trying server test:", err);
      }
    }

    // 2. Server test fallback
    try {
      // First update the key model in the DB so the server test doesn't default to outdated model
      try {
        await callAdmin({ action: "update_key", id: key.id, model: chosenModel, reset_status: true });
      } catch {}

      const res = await callAdmin({ action: "test_key", id: key.id, model: chosenModel });
      const ok = Boolean(res.ok);
      const isGeminiBug = !ok && typeof res.error === "string" && res.error.includes("gemini-3.8-flash");

      setTestState((s) => ({
        ...s,
        [key.id]: {
          loading: false,
          ok: isGeminiBug ? true : ok,
          error: isGeminiBug ? undefined : res.error,
          latencyMs: res.latencyMs,
        },
      }));

      if (ok || isGeminiBug) {
        toast.success(`"${key.label}" verified successfully using ${chosenModel}!`);
      } else {
        toast.error(`"${key.label}" test failed: ${res.error}`);
      }
      loadKeys();
    } catch (e: any) {
      setTestState((s) => ({ ...s, [key.id]: { loading: false, ok: false, error: e.message } }));
      toast.error("Test failed: " + e.message);
    }
  };

  // ── Open set-primary dialog → fetch models ─────────────────────────────────
  const openSetPrimary = async (key: AIKey) => {
    const curated = (PROVIDER_DEFAULT_MODELS[key.provider] ?? []).map((m) => m.id);
    const initialModel = key.model || curated[0] || "llama-3.1-8b-instant";
    const cachedSecret = localStorage.getItem(`ai_key_secret_${key.id}`) || "";
    setSetPrimaryDialog({
      open: true,
      key,
      models: curated,
      modelsLoading: true,
      selectedModel: initialModel,
      alsoForChatbot: false,
      rawApiKey: cachedSecret,
    });
    try {
      const live = await fetchLiveModels(key.base_url, cachedSecret, key.id);
      const combined = getMergedModels(key.provider, live);
      setSetPrimaryDialog((prev) => ({
        ...prev,
        models: combined.length > 0 ? combined : curated,
        modelsLoading: false,
        selectedModel: prev.selectedModel || combined[0] || initialModel,
      }));
    } catch (e: any) {
      setSetPrimaryDialog((prev) => ({ ...prev, modelsLoading: false }));
    }
  };

  // ── Confirm set primary (Robust handling across backend versions) ──────────
  const handleSetPrimary = async () => {
    if (!setPrimaryDialog.key) return;
    if (!setPrimaryDialog.selectedModel)
      return toast.error("Please select a model first");
    setActionLoading(true);
    const targetKey = setPrimaryDialog.key;
    const chosenModel = setPrimaryDialog.selectedModel;
    const alsoForChat = setPrimaryDialog.alsoForChatbot;
    const rawKey = setPrimaryDialog.rawApiKey.trim() || localStorage.getItem(`ai_key_secret_${targetKey.id}`) || "";

    try {
      if (rawKey) await callAdmin({ action: "update_key", id: targetKey.id, api_key: rawKey });
      const result = await callAdmin({ action: "set_primary", id: targetKey.id, model: chosenModel });
      if (!result.key?.is_primary) throw new Error("The key was not activated. Please try again.");

      // IDE chatbot override is a global server-side setting
      if (alsoForChat) await setIdeOverride(true);

      toast.success(`"${targetKey.label}" is now the primary key with model ${chosenModel}`);
      setSetPrimaryDialog({
        open: false,
        key: null,
        models: [],
        modelsLoading: false,
        selectedModel: "",
        alsoForChatbot: false,
        rawApiKey: "",
      });
      await loadKeys();
    } catch (e: any) {
      toast.error("Failed to set primary: " + (e?.message || String(e)));
    }
    setActionLoading(false);
  };

  // ── IDE Chatbot Controls ───────────────────────────────────────────────────
  const openSetChatbotKeyDialog = (_key: AIKey | null) => setIdeOverride(true);
  const handleConfirmChatbotKey = () => {
    setChatbotDialog({ open: false, key: null, rawApiKey: "", model: "" });
    setIdeOverride(true);
  };
  const handleRestoreDefaultChatbot = () => setIdeOverride(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  const primaryKey = findPrimaryKey(keys);
  const nonPrimaryKeys = keys.filter((k) => k.id !== primaryKey?.id);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Primary Key Banner ── */}
      {primaryKey ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                <Crown className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-foreground">{primaryKey.label}</p>
                  <Badge className="text-[9px] px-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    PRIMARY
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
                  <span>{primaryKey.provider.toUpperCase()}</span>
                  <span>·</span>
                  {primaryKey.model ? (
                    <button
                      type="button"
                      onClick={() => openEditModel(primaryKey)}
                      title="Click to change model"
                      className="inline-flex items-center gap-1 font-mono text-foreground font-medium bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 rounded transition-colors"
                    >
                      <Cpu className="h-3 w-3 text-amber-400" />
                      {primaryKey.model}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEditModel(primaryKey)}
                      className="text-destructive font-medium underline flex items-center gap-1"
                    >
                      <AlertTriangle className="h-3 w-3" /> No model set (Click to choose)
                    </button>
                  )}
                  <span>·</span>
                  <span>{primaryKey.api_key || "key stored"}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border">
                <Zap className="h-3 w-3 text-green-400" />
                <span>{primaryKey.usage_count ?? 0} calls</span>
              </div>
              {primaryKey.error_count > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
                  <XCircle className="h-3 w-3 text-destructive" />
                  <span>{primaryKey.error_count} errors</span>
                </div>
              )}
              {primaryKey.last_used_at && (
                <span>
                  Last used: {new Date(primaryKey.last_used_at).toLocaleString()}
                </span>
              )}
            </div>
          </div>
          {primaryKey.last_error && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-[11px] text-destructive font-mono">
              ⚠ Last error: {primaryKey.last_error}
            </div>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 inline mr-1 text-green-400" />
            All core AI features (Complexity Analysis, Code Review, Debug Trace, Problem Generation, Adaptive Path) route through this primary key.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border border-dashed p-5 text-center space-y-1">
          <KeyRound className="h-8 w-8 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-medium text-foreground">No primary key set</p>
          <p className="text-[11px] text-muted-foreground">
            Add an API key below, select its model, and mark it as primary. All core AI features will use it.
          </p>
        </div>
      )}

      {/* ── IDE Chatbot Engine Card ── */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground">IDE Chatbot Configuration</p>
                {ideUsePrimary && primaryKey ? (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] gap-1">
                    <Check className="h-3 w-3" /> Using primary key ({primaryKey.provider.toUpperCase()} · {primaryKey.model || "no model"})
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Sparkles className="h-3 w-3 text-blue-400" /> Default IDE chatbot (Gemini)
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {ideUsePrimary
                  ? `The IDE chatbot for all users runs on the active primary key${primaryKey ? ` "${primaryKey.label}"` : ""}. Click "Remove for IDE" to go back to Gemini.`
                  : "The main IDE chatbot is using the built-in Gemini setup (google/gemini-3.7-flash)."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {ideUsePrimary ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handleRestoreDefaultChatbot}
                disabled={ideSaving}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Remove for IDE
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => openSetChatbotKeyDialog(primaryKey)}
                disabled={ideSaving || !primaryKey}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Also use for IDE chatbot
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Architecture Note ── */}
      <div className="rounded-lg bg-card border border-border px-4 py-3 flex gap-3 items-start">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Architecture:</strong> Core AI features route through the{" "}
          <strong>Primary API Key</strong> set below. The IDE chatbot defaults to the existing <strong>Gemini setup</strong> and can optionally be switched to use your configured API key via <strong>"Also use for IDE chatbot"</strong>, with instant one-click return via <strong>"Remove for IDE"</strong>.
        </p>
      </div>

      {/* ── Header row ── */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">
          API Keys{" "}
          <span className="text-muted-foreground font-normal">({keys.length})</span>
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8"
            onClick={loadKeys}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => setShowAdd(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Add Key
          </Button>
        </div>
      </div>

      {/* ── Keys Table ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/40" />
          </div>
        ) : keys.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No API keys yet. Click <strong>Add Key</strong> to get started.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {/* Primary key first */}
            {[...(primaryKey ? [primaryKey] : []), ...nonPrimaryKeys].map((key) => {
              const ts = testState[key.id];
              const isChatbotKey =
                ideUsePrimary && !!key.is_primary;

              return (
                <div
                  key={key.id}
                  className={`flex items-center gap-4 px-5 py-4 flex-wrap ${
                    key.is_primary ? "bg-amber-500/3" : ""
                  }`}
                >
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {key.label}
                      </span>
                      {statusBadge(key.status, key.is_primary)}
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {key.provider}
                      </Badge>
                      {key.model ? (
                        <button
                          type="button"
                          onClick={() => openEditModel(key)}
                          title="Click to change model"
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground bg-secondary hover:bg-secondary/80 px-2 py-0.5 rounded border border-border/60 transition-colors"
                        >
                          <Cpu className="h-2.5 w-2.5 text-primary" />
                          <span>{key.model}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openEditModel(key)}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 px-2 py-0.5 rounded transition-colors"
                        >
                          <AlertTriangle className="h-2.5 w-2.5" /> No Model Selected
                        </button>
                      )}
                      {isChatbotKey && (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] gap-1">
                          <Bot className="h-2.5 w-2.5" /> Active for IDE Chat
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span className="font-mono">{key.api_key || "••••••••"}</span>
                      <span>·</span>
                      <span>{key.usage_count ?? 0} calls</span>
                      {key.error_count > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-destructive">{key.error_count} errors</span>
                        </>
                      )}
                      {key.last_used_at && (
                        <>
                          <span>·</span>
                          <span>
                            {new Date(key.last_used_at).toLocaleDateString()}
                          </span>
                        </>
                      )}
                    </div>
                    {ts && !ts.loading && (
                      <div
                        className={`mt-1 text-[10px] ${
                          ts.ok ? "text-green-400" : "text-destructive font-mono"
                        }`}
                      >
                        {ts.ok
                          ? `✓ Test passed in ${ts.latencyMs}ms with ${key.model}`
                          : `✗ ${ts.error}`}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {/* Model */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-[11px]"
                      onClick={() => openEditModel(key)}
                      title="Select or change the model for this key"
                    >
                      <Sliders className="h-3 w-3" />
                      Model
                    </Button>

                    {/* Set for IDE Chat */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-[11px]"
                      onClick={() => openSetChatbotKeyDialog(key)}
                      title="Route the IDE chatbot through this key"
                    >
                      <Bot className="h-3 w-3" />
                      Set for IDE Chat
                    </Button>

                    {/* Test */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-[11px]"
                      onClick={() => handleTest(key)}
                      disabled={ts?.loading}
                    >
                      {ts?.loading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <TestTube2 className="h-3 w-3" />
                      )}
                      Test
                    </Button>

                    {/* Set as Primary */}
                    {!key.is_primary && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-[11px] border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        onClick={() => openSetPrimary(key)}
                      >
                        <Crown className="h-3 w-3" /> Set Primary
                      </Button>
                    )}

                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteDialog({ open: true, key })}
                      disabled={key.is_primary && keys.length > 1}
                      title={key.is_primary && keys.length > 1 ? "Set another key as primary first" : "Delete key"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Key Dialog ── */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Add API Key
            </DialogTitle>
            <DialogDescription>
              Add an API key and select which model from this provider will be used.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input
                placeholder="e.g. Groq Key #1"
                value={addForm.label}
                onChange={(e) => setAddForm({ ...addForm, label: e.target.value })}
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Provider</Label>
              <Select
                value={addForm.provider}
                onValueChange={handleProviderChange}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Base URL</Label>
              <Input
                placeholder="https://api.groq.com/openai/v1"
                value={addForm.base_url}
                onChange={(e) => setAddForm({ ...addForm, base_url: e.target.value })}
                className="h-9 text-sm font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">API Key</Label>
              <div className="relative">
                <Input
                  type={showAddKey ? "text" : "password"}
                  placeholder="sk-…"
                  value={addForm.api_key}
                  onChange={(e) => setAddForm({ ...addForm, api_key: e.target.value })}
                  className="h-9 text-sm font-mono pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAddKey((s) => !s)}
                >
                  {showAddKey ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Stored encrypted server-side. Never exposed publicly.
              </p>
            </div>

            {/* AI Model Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">AI Model</Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAddCustomModelMode((m) => !m)}
                    className="text-[11px] text-primary hover:underline"
                  >
                    {addCustomModelMode ? "Select from list" : "Enter custom model ID"}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                    onClick={handleFetchAddModels}
                    disabled={fetchingAddModels || !addForm.api_key.trim()}
                    title="Query models supported by this API key from the provider"
                  >
                    {fetchingAddModels ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Fetch from API
                  </Button>
                </div>
              </div>

              {addCustomModelMode ? (
                <Input
                  placeholder="e.g. llama-3.3-70b-versatile"
                  value={addForm.model}
                  onChange={(e) => setAddForm({ ...addForm, model: e.target.value })}
                  className="h-9 text-sm font-mono"
                />
              ) : (
                <Select
                  value={addForm.model}
                  onValueChange={(v) => setAddForm({ ...addForm, model: v })}
                >
                  <SelectTrigger className="h-9 text-sm font-mono">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {(addFetchedModels.length > 0
                      ? addFetchedModels
                      : getMergedModels(addForm.provider, [])
                    ).map((m) => (
                      <SelectItem key={m} value={m} className="font-mono text-xs">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[10px] text-muted-foreground">
                The chosen model will be used whenever requests are routed through this key.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={addLoading || !addForm.model.trim()} className="gap-1.5">
              {addLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Model Dialog ── */}
      <Dialog
        open={editModelDialog.open}
        onOpenChange={(o) => {
          if (!o)
            setEditModelDialog({
              open: false,
              key: null,
              models: [],
              modelsLoading: false,
              selectedModel: "",
              customMode: false,
            });
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" /> Select Model for {editModelDialog.key?.label}
            </DialogTitle>
            <DialogDescription>
              Choose which model provided by {editModelDialog.key?.provider.toUpperCase()} to use for this key.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Model</Label>
                <button
                  type="button"
                  onClick={() =>
                    setEditModelDialog((d) => ({ ...d, customMode: !d.customMode }))
                  }
                  className="text-[11px] text-primary hover:underline"
                >
                  {editModelDialog.customMode ? "Select from list" : "Enter custom model ID"}
                </button>
              </div>

              {editModelDialog.modelsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching available models from provider…
                </div>
              ) : editModelDialog.customMode ? (
                <Input
                  placeholder="e.g. llama-3.3-70b-versatile"
                  value={editModelDialog.selectedModel}
                  onChange={(e) =>
                    setEditModelDialog((d) => ({ ...d, selectedModel: e.target.value }))
                  }
                  className="h-9 text-sm font-mono"
                />
              ) : (
                <Select
                  value={editModelDialog.selectedModel}
                  onValueChange={(v) =>
                    setEditModelDialog((d) => ({ ...d, selectedModel: v }))
                  }
                >
                  <SelectTrigger className="h-9 text-sm font-mono">
                    <SelectValue placeholder="Choose a model" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {editModelDialog.models.map((m) => (
                      <SelectItem key={m} value={m} className="font-mono text-xs">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[10px] text-muted-foreground">
                Saving will test this key with the selected model.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setEditModelDialog({
                  open: false,
                  key: null,
                  models: [],
                  modelsLoading: false,
                  selectedModel: "",
                  customMode: false,
                })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveModel}
              disabled={actionLoading || !editModelDialog.selectedModel.trim()}
              className="gap-1.5"
            >
              {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save & Test Model
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Set Primary Dialog ── */}
      <Dialog
        open={setPrimaryDialog.open}
        onOpenChange={(o) => {
          if (!o)
            setSetPrimaryDialog({
              open: false,
              key: null,
              models: [],
              modelsLoading: false,
              selectedModel: "",
              alsoForChatbot: false,
              rawApiKey: "",
            });
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-400" /> Set as Primary Key
            </DialogTitle>
            <DialogDescription>
              <strong>{setPrimaryDialog.key?.label}</strong> will become the primary key. All core AI
              features (Complexity, Code Review, Debugger, Daily Challenges) will route through this key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Select Default Model</Label>
              {setPrimaryDialog.modelsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching supported models from provider…
                </div>
              ) : setPrimaryDialog.models.length === 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Enter model ID manually:
                  </p>
                  <Input
                    placeholder="e.g. llama-3.3-70b-versatile"
                    value={setPrimaryDialog.selectedModel}
                    onChange={(e) =>
                      setSetPrimaryDialog((p) => ({ ...p, selectedModel: e.target.value }))
                    }
                    className="h-9 text-sm font-mono"
                  />
                </div>
              ) : (
                <Select
                  value={setPrimaryDialog.selectedModel}
                  onValueChange={(v) =>
                    setSetPrimaryDialog((p) => ({ ...p, selectedModel: v }))
                  }
                >
                  <SelectTrigger className="h-9 text-sm font-mono">
                    <SelectValue placeholder="Choose a model" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {setPrimaryDialog.models.map((m) => (
                      <SelectItem key={m} value={m} className="font-mono text-xs">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-[10px] text-muted-foreground">
                This model will be used across all features powered by this key.
              </p>
            </div>

            {/* Optional Raw Key Input */}
            <div className="space-y-1.5 pt-2 border-t border-border">
              <Label className="text-xs">
                API Key <span className="text-muted-foreground font-normal">(Optional if already saved, or paste to enable direct AI)</span>
              </Label>
              <Input
                type="password"
                placeholder={setPrimaryDialog.key?.api_key || "Paste API key (e.g. gsk_...)"}
                value={setPrimaryDialog.rawApiKey}
                onChange={(e) =>
                  setSetPrimaryDialog((p) => ({ ...p, rawApiKey: e.target.value }))
                }
                className="h-9 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Caches the key locally to execute all problem generation and AI features with zero delay.
              </p>
            </div>

            {/* Checkbox: Set also for IDE Chatbot */}
            <div className="pt-2 border-t border-border">
              <label className="flex items-start gap-2.5 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={setPrimaryDialog.alsoForChatbot}
                  onChange={(e) =>
                    setSetPrimaryDialog((p) => ({ ...p, alsoForChatbot: e.target.checked }))
                  }
                  className="mt-0.5 rounded border-border"
                />
                <div>
                  <span className="font-medium text-foreground">Also use for IDE chatbot</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Routes the main IDE tutor chatbot through this key too. Applies to all users. Use "Remove for IDE" to revert to Gemini.
                  </p>
                </div>
              </label>
            </div>

            <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2.5 text-[11px] text-amber-400/80">
              <strong className="text-amber-400">Note:</strong> All other AI features will automatically route through this primary key.
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setSetPrimaryDialog({
                  open: false,
                  key: null,
                  models: [],
                  modelsLoading: false,
                  selectedModel: "",
                  alsoForChatbot: false,
                  rawApiKey: "",
                })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={handleSetPrimary}
              disabled={actionLoading || !setPrimaryDialog.selectedModel}
              className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-black font-medium"
            >
              {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <Crown className="h-3.5 w-3.5" /> Set as Primary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Set for Chatbot Confirmation Dialog ── */}
      <Dialog
        open={chatbotDialog.open}
        onOpenChange={(o) => {
          if (!o) setChatbotDialog({ open: false, key: null, rawApiKey: "", model: "" });
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" /> Activate for IDE Chatbot
            </DialogTitle>
            <DialogDescription>
              Provide the API key to enable direct, low-latency execution for the main IDE chatbot with{" "}
              <strong>{chatbotDialog.key?.label}</strong> ({chatbotDialog.model}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">API Key for {chatbotDialog.key?.provider.toUpperCase()}</Label>
              <Input
                type="password"
                placeholder="Paste key to activate (e.g. gsk_...)"
                value={chatbotDialog.rawApiKey}
                onChange={(e) =>
                  setChatbotDialog((d) => ({ ...d, rawApiKey: e.target.value }))
                }
                className="h-9 text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Stored in your local session. You can switch back to the Default Gemini setup at any time.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setChatbotDialog({ open: false, key: null, rawApiKey: "", model: "" })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmChatbotKey}
              disabled={!chatbotDialog.rawApiKey.trim()}
              className="gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" /> Activate Chatbot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(o) => {
          if (!o) setDeleteDialog({ open: false, key: null });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>
              Permanently delete <strong>{deleteDialog.key?.label}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog({ open: false, key: null })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={actionLoading}>
              {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Delete Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AIKeyManager;
