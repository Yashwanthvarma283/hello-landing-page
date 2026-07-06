import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/lib/user-context';

export interface ActiveEffect {
  item_slug: string;
  category: string;
  equipped: boolean;
  expires_at: string | null;
  meta: Record<string, any> | null;
  name: string;
}

interface Ctx {
  effects: ActiveEffect[];
  equipped: Record<string, ActiveEffect>; // by equip_group
  loading: boolean;
  refresh: () => Promise<void>;
  equip: (slug: string) => Promise<{ ok: boolean; error?: string }>;
  unequip: (slug: string) => Promise<{ ok: boolean; error?: string }>;
  isEquipped: (slug: string) => boolean;
  hasGroupEquipped: (group: string) => ActiveEffect | undefined;
  consumeExtraHint: () => Promise<boolean>;
}

const ActiveEffectsContext = createContext<Ctx>({
  effects: [], equipped: {}, loading: false,
  refresh: async () => {},
  equip: async () => ({ ok: false }),
  unequip: async () => ({ ok: false }),
  isEquipped: () => false,
  hasGroupEquipped: () => undefined,
  consumeExtraHint: async () => false,
});

export const useActiveEffects = () => useContext(ActiveEffectsContext);

export function ActiveEffectsProvider({ children }: { children: ReactNode }) {
  const { authUser } = useUser();
  const [effects, setEffects] = useState<ActiveEffect[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!authUser?.id) { setEffects([]); return; }
    setLoading(true);
    try {
      const { data } = await (supabase as any).rpc('get_active_effects', { _user_id: authUser.id });
      setEffects((data ?? []) as ActiveEffect[]);
    } finally { setLoading(false); }
  }, [authUser?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  // Best-effort daily login coin claim (idempotent server-side)
  useEffect(() => {
    if (!authUser?.id) return;
    (supabase as any).rpc('award_coins', {
      _user_id: authUser.id,
      _rule_key: 'daily_login',
      _claim_key: new Date().toISOString().slice(0, 10),
    }).then(() => refresh()).catch(() => {});
  }, [authUser?.id, refresh]);

  const equipped: Record<string, ActiveEffect> = {};
  for (const e of effects) {
    if (!e.equipped) continue;
    const group = (e.meta?.equip_group as string) || e.item_slug;
    equipped[group] = e;
  }

  // Apply body-level effect classes
  useEffect(() => {
    const body = document.body;
    const classesToRemove: string[] = [];
    body.classList.forEach(c => {
      if (c.startsWith('theme-') || c.startsWith('fx-')) classesToRemove.push(c);
    });
    classesToRemove.forEach(c => body.classList.remove(c));

    const themeFx = equipped['theme'];
    if (themeFx?.meta?.theme_class) body.classList.add(String(themeFx.meta.theme_class));
    if (equipped['console_colors']) body.classList.add('fx-console-colors');
    if (equipped['banner']) body.classList.add('fx-banner');
    if (equipped['name_glow']) body.classList.add('fx-name-glow');
    if (equipped['avatar_pulse']) body.classList.add('fx-avatar-pulse');
    if (equipped['avatar_frame']) {
      const fc = equipped['avatar_frame'].meta?.frame_class;
      if (fc) body.classList.add(`fx-${String(fc)}`);
    }
    if (equipped['profile_title']) {
      const label = String(equipped['profile_title'].meta?.label || 'PRO').toLowerCase();
      body.classList.add(label === 'legend' ? 'fx-title-legend' : 'fx-pro-title');
    }
    if (equipped['name_glow']?.meta?.effect === 'rainbow') body.classList.add('fx-name-rainbow');
    if (equipped['editor_bg']?.meta?.bg === 'matrix') body.classList.add('fx-editor-matrix');
    if (equipped['submission_effect']) body.classList.add('fx-submission-confetti');
    if (equipped['xp_boost']) body.classList.add('fx-xp-boost');
  }, [equipped]);

  const equip = async (slug: string) => {
    const { error } = await (supabase as any).rpc('equip_item', { _item_slug: slug });
    if (error) return { ok: false, error: error.message };
    await refresh();
    return { ok: true };
  };
  const unequip = async (slug: string) => {
    const { error } = await (supabase as any).rpc('unequip_item', { _item_slug: slug });
    if (error) return { ok: false, error: error.message };
    await refresh();
    return { ok: true };
  };
  const consumeExtraHint = async (): Promise<boolean> => {
    const { data } = await (supabase as any).rpc('consume_extra_hint');
    await refresh();
    return Boolean(data);
  };

  const isEquipped = (slug: string) => effects.some(e => e.item_slug === slug && e.equipped);
  const hasGroupEquipped = (group: string) => equipped[group];

  return (
    <ActiveEffectsContext.Provider value={{
      effects, equipped, loading, refresh, equip, unequip, isEquipped, hasGroupEquipped, consumeExtraHint,
    }}>
      {children}
    </ActiveEffectsContext.Provider>
  );
}

// --- Helper: fire submission confetti only if user has effect equipped ---
export async function triggerSubmissionConfetti() {
  if (!document.body.classList.contains('fx-submission-confetti')) return;
  const colors = ['#fbbf24', '#22c55e', '#3b82f6', '#ec4899'];
  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden';
  document.body.appendChild(root);
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('div');
    const size = 6 + Math.random() * 6;
    p.style.cssText = `position:absolute;top:-10px;left:${Math.random() * 100}%;width:${size}px;height:${size}px;background:${colors[i % colors.length]};border-radius:2px;animation:fx-fall ${1 + Math.random() * 1.5}s linear forwards;transform:rotate(${Math.random() * 360}deg)`;
    root.appendChild(p);
  }
  setTimeout(() => root.remove(), 2800);
}
