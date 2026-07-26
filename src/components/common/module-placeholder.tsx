'use client';

import { motion } from 'framer-motion';
import { Construction, Sparkles } from 'lucide-react';
import type { NavItem } from '@/config/navigation.config';
import { PLACEHOLDER_MESSAGE } from '@/constants/ui.constants';

interface ModulePlaceholderProps {
  item: NavItem;
  /** What users will eventually do in this module. */
  futureActions: string[];
}

export function ModulePlaceholder({
  item,
  futureActions,
}: ModulePlaceholderProps) {
  const Icon = item.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center text-center"
    >
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 shadow-glow">
        <Icon className="h-10 w-10 text-primary" />
        <span className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-primary/20" />
      </div>

      <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
        {item.label}
      </h1>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">
        {item.description}
      </p>

      <div className="w-full rounded-2xl border border-border bg-surface/60 p-5 text-right">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          در نسخه‌های آینده چه کارهایی انجام خواهید داد؟
        </div>
        <ul className="flex flex-col gap-2">
          {futureActions.map((action) => (
            <li
              key={action}
              className="flex items-start gap-2 text-sm text-muted-foreground"
            >
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
              <span>{action}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted-foreground">
        <Construction className="h-4 w-4 text-warning" />
        {PLACEHOLDER_MESSAGE}
      </p>
    </motion.div>
  );
}
