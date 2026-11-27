import { useSyncExternalStore } from 'react';

export interface EditorSettings {
  suggestions: boolean;
  liveTemplates: boolean;
  autoCloseBrackets: boolean;
  fontSize: number;
  minimap: boolean;
  wordWrap: boolean;
  lineNumbers: boolean;
  stickyScroll: boolean;
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  suggestions: true,
  liveTemplates: true,
  autoCloseBrackets: true,
  fontSize: 14,
  minimap: false,
  wordWrap: false,
  lineNumbers: true,
  stickyScroll: true,
};

const KEY = 'javalabs_editor_settings';
const listeners = new Set<() => void>();
let cache: EditorSettings | null = null;

export function getEditorSettings(): EditorSettings {
  if (cache) return cache;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    cache = { ...DEFAULT_EDITOR_SETTINGS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    cache = { ...DEFAULT_EDITOR_SETTINGS };
  }
  return cache!;
}

export function updateEditorSettings(patch: Partial<EditorSettings>) {
  cache = { ...getEditorSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function resetEditorSettings() {
  updateEditorSettings({ ...DEFAULT_EDITOR_SETTINGS });
}

export function useEditorSettings(): EditorSettings {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    getEditorSettings,
    getEditorSettings,
  );
}
