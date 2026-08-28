'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Award,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  getBrands,
  createBrand,
  updateBrand,
  deleteBrand,
} from '@/services/brand.service';
import type { Brand, BrandInput } from '@/types/brand';
import { BRAND_STATUS_LABELS } from '@/types/brand';
import { toPersianDigits } from '@/utils/persian';

export function BrandManagement() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBrands = useCallback(async () => {
    try {
      const data = await getBrands();
      setBrands(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  const openCreate = () => {
    setEditingBrand(null);
    setFormName('');
    setFormColor('');
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setFormName(brand.name);
    setFormColor(brand.color ?? '');
    setError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setError('نام برند نمی‌تواند خالی باشد.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const input: BrandInput = {
        name: formName.trim(),
        color: formColor || null,
      };

      if (editingBrand) {
        await updateBrand(editingBrand.id, input);
      } else {
        await createBrand(input);
      }

      setDialogOpen(false);
      await loadBrands();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'خطا در ذخیره‌سازی.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (brand: Brand) => {
    const newStatus = brand.status === 'active' ? 'inactive' : 'active';
    await updateBrand(brand.id, { status: newStatus });
    await loadBrands();
  };

  const handleDelete = async (brand: Brand) => {
    if (
      !confirm(`آیا از غیرفعال کردن برند «${brand.name}» مطمئن هستید؟`)
    ) {
      return;
    }
    await deleteBrand(brand.id);
    await loadBrands();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          در حال بارگذاری برندها...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">مدیریت برندها</h3>
          <p className="text-xs text-muted-foreground">
            {toPersianDigits(String(brands.length))} برند ثبت‌شده
          </p>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          افزودن برند
        </Button>
      </div>

      {/* Brand list */}
      {brands.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Award className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            هنوز هیچ برندی ثبت نشده است.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AnimatePresence mode="popLayout">
            {brands.map((brand) => (
              <motion.div
                key={brand.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 px-4 py-3 transition-colors hover:bg-surface/80"
              >
                {/* Color dot */}
                <div
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: brand.color ?? '#6B7280' }}
                />

                {/* Name + status */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      brand.status === 'active'
                        ? 'text-foreground'
                        : 'text-muted-foreground line-through'
                    }`}
                  >
                    {brand.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {brand.slug}
                  </p>
                </div>

                {/* Status badge */}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    brand.status === 'active'
                      ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {BRAND_STATUS_LABELS[brand.status]}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(brand)}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    title={
                      brand.status === 'active'
                        ? 'غیرفعال کردن'
                        : 'فعال کردن'
                    }
                  >
                    {brand.status === 'active' ? (
                      <ToggleRight className="h-4 w-4 text-green-500" />
                    ) : (
                      <ToggleLeft className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(brand)}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    title="ویرایش"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(brand)}
                    className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    title="غیرفعال کردن"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {editingBrand ? 'ویرایش برند' : 'افزودن برند جدید'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brand-name">نام برند</Label>
              <Input
                id="brand-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="نام برند را وارد کنید..."
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="brand-color">رنگ برند</Label>
              <div className="flex items-center gap-2">
                <input
                  id="brand-color"
                  type="color"
                  value={formColor || '#6B7280'}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="h-8 w-8 cursor-pointer rounded-lg border border-border"
                />
                <Input
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  placeholder="#6B7280"
                  className="flex-1"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
            >
              انصراف
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : editingBrand ? (
                'ذخیره تغییرات'
              ) : (
                'افزودن'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
