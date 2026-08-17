'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Brand name → logo asset under `public/brands/`.
 *
 * Drop a logo file for each brand here with these exact names and it will
 * appear everywhere the brand name is shown. A brand whose file is missing
 * (or fails to load) renders a letter tile (first letter, deterministic
 * accent) so nothing breaks while logos are being added.
 */
export const BRAND_LOGO_FILES: Record<string, string> = {
  ازما: '/brands/azma.png',
  'دیده بان دولت': '/brands/dideban-dolat.png',
  'رهبر سوم': '/brands/rahbar-sevvom.png',
  روشنگری: '/brands/roshangari.png',
  'سینه فیلیا': '/brands/cinephilia.png',
  'صد درجه': '/brands/sad-darajeh.png',
  'فصل 11': '/brands/fasl-11.png',
  مردمک: '/brands/mardomak.png',
  'نسیم آنلاین': '/brands/nasim-online.png',
  'نود اقتصادی': '/brands/90-eghtesadi.png',
  پاراگراف: '/brands/paragraph.png',
  کبریت: '/brands/kebrit.png',
};

/** Deterministic brand accent (hue from the name) for the fallback tile. */
function brandAccent(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return `hsl(${hash % 360} 70% 62%)`;
}

/**
 * Renders a brand's logo next to its name. Brands with a loaded asset under
 * `public/brands/` show the image; missing or failed assets fall back to a
 * letter tile so every brand is still recognizable in cards, tables and
 * headers.
 */
export function BrandLogo({
  brand,
  className,
  iconClassName,
}: {
  brand: string;
  /** Wrapper sizing/shape classes, e.g. "h-8 w-8 rounded-lg". */
  className?: string;
  /** Inner glyph sizing for the letter-tile fallback. */
  iconClassName?: string;
}) {
  const file = BRAND_LOGO_FILES[brand];
  const [failed, setFailed] = useState(false);

  if (file && !failed) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center overflow-hidden',
          className,
        )}
        aria-hidden
      >
        <img
          src={file}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

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
