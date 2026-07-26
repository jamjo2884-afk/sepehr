'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  ChevronDown,
  LogOut,
  Menu as MenuIcon,
  Search,
  Settings,
  UserCircle,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useUIStore } from '@/stores/ui.store';
import { useAuthStore } from '@/stores/auth.store';
import { useIsMobile } from '@/hooks/use-media-query';
import { signOut } from '@/services/auth.service';
import { ROLE_LABELS } from '@/types/auth';
import {
  NOTIFICATIONS_LABEL,
  PROFILE_LABEL,
  SEARCH_PLACEHOLDER,
  WORKSPACE_LABEL,
} from '@/constants/ui.constants';
import { toPersianDigits } from '@/utils/persian';

const SAMPLE_NOTIFICATIONS = [
  {
    id: '1',
    title: 'سیستم به‌روزرسانی شد',
    description: 'نسخه ۰.۱ منتشر شد',
    read: false,
  },
  {
    id: '2',
    title: 'خوش آمدید',
    description: 'به مدیا اواس خوش آمدید',
    read: false,
  },
];

export function Header() {
  const router = useRouter();
  const { toggleSidebar } = useUIStore();
  const isMobile = useIsMobile();
  const profile = useAuthStore((s) => s.profile);
  const workspace = useAuthStore((s) => s.workspace);
  const [notifications, setNotifications] = useState(SAMPLE_NOTIFICATIONS);
  const [loggingOut, setLoggingOut] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () =>
    setNotifications((items) => items.map((n) => ({ ...n, read: true })));

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      router.replace('/login');
    } catch {
      setLoggingOut(false);
    }
  };

  const displayName = profile?.fullName || 'کاربر';
  const displayEmail = profile?.email || '—';
  const displayInitial = displayName.charAt(0) || 'م';
  const roleLabel = profile ? ROLE_LABELS[profile.role] : null;
  const workspaceName = workspace?.name || 'فضای کاری پیش‌فرض';

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur-md lg:px-6">
      {isMobile ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          aria-label="منو"
        >
          <MenuIcon className="h-5 w-5" />
        </Button>
      ) : null}

      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{WORKSPACE_LABEL}</span>
        <span className="text-sm font-semibold text-foreground">
          {workspaceName}
        </span>
      </div>

      <div className="relative mx-auto w-full max-w-md">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder={SEARCH_PLACEHOLDER}
          className="h-10 rounded-lg bg-secondary pr-9 text-sm"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label={NOTIFICATIONS_LABEL}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-80 rounded-xl border-border bg-popover p-0"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold">
                {NOTIFICATIONS_LABEL}
              </span>
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Check className="h-3 w-3" />
                خواندن همه
              </button>
            </div>
            <ul className="scrollbar-thin max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                  اعلانی وجود ندارد.
                </li>
              ) : (
                notifications.map((n) => (
                  <li
                    key={n.id}
                    className="flex gap-3 border-b border-border/60 px-4 py-3 last:border-0"
                  >
                    <span
                      className={
                        n.read
                          ? 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted'
                          : 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary'
                      }
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{n.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {n.description}
                      </span>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-secondary"
              aria-label={PROFILE_LABEL}
            >
              <Avatar className="h-8 w-8">
                {profile?.avatarUrl ? (
                  <AvatarImage src={profile.avatarUrl} alt={displayName} />
                ) : null}
                <AvatarFallback className="bg-primary/15 text-xs font-bold text-primary">
                  {displayInitial}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">
                {displayName}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 rounded-xl border-border bg-popover"
          >
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">{displayName}</span>
              <span
                className="text-xs font-normal text-muted-foreground"
                dir="ltr"
              >
                {displayEmail}
              </span>
              {roleLabel ? (
                <span className="mt-1 inline-flex w-fit items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {roleLabel}
                </span>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2">
              <UserCircle className="h-4 w-4" />
              پروفایل
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2">
              <Settings className="h-4 w-4" />
              تنظیمات حساب
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive"
              disabled={loggingOut}
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              {loggingOut ? 'در حال خروج…' : 'خروج از حساب'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <span className="sr-only">
        {toPersianDigits(unreadCount)} اعلان خوانده‌نشده
      </span>
    </header>
  );
}
