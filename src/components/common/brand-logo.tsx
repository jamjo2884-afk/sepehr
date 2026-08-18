'use client';

import { cn } from '@/lib/utils';

/**
 * Brand name → logo asset under `public/brands/`.
 *
 * Kept for reference but unused – brands now render as text tiles.
 */
export const BRAND_LOGO_FILES: Record<string, string> = {};

/** Deterministic brand accent (hue from the name) for the tile. */
function brandAccent(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360} 70% 62%)`;
}

/**
 * Renders a brand's logo next to its name as a text tile showing the full
 * brand name with a deterministic accent color.
 */
export function BrandLogo({
  brand,
  className,
  iconClassName,
}: {
  brand: string;
  /** Wrapper sizing/shape classes, e.g. "h-8 w-8 rounded-lg". */
  className?: string;
  /** Inner glyph sizing for the text tile. */
  iconClassName?: string;
}) {
  const color = brandAccent(brand);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        className,
      )}
      style={{ backgroundColor: `${color}1A`, color }}
      aria-hidden
    >
      <span className={cn('font-bold leading-none', iconClassName)}>
        {brand.charAt(0)}
      </span>
    </span>
  );
}
