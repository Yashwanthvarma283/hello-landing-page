import { useId, useState, type ComponentType, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  icon: ComponentType<{ className?: string }>;
  hint?: ReactNode;
  action?: ReactNode;
}

/** Labelled input with leading icon and a show/hide toggle for passwords. */
export const AuthField = ({ label, icon: Icon, hint, action, type = 'text', ...props }: AuthFieldProps) => {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  return (
    <div className="mb-4 min-[600px]:mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <label htmlFor={id} className="text-[13px] font-medium text-foreground">{label}</label>
        {action}
      </div>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
        <Input
          id={id}
          type={isPassword && visible ? 'text' : type}
          className={`h-11 rounded-xl border-border/70 bg-secondary/30 pl-10 text-sm transition-colors focus:bg-background min-[600px]:h-10 ${isPassword ? 'pr-10' : ''}`}
          {...props}
        />
        {isPassword && (
          <button type="button" onClick={() => setVisible(v => !v)} aria-label={visible ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
};
