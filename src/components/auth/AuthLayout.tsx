import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import logoMark from '@/assets/javaarena-logo.png';

interface AuthLayoutProps {
  children: ReactNode;
  /** Optional override for the brand mark (e.g. admin shield). */
  mark?: ReactNode;
  title?: string;
  tagline?: string;
  highlights?: string[];
}

const DEFAULT_HIGHLIGHTS = [
  'Striver, NeetCode and LeetCode Top 150 sheets',
  'Brute, better and optimal approaches side by side',
  'AI hints, reviews and relevant test cases',
];

/** Shared two-column auth shell: brand on the left, card on the right (stacked on mobile). */
export const AuthLayout = ({ children, mark, title = 'JavaLabs', tagline = 'Your AI-powered DSA practice environment', highlights = DEFAULT_HIGHLIGHTS }: AuthLayoutProps) => (
  <div className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-background px-4 py-10 min-[600px]:h-dvh min-[600px]:min-h-0 min-[600px]:overflow-hidden min-[600px]:py-4 min-[1024px]:px-10">
    <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:22px_22px] opacity-50 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
    <div className="relative w-full max-w-[420px] animate-in-up min-[600px]:grid min-[600px]:max-w-[1100px] min-[600px]:grid-cols-2 min-[600px]:items-center min-[600px]:gap-8 min-[1024px]:gap-16">
      <div className="mb-8 text-center min-[600px]:mb-0 min-[600px]:flex min-[600px]:flex-col min-[600px]:items-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground shadow-md ring-1 ring-border min-[600px]:h-24 min-[600px]:w-24">
          {mark ?? <img src={logoMark} alt="JavaLabs logo" width={1024} height={1024} className="h-9 w-9 invert dark:invert-0 min-[600px]:h-14 min-[600px]:w-14" />}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground min-[1024px]:text-4xl">{title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{tagline}</p>
        {highlights.length > 0 && (
          <ul className="mt-7 hidden space-y-2.5 text-left min-[600px]:block">
            {highlights.map(h => (
              <li key={h} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{h}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  </div>
);

export const AuthCard = ({ children }: { children: ReactNode }) => (
  <div className="surface-elevated rounded-2xl border border-border/60 p-7 min-[600px]:p-5 min-[1024px]:p-7">{children}</div>
);

export const AuthHeading = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <div className="mb-6 min-[600px]:mb-4">
    <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
    {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
  </div>
);

export const AuthAlert = ({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'success' }) => (
  <div role={tone === 'error' ? 'alert' : 'status'} className={`mb-4 rounded-xl border px-3.5 py-2.5 text-[13px] ${tone === 'error' ? 'border-destructive/25 bg-destructive/10 text-destructive' : 'border-success/25 bg-success/10 text-success'}`}>
    {children}
  </div>
);
