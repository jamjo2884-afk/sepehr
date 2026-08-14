'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FormField } from '@/components/forms/form-field';
import { createOperation } from '@/services/data.service';
import {
  OPERATION_STATUS_LABELS,
  OPERATION_TYPE_LABELS,
  type OperationStatus,
  type OperationType,
} from '@/types/domain';

interface OperationFormProps {
  /** Project the operation belongs to. */
  projectId: string;
  /** Called after a successful insert. */
  onCreated: (operationId: string) => void;
  triggerLabel?: string;
}

export function OperationForm({
  projectId,
  onCreated,
  triggerLabel = 'عملیات جدید',
}: OperationFormProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<OperationType>('planning');
  const [status, setStatus] = useState<OperationStatus>('todo');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setDescription('');
    setType('planning');
    setStatus('todo');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('عنوان عملیات الزامی است.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = await createOperation({
        projectId,
        title,
        description,
        type,
        status,
      });
      reset();
      setOpen(false);
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت عملیات.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>عملیات جدید</DialogTitle>
          <DialogDescription>
            یک کار عملیاتی به این پروژه اضافه کنید — در Supabase ذخیره می‌شود.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="عنوان *" htmlFor="op-title">
            <Input
              id="op-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثلاً: فیلم‌برداری تیزر"
              autoFocus
            />
          </FormField>
          <FormField label="توضیحات" htmlFor="op-description">
            <Textarea
              id="op-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="شرح کار..."
              rows={2}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="نوع">
              <Select
                value={type}
                onValueChange={(v) => setType(v as OperationType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(OPERATION_TYPE_LABELS) as OperationType[]).map(
                    (t) => (
                      <SelectItem key={t} value={t}>
                        {OPERATION_TYPE_LABELS[t]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="وضعیت">
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as OperationStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(OPERATION_STATUS_LABELS) as OperationStatus[]
                  ).map((s) => (
                    <SelectItem key={s} value={s}>
                      {OPERATION_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          {error ? (
            <p className="text-xs font-medium text-destructive">{error}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              انصراف
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {saving ? 'در حال ذخیره...' : 'ایجاد عملیات'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
