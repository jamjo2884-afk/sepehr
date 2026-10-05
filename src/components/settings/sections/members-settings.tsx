'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Copy,
  Loader2,
  ShieldCheck,
  Trash2,
  UserPlus,
  Clock,
} from 'lucide-react';
import { SettingsSection } from '@/components/settings/settings-section';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MembersPermissionMatrix } from '@/components/settings/sections/members-permission-matrix';
import { useAuthStore } from '@/stores/auth.store';
import { ROLE_LABELS, type AppRole } from '@/types/auth';
import {
  ACCESS_LEVEL_LABELS,
  MODULE_KEYS,
  MODULE_LABELS,
  type PermissionMatrix,
} from '@/types/permissions';
import { toPersianDigits } from '@/utils/persian';

/**
 * بخش «اعضا و دسترسی» — member roster, per-module permissions and invites.
 *
 * Visibility follows the server, not the UI: the member roster is readable by
 * any member, while the permission editor, invite form, pending-invitation list
 * and audit history only render for owner/admin. Even if those controls were
 * somehow shown, every mutation is re-checked by the SECURITY DEFINER RPCs, so
 * hiding them here is presentation, not the security boundary.
 *
 * Invitations are MANUAL-LINK: this project has no mail transport, so creating
 * an invite returns a link that the owner copies and sends themselves.
 */

interface ApiError {
  errorCode?: string;
  errorMessage?: string;
  error?: string;
}

interface WorkspaceMember {
  userId: string;
  role: AppRole;
  permissions: PermissionMatrix;
  joinedAt: string;
}

interface WorkspaceInvitation {
  id: string;
  email: string;
  role: AppRole;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  token: string;
  expiresAt: string;
  /**
   * Absolute accept link, built by the server from NEXT_PUBLIC_APP_URL.
   * Never assembled here from window.location.origin — an owner on a preview
   * deployment would copy a URL that Vercel Deployment Protection intercepts.
   */
  acceptUrl: string;
}

interface PermissionAuditEntry {
  id: string;
  actor_id: string | null;
  target_user_id: string;
  action: string;
  changes: Record<string, { before: string | null; after: string | null }>;
  created_at: string;
}

/** Roles an owner/admin can assign. Owner is never offered. */
const ASSIGNABLE_ROLES: AppRole[] = ['admin', 'member', 'editor', 'viewer'];

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as ApiError;
    return body.errorMessage ?? body.error ?? 'عملیات انجام نشد.';
  } catch {
    return 'عملیات انجام نشد.';
  }
}

export function MembersSettings() {
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [audit, setAudit] = useState<PermissionAuditEntry[]>([]);
  const [acceptUrl, setAcceptUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Staged permission matrix for the member whose editor is open.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PermissionMatrix>({});

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AppRole>('member');
  const [isInviting, setIsInviting] = useState(false);
  const [revokingToken, setRevokingToken] = useState<string | null>(null);

  // Authority is derived from the roster the server just sent us, not from a
  // client-side assumption.
  const me = members.find((m) => m.userId === currentUserId) ?? null;
  const isManager = me?.role === 'owner' || me?.role === 'admin';

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      // Roster: readable by every member.
      const res = await fetch('/api/workspace/members');
      if (res.ok) {
        const data = (await res.json()) as { members?: WorkspaceMember[] };
        setMembers(data.members ?? []);
      }
    } catch {
      // Settings may be open without a real session (demo mode) — non-fatal.
    }

    // Everything below is owner/admin only; a 403 here just hides those panels.
    if (isManager) {
      try {
        const [invRes, auditRes] = await Promise.all([
          fetch('/api/workspace/invitations'),
          fetch('/api/workspace/permissions/audit?limit=20'),
        ]);
        if (invRes.ok) {
          const data = (await invRes.json()) as {
            invitations?: WorkspaceInvitation[];
          };
          setInvitations(data.invitations ?? []);
        }
        if (auditRes.ok) {
          const data = (await auditRes.json()) as {
            entries?: PermissionAuditEntry[];
          };
          setAudit(data.entries ?? []);
        }
      } catch {
        // Non-fatal.
      }
    }
    setIsLoading(false);
  }, [isManager]);

  useEffect(() => {
    void load();
  }, [load]);

  // Drop manager-only data if authority changes (e.g. after being demoted).
  useEffect(() => {
    if (!isManager) {
      setInvitations([]);
      setAudit([]);
      setEditingId(null);
    }
  }, [isManager]);

  const startEditing = (member: WorkspaceMember) => {
    setEditingId(member.userId);
    setDraft({ ...member.permissions });
  };

  const savePermissions = async (member: WorkspaceMember) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/workspace/members/${member.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: draft }),
      });
      if (!res.ok) {
        toast.error(await readError(res));
        return;
      }
      const data = (await res.json()) as { changed?: boolean };
      toast.success(
        data.changed
          ? 'دسترسی‌ها ذخیره شد.'
          : 'تغییری برای ذخیره وجود نداشت.',
      );
      setEditingId(null);
      await load();
    } catch {
      toast.error('ذخیرهٔ دسترسی انجام نشد.');
    } finally {
      setIsSaving(false);
    }
  };

  const changeRole = async (member: WorkspaceMember, role: AppRole) => {
    try {
      const res = await fetch(`/api/workspace/members/${member.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        toast.error(await readError(res));
        return;
      }
      toast.success('نقش عضو به‌روزرسانی شد.');
      await load();
    } catch {
      toast.error('تغییر نقش انجام نشد.');
    }
  };

  const removeMember = async (member: WorkspaceMember) => {
    try {
      const res = await fetch(`/api/workspace/members/${member.userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.error(await readError(res));
        return;
      }
      toast.success('عضو از فضای کاری حذف شد.');
      if (editingId === member.userId) setEditingId(null);
      await load();
    } catch {
      toast.error('حذف عضو انجام نشد.');
    }
  };

  const sendInvite = async () => {
    setIsInviting(true);
    try {
      const res = await fetch('/api/workspace/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (!res.ok) {
        toast.error(await readError(res));
        return;
      }
      const data = (await res.json()) as { invitation?: WorkspaceInvitation };
      setAcceptUrl(data.invitation?.acceptUrl ?? null);
      setInviteEmail('');
      toast.success('دعوت ساخته شد — لینک را کپی و ارسال کنید.');
      await load();
    } catch {
      toast.error('ایجاد دعوت انجام نشد.');
    } finally {
      setIsInviting(false);
    }
  };

  const copyLink = async (url: string) => {
    // An empty link means the server had no NEXT_PUBLIC_APP_URL to build from.
    // Copying it would silently put a dead string on the clipboard.
    if (!url) {
      toast.error(
        'لینک دعوت در دسترس نیست؛ تنظیم NEXT_PUBLIC_APP_URL روی محیط استقرار انجام نشده است.',
      );
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('لینک کپی شد.');
    } catch {
      toast.error('کپی خودکار ممکن نشد؛ لینک را دستی کپی کنید.');
    }
  };

  const revokeInvite = async (token: string) => {
    setRevokingToken(token);
    try {
      const res = await fetch(`/api/workspace/invitations/${token}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        toast.error(await readError(res));
        return;
      }
      toast.success('دعوت لغو شد.');
      await load();
    } catch {
      toast.error('لغو دعوت انجام نشد.');
    } finally {
      setRevokingToken(null);
    }
  };

  /** Human summary of one member's matrix for the roster table. */
  const summarize = (member: WorkspaceMember): string => {
    if (member.role === 'owner' || member.role === 'admin') {
      return 'دسترسی کامل';
    }
    const granted = MODULE_KEYS.filter((m) => {
      const level = member.permissions[m];
      return level && level !== 'none';
    });
    if (granted.length === 0) return 'بدون دسترسی';
    return granted
      .map((m) => `${MODULE_LABELS[m]}: ${ACCESS_LEVEL_LABELS[member.permissions[m] ?? 'none']}`)
      .join('، ');
  };

  const shortId = (id: string) => `${id.slice(0, 8)}…`;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Roster ─────────────────────────────────────────────────── */}
      <SettingsSection
        title="اعضای فضای کاری"
        description="هر عضو با نقش فعلی و دسترسی هر بخش. تغییر دسترسی فقط برای مالک و مدیر ممکن است."
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            در حال بارگذاری اعضا...
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">عضوی یافت نشد.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">عضو</TableHead>
                  <TableHead className="text-right">نقش</TableHead>
                  <TableHead className="text-right">دسترسی بخش‌ها</TableHead>
                  {isManager && <TableHead className="text-right">عملیات</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const isOwner = member.role === 'owner';
                  const isSelf = member.userId === currentUserId;
                  // Owners are immutable; self-targeting is refused by the RPC.
                  const canEditRow = isManager && !isOwner && !isSelf;
                  const isEditing = editingId === member.userId;

                  return (
                    <tr key={member.userId}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-foreground">
                            {isSelf ? 'شما' : shortId(member.userId)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {toPersianDigits(
                              new Date(member.joinedAt).toLocaleDateString('fa-IR'),
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isManager && canEditRow ? (
                          <Select
                            value={member.role}
                            onValueChange={(v) =>
                              void changeRole(member, v as AppRole)
                            }
                          >
                            <SelectTrigger
                              aria-label={`نقش ${shortId(member.userId)}`}
                              className="h-8 w-[130px]"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASSIGNABLE_ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {ROLE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant={isOwner ? 'default' : 'secondary'}>
                            {ROLE_LABELS[member.role] ?? member.role}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[320px] text-xs text-muted-foreground">
                        {summarize(member)}
                      </TableCell>
                      {isManager && (
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {canEditRow && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  isEditing
                                    ? setEditingId(null)
                                    : startEditing(member)
                                }
                              >
                                <ShieldCheck className="ml-1.5 h-3.5 w-3.5" />
                                {isEditing ? 'بستن' : 'دسترسی'}
                              </Button>
                            )}
                            {canEditRow && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => void removeMember(member)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {(!canEditRow || isOwner) && (
                              <span className="text-[11px] text-muted-foreground">
                                {isOwner ? 'غیرقابل تغییر' : ''}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </tr>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Permission editor for the selected member */}
        {isManager && editingId && (
          <div className="rounded-lg border border-border bg-surface/40 p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              دسترسی بخش‌ها برای {shortId(editingId)}
            </h3>
            <MembersPermissionMatrix
              value={
                members.find((m) => m.userId === editingId)?.permissions ?? {}
              }
              draft={draft}
              onDraftChange={setDraft}
              onSave={() => {
                const target = members.find((m) => m.userId === editingId);
                if (target) void savePermissions(target);
              }}
              onReset={() => {
                const target = members.find((m) => m.userId === editingId);
                setDraft({ ...(target?.permissions ?? {}) });
              }}
              isSaving={isSaving}
              disabled={false}
            />
          </div>
        )}
      </SettingsSection>

      {/* ── Invitations ─────────────────────────────────────────────── */}
      {isManager && (
        <SettingsSection
          title="دعوت عضو جدید"
          description="این پروژه سیستم ارسال ایمیل ندارد؛ پس از ساخت دعوت، لینک را خودتان کپی و برای طرف ارسال کنید. لینک تا ۷ روز معتبر است."
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <label
                htmlFor="invite-email"
                className="text-xs font-medium text-muted-foreground"
              >
                ایمیل
              </label>
              <Input
                id="invite-email"
                type="email"
                dir="ltr"
                placeholder="name@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                نقش اولیه
              </label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as AppRole)}
              >
                <SelectTrigger className="w-[150px]" aria-label="نقش اولیه">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">عضو</SelectItem>
                  <SelectItem value="viewer">بیننده</SelectItem>
                  <SelectItem value="editor">ویراستار</SelectItem>
                  <SelectItem value="admin">مدیر</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              onClick={() => void sendInvite()}
              disabled={isInviting || inviteEmail.trim().length === 0}
            >
              {isInviting ? (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <UserPlus className="ml-2 h-4 w-4" aria-hidden />
              )}
              ساخت دعوت
            </Button>
          </div>

          {acceptUrl && (
            <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
              <span className="text-xs font-medium text-foreground">
                لینک دعوت آماده است — کپی و برای عضو ارسال کنید:
              </span>
              <div className="flex items-center gap-2">
                <code
                  dir="ltr"
                  className="flex-1 truncate rounded bg-background px-2 py-1.5 text-xs text-foreground"
                >
                  {acceptUrl}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void copyLink(acceptUrl)}
                >
                  <Copy className="ml-1.5 h-3.5 w-3.5" />
                  کپی
                </Button>
              </div>
            </div>
          )}

          {/* Pending invitations */}
          {invitations.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">ایمیل</TableHead>
                    <TableHead className="text-right">نقش</TableHead>
                    <TableHead className="text-right">وضعیت</TableHead>
                    <TableHead className="text-right">انقضا</TableHead>
                    <TableHead className="text-right">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell dir="ltr" className="text-right text-xs">
                        {inv.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {ROLE_LABELS[inv.role] ?? inv.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            inv.status === 'pending' ? 'default' : 'outline'
                          }
                        >
                          {inv.status === 'pending'
                            ? 'در انتظار'
                            : inv.status === 'accepted'
                              ? 'پذیرفته شد'
                              : inv.status === 'revoked'
                                ? 'لغو شد'
                                : 'منقضی'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {toPersianDigits(
                          new Date(inv.expiresAt).toLocaleDateString('fa-IR'),
                        )}
                      </TableCell>
                      <TableCell>
                        {inv.status === 'pending' && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => void copyLink(inv.acceptUrl)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              disabled={revokingToken === inv.token}
                              onClick={() => void revokeInvite(inv.token)}
                            >
                              {revokingToken === inv.token ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SettingsSection>
      )}

      {/* ── Audit history ───────────────────────────────────────────── */}
      {isManager && audit.length > 0 && (
        <SettingsSection
          title="تاریخچهٔ تغییرات دسترسی"
          description="هر تغییر نقش یا دسترسی، همراه با انجام‌دهنده و زمان ثبت می‌شود."
        >
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">عضو</TableHead>
                  <TableHead className="text-right">تغییر</TableHead>
                  <TableHead className="text-right">انجام‌دهنده</TableHead>
                  <TableHead className="text-right">زمان</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-xs">
                      {shortId(entry.target_user_id)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {Object.entries(entry.changes)
                        .map(([key, val]) => {
                          const field = key === 'role' ? 'نقش' : (MODULE_LABELS as Record<string,string>)[key] ?? key;
                          const before = val.before ?? '—';
                          const after = val.after ?? '—';
                          const label = (v: string) =>
                            v in ACCESS_LEVEL_LABELS
                              ? ACCESS_LEVEL_LABELS[v as keyof typeof ACCESS_LEVEL_LABELS]
                              : (ROLE_LABELS as Record<string,string>)[v] ?? v;
                          return `${field}: ${label(before)} ← ${label(after)}`;
                        })
                        .join('، ') || entry.action}
                    </TableCell>
                    <TableCell className="text-xs">
                      {entry.actor_id ? shortId(entry.actor_id) : '—'}
                    </TableCell>
                    <TableCell className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {toPersianDigits(
                        new Date(entry.created_at).toLocaleString('fa-IR'),
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SettingsSection>
      )}
    </div>
  );
}
