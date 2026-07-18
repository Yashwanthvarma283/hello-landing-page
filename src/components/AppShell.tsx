import { ReactNode, useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, LayoutGrid, User, LogOut, Settings as SettingsIcon, Menu as MenuIcon,
  Moon, Sun, Search, Flame, Shield, Coins
} from 'lucide-react';
import CoinBadge from './CoinBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/lib/theme-context';
import { useUser } from '@/lib/user-context';
import { signOut } from '@/lib/supabase';
import { ReportIssueDialog } from './ReportIssueDialog';
import { useStreak, StreakBars } from '@/lib/streak';

interface AppShellProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  bare?: boolean;
  hideMobileNav?: boolean;
}

export function HeaderMenu() {
  const navigate = useNavigate();
  const { authUser, isAdmin } = useUser();
  const initials = useMemo(
    () => (authUser?.email || 'You').split('@')[0].slice(0, 2).toUpperCase(),
    [authUser]
  );
  const handleLogout = async () => { await signOut(); navigate('/'); };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Menu">
          <MenuIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-60 p-1.5">
        <DropdownMenuLabel className="flex items-center gap-2.5 py-2 px-2">
          <div data-avatar-frame className="h-9 w-9 rounded-full bg-foreground text-background flex items-center justify-center text-[11px] font-semibold shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div data-user-name className="text-[12px] font-semibold truncate">{authUser?.email?.split('@')[0] || 'Guest'}</div>
            <div className="text-[10px] text-muted-foreground truncate font-normal">{authUser?.email || 'Sign in'}</div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/')} className="gap-2.5 py-2 cursor-pointer">
          <Home className="h-4 w-4" /> Home
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/modules')} className="gap-2.5 py-2 cursor-pointer">
          <LayoutGrid className="h-4 w-4" /> Menu
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/profile')} className="gap-2.5 py-2 cursor-pointer">
          <User className="h-4 w-4" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('/settings')} className="gap-2.5 py-2 cursor-pointer">
          <SettingsIcon className="h-4 w-4" /> Settings
        </DropdownMenuItem>
        {isAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/admin')} className="gap-2.5 py-2 cursor-pointer">
              <Shield className="h-4 w-4" /> Admin Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/admin/coins')} className="gap-2.5 py-2 cursor-pointer">
              <Coins className="h-4 w-4" /> Coins Admin
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="gap-2.5 py-2 cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function StreakChip() {
  const { current, weekActivity } = useStreak();
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 h-8 sm:h-9 rounded-md border border-border bg-secondary/40">
      <Flame className={`h-3.5 w-3.5 ${current > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
      <span className="text-[12px] font-semibold tabular-nums">{current}</span>
      <span className="hidden xs:inline-flex sm:inline-flex"><StreakBars data={weekActivity} color="hsl(var(--primary))" height={14} /></span>
    </div>
  );
}

function Topbar({ title, subtitle, actions }: { title?: string; subtitle?: string; actions?: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center gap-2 px-3 sm:px-4 border-b border-border glass">
      <HeaderMenu />
      <button onClick={() => navigate('/')} className="hidden md:flex items-center gap-2 group">
        <div className="h-7 w-7 rounded-md bg-foreground text-background flex items-center justify-center shrink-0">
          <span className="text-[11px] font-bold">J</span>
        </div>
        <span className="text-[13px] font-semibold tracking-tight">JavaArena</span>
      </button>
      {(title || subtitle) && (
        <div className="min-w-0 flex-1 ml-2">
          {title && <div className="text-[13px] font-semibold tracking-tight truncate leading-none">{title}</div>}
          {subtitle && <div className="text-[11px] text-muted-foreground truncate mt-1 leading-none">{subtitle}</div>}
        </div>
      )}
      {!title && !subtitle && (
        <div className="flex-1 max-w-sm ml-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search problems, topics…"
              className="h-8 pl-8 text-[12px] bg-secondary/60 border-transparent focus-visible:bg-background focus-visible:border-border"
              onFocus={() => navigate('/search')}
              readOnly
            />
          </div>
        </div>
      )}
      <div className="flex items-center gap-1 shrink-0">
        {actions}
        <StreakChip />
        <CoinBadge className="hidden xs:inline-flex sm:inline-flex mr-1" />
        <ReportIssueDialog pageTitle={title} />
        <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9" aria-label="Toggle theme">
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
}

export default function AppShell({ children, title, subtitle, actions, bare = false, hideMobileNav = false }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const mobileNavItems = [
    { title: 'Home', url: '/', icon: Home },
    { title: 'Menu', url: '/modules', icon: LayoutGrid },
    { title: 'Search', url: '/search', icon: Search },
    { title: 'Profile', url: '/profile', icon: User },
    { title: 'Settings', url: '/settings', icon: SettingsIcon },
  ];

  return (
    <div className="h-screen h-[100dvh] flex flex-col w-full bg-background overflow-hidden relative">
      {!bare && <Topbar title={title} subtitle={subtitle} actions={actions} />}
      <main className={`app-shell-main flex-1 min-w-0 relative ${!hideMobileNav ? 'pb-[56px] md:pb-0' : 'pb-0'} ${bare ? 'overflow-hidden' : 'overflow-auto'}`}>
        {bare ? (
          <div className="h-full w-full">{children}</div>
        ) : (
          <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">{children}</div>
        )}
      </main>

      {!hideMobileNav && (
        <nav
          className="md:hidden fixed left-0 right-0 bg-card border-t border-border z-[1000] flex items-center justify-around px-2"
          style={{ bottom: '0px', height: '56px' }}
        >
          {mobileNavItems.map((item) => {
            const isActive = location.pathname === item.url || (item.url !== '/' && location.pathname.startsWith(item.url));
            return (
              <button
                key={item.title}
                onClick={() => navigate(item.url)}
                className={`flex flex-col items-center gap-1 transition-all duration-200 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10' : ''}`}>
                  <item.icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} />
                </div>
                <span className="text-[10px] font-medium tracking-tight">{item.title}</span>
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
