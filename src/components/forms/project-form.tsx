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
import { createProject } from '@/services/data.service';
import {
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from '@/types/domain';

interface ProjectFormProps {
  /** Called after a successful insert. */
  onCreated: (projectId: string) => void;
  triggerLabel?: string;
}

export function ProjectForm({
  onCreated,
  triggerLabel = 'پروژه جدید',
}: ProjectFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planning');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setDescription('');
    setStatus('planning');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('نام پروژه الزامی است.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = await createProject({ name, description, status });
      reset();
      setOpen(false);
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ثبت پروژه.');
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
        <Button>
          <Plus className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>پروژه جدید</DialogTitle>
          <DialogDescription>
            یک پروژه رسانه‌ای بسازید — بلافاصله در Supabase ذخیره می‌شود.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="نام پروژه *" htmlFor="project-name">
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: کمپین زمستانه"
              autoFocus
            />
          </FormField>
          <FormField label="توضیحات" htmlFor="project-description">
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="هدف و محدوده پروژه..."
              rows={3}
            />
          </FormField>
          <FormField label="وضعیت">
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as ProjectStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {PROJECT_STATUS_LABELS[s]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </FormField>
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
              {saving ? 'در حال ذخیره...' : 'ایجاد پروژه'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
