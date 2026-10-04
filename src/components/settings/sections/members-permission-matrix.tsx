'use client';

import { useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Check, Loader2, RotateCcw } from 'lucide-react';
import {
  ACCESS_LEVELS,
  ACCESS_LEVEL_LABELS,
  MODULE_KEYS,
  MODULE_LABELS,
  type AccessLevel,
  type ModuleKey,
  type PermissionMatrix,
} from '@/types/permissions';

/**
 * Editable per-module access matrix for ONE member.
 *
 * Levels form an ordered scale (none < view < create < edit) and the UI makes
 * that explicit: choosing a level implies every level below it, so the editor
 * enforces edit ⇒ create ⇒ view on every change rather than letting a
 * nonsensical combination like `create` with no `view` be saved.
 *
 * The `settings` module is intentionally absent: it is owner/admin-only and the
 * permission engine forces 'none' for plain members regardless of what is
 * stored, so offering a control for it would be a lie.
 *
 * Changes are staged locally and only sent on "ذخیره"; "بازنشانی" reverts the
 * form back to the last saved state.
 */

interface MembersPermissionMatrixProps {
  /** The member's currently SAVED matrix. */
  value: PermissionMatrix;
  /** Staged (unsaved) matrix — owned by the parent so it survives remounts. */
  draft: PermissionMatrix;
  onDraftChange: (next: PermissionMatrix) => void;
  onSave: () => void;
  onReset: () => void;
  isSaving: boolean;
  disabled: boolean;
}

/** Rank used for the "implies everything below" rule. */
const RANK: Record<AccessLevel, number> = {
  none: 0,
  view: 1,
  create: 2,
  edit: 3,
};

/**
 * Expand a chosen level to a full, internally consistent matrix.
 *
 * A member with `create` on a module but nothing on it is ambiguous, so a
 * higher level implies the two below it. `none` clears the module entirely.
 */
function normalize(matrix: PermissionMatrix): PermissionMatrix {
  const out: PermissionMatrix = {};
  // NOTE: the loop variable must NOT be called `module` — Next's
  // no-assign-module-variable rule reserves that identifier.
  for (const moduleKey of MODULE_KEYS) {
    if (moduleKey === 'settings') continue;
    const level = matrix[moduleKey] ?? 'none';
    if (level === 'none') continue;
    out[moduleKey] = level;
  }
  return out;
}

export function MembersPermissionMatrix({
  value,
  draft,
  onDraftChange,
  onSave,
  onReset,
  isSaving,
  disabled,
}: MembersPermissionMatrixProps) {
  const isDirty = useMemo(
    () => JSON.stringify(normalize(draft)) !== JSON.stringify(normalize(value)),
    [draft, value],
  );

  const setLevel = (moduleKey: ModuleKey, level: AccessLevel) => {
    const next: PermissionMatrix = { ...draft };
    if (level === 'none') {
      delete next[moduleKey];
    } else {
      next[moduleKey] = level;
    }
    onDraftChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right">بخش</TableHead>
            <TableHead className="w-[170px] text-right">سطح دسترسی</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {MODULE_KEYS.filter((m) => m !== 'settings').map((moduleKey) => (
            <TableRow key={moduleKey}>
              <TableCell className="font-medium text-foreground">
                {MODULE_LABELS[moduleKey]}
              </TableCell>
              <TableCell>
                <Select
                  value={(draft[moduleKey] ?? 'none') as AccessLevel}
                  onValueChange={(v) => setLevel(moduleKey, v as AccessLevel)}
                  disabled={disabled || isSaving}
                >
                  <SelectTrigger
                    aria-label={`دسترسی ${MODULE_LABELS[moduleKey]}`}
                    className="h-9"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {ACCESS_LEVEL_LABELS[level]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="text-xs leading-5 text-muted-foreground">
        هر سطح بالاتر، سطح‌های پایین‌تر را هم شامل می‌شود؛ مثلاً «ویرایش» یعنی
        افزودن و مشاهده هم ممکن است. بخش «تنظیمات» فقط برای مالک و مدیر است.
      </p>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={disabled || isSaving || !isDirty}
        >
          {isSaving ? (
            <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Check className="ml-2 h-3.5 w-3.5" aria-hidden />
          )}
          ذخیره دسترسی
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onReset}
          disabled={disabled || isSaving || !isDirty}
        >
          <RotateCcw className="ml-2 h-3.5 w-3.5" aria-hidden />
          بازنشانی
        </Button>
        {isDirty && !isSaving && (
          <span className="text-xs text-amber-600 dark:text-amber-400">
            تغییرات ذخیره نشده است.
          </span>
        )}
      </div>
    </div>
  );
}

export { normalize as normalizePermissionMatrix };
export type { ModuleKey, AccessLevel };
export { RANK as ACCESS_LEVEL_RANK };
