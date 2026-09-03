'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  ChevronDown,
  LogOut,
  Menu as MenuIcon,
  Moon,
  Search,
  Settings,
  Sun,
  UserCircle,
} from 'lucide-react';
import { useTheme } from 'next-themes';
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
import { isDemoModeClient } from '@/lib/demo';
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
    description: 'به Media Deck خوش آمدید',
    read: false,
  },
];

interface SearchBoard {
  id: string;
  title: string;
  backgroundColor?: string | null;
  backgroundImage?: string | null;
}

interface SearchCard {
  id: string;
  title: string;
  description?: string | null;
  board: { id: string; title: string };
  list: { title: string };
}

interface SearchMember {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

interface SearchLabel {
  id: string;
  name: string;
  color: string;
}

interface SearchResults {
  boards: SearchBoard[];
  cards: SearchCard[];
  members: SearchMember[];
  labels: SearchLabel[];
}

export function Header() {
  const router = useRouter();
  const { toggleSidebar } = useUIStore();
  const isMobile = useIsMobile();
  const { resolvedTheme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => setThemeMounted(true), []);
  const isDark = themeMounted && resolvedTheme === 'dark';
  const profile = useAuthStore((s) => s.profile);
  const workspace = useAuthStore((s) => s.workspace);
  const [notifications, setNotifications] = useState(SAMPLE_NOTIFICATIONS);
  const [loggingOut, setLoggingOut] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Global search (FlowBoard) — debounced fetch into the header search box.
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  const runSearch = useCallback(async (q: string) => {
    setSearching(true);
    setSearchFailed(false);
    try {
      const res = await fetch(
        `/api/flowboard/search?q=${encodeURIComponent(q)}`,
      );
      if (!res.ok) {
        setSearchFailed(true);
        setSearchResults(null);
        return;
      }
      setSearchResults(await res.json());
    } catch {
      setSearchFailed(true);
      setSearchResults(null);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const q = value.trim();
    if (!q) {
      setSearchOpen(false);
      setSearchResults(null);
      setSearching(false);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      return;
    }
    setSearchOpen(true);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      void runSearch(q);
    }, 250);
  };

  // Close the results when clicking outside the search box.
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  useEffect(
    () => () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    },
    [],
  );

  const resultCount = searchResults
    ? searchResults.boards.length +
      searchResults.cards.length +
      searchResults.members.length +
      searchResults.labels.length
    : 0;

  const markAllRead = () =>
    setNotifications((items) => items.map((n) => ({ ...n, read: true })));

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      // Real auth mode returns to /login (the provider resets the store on
      // SIGNED_OUT); demo mode keeps the demo dashboard.
      router.replace(isDemoModeClient() ? '/command-center' : '/login');
    } catch {
      setLoggingOut(false);
    }
  };

  const displayName = profile?.fullName || 'کاربر';
  const displayEmail = profile?.email || '—';
  const displayInitial = displayName.charAt(0) || 'م';
  const roleLabel = profile ? ROLE_LABELS[profile.role] : null;
  const workspaceName = workspace?.name || 'Media Deck';

  return (
    <header className="sticky top-0 z-20 flex h-16 min-w-0 items-center gap-2 border-b border-border bg-surface/80 px-2 backdrop-blur-md sm:gap-3 sm:px-4 lg:px-6">
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

      <div className="hidden min-w-0 shrink-0 flex-col sm:flex">
        <span className="text-xs text-muted-foreground">{WORKSPACE_LABEL}</span>
        <span className="text-sm font-semibold text-foreground">
          {workspaceName}
        </span>
      </div>

      <div ref={searchBoxRef} className="relative mx-0 min-w-0 flex-1 sm:mx-auto sm:max-w-md">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={(e) => {
            if (e.target.value.trim()) setSearchOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setSearchOpen(false);
          }}
          placeholder={SEARCH_PLACEHOLDER}
          className="h-10 rounded-lg bg-secondary pr-9 text-sm"
        />
        {searchOpen ? (
          <div
            dir="rtl"
            className="absolute right-0 top-full z-50 mt-2 max-h-96 w-full overflow-y-auto rounded-xl border border-border bg-popover shadow-lg"
          >
            {searching ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-4 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : searchFailed ? (
              <p className="px-4 py-6 text-center text-sm text-destructive">
                جستجو ناموفق بود.
              </p>
            ) : searchResults && resultCount === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                نتیجه‌ای یافت نشد.
              </p>
            ) : searchResults ? (
              <div className="divide-y divide-border/60">
                {searchResults.boards.length > 0 ? (
                  <section className="px-1 py-2">
                    <h3 className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                      تخته‌ها ({searchResults.boards.length})
                    </h3>
                    {searchResults.boards.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          router.push(`/tasks/boards/${b.id}`);
                          setSearchOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-right text-sm hover:bg-secondary"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: b.backgroundColor || '#0079bf' }}
                        />
                        <span className="truncate">{b.title}</span>
                      </button>
                    ))}
                  </section>
                ) : null}
                {searchResults.cards.length > 0 ? (
                  <section className="px-1 py-2">
                    <h3 className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                      کارت‌ها ({searchResults.cards.length})
                    </h3>
                    {searchResults.cards.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          router.push(`/tasks/boards/${c.board.id}?card=${c.id}`);
                          setSearchOpen(false);
                        }}
                        className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-1.5 text-right text-sm hover:bg-secondary"
                      >
                        <span className="truncate font-medium">{c.title}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {c.board.title} › {c.list.title}
                        </span>
                      </button>
                    ))}
                  </section>
                ) : null}
                {searchResults.members.length > 0 ? (
                  <section className="px-1 py-2">
                    <h3 className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                      اعضا ({searchResults.members.length})
                    </h3>
                    {searchResults.members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm"
                      >
                        <Avatar className="h-6 w-6">
                          {m.avatarUrl ? (
                            <AvatarImage src={m.avatarUrl} alt={m.name} />
                          ) : null}
                          <AvatarFallback className="bg-primary/15 text-[10px] font-bold text-primary">
                            {m.name.charAt(0) || 'ع'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{m.name}</span>
                        <span
                          className="truncate text-xs text-muted-foreground"
                          dir="ltr"
                        >
                          {m.email}
                        </span>
                      </div>
                    ))}
                  </section>
                ) : null}
                {searchResults.labels.length > 0 ? (
                  <section className="px-1 py-2">
                    <h3 className="px-3 pb-1 text-xs font-medium text-muted-foreground">
                      برچسب‌ها ({searchResults.labels.length})
                    </h3>
                    {searchResults.labels.map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm"
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: l.color }}
                        />
                        <span className="truncate">{l.name}</span>
                      </div>
                    ))}
                  </section>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          aria-label={isDark ? 'فعال‌سازی تم روشن' : 'فعال‌سازی تم تاریک'}
          title={isDark ? 'تم روشن' : 'تم تاریک'}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

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
              className="flex shrink-0 items-center gap-0 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-secondary sm:gap-2 sm:px-2"
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
              <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
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
