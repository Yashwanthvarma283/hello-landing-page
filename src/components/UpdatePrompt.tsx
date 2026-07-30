import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CHECK_INTERVAL_MS = 60_000;

/** Extract a build fingerprint from index.html (hashed asset filenames). */
function fingerprint(html: string) {
  const matches = html.match(/(?:src|href)="[^"]*\/assets\/[^"]+"/g);
  return matches ? matches.sort().join('|') : null;
}

function isPreviewContext() {
  if (!import.meta.env.PROD) return true;
  if (typeof window === 'undefined') return true;
  if (window.self !== window.top) return true;
  const h = window.location.hostname;
  return (
    h.startsWith('id-preview--') ||
    h.startsWith('preview--') ||
    h === 'localhost' ||
    h.endsWith('.lovableproject.com') ||
    h.endsWith('.lovableproject-dev.com') ||
    h.endsWith('.beta.lovable.dev')
  );
}

const UpdatePrompt = () => {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const baseline = useRef<string | null>(null);

  useEffect(() => {
    if (isPreviewContext()) return;
    let cancelled = false;

    const check = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await fetch(`/index.html?_=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const fp = fingerprint(await res.text());
        if (!fp || cancelled) return;
        if (baseline.current === null) {
          baseline.current = fp;
        } else if (baseline.current !== fp) {
          setAvailable(true);
        }
      } catch {
        /* offline or blocked — ignore */
      }
    };

    check();
    const id = window.setInterval(check, CHECK_INTERVAL_MS);
    window.addEventListener('focus', check);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener('focus', check);
    };
  }, []);

  if (!available || dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-[100] flex justify-center px-4 sm:bottom-6">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-border bg-card p-4 animate-in-up"
        style={{ boxShadow: 'var(--shadow-lg)' }}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">A new version is available</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Reload to get the latest features and fixes.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="h-8 rounded-lg text-xs" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Update now
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-lg text-xs"
              onClick={() => setDismissed(true)}
            >
              Later
            </Button>
          </div>
        </div>
        <button
          aria-label="Dismiss update notification"
          onClick={() => setDismissed(true)}
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default UpdatePrompt;
