'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { getBrandColor } from '@/constants/brand-colors';

/**
 * Brand name → logo asset under `public/brands/`.
 */
export const BRAND_LOGO_FILES: Record<string, string> = {
  ازما: '/brands/azma.png',
  '۱۰۰ درجه': '/brands/sad-darajeh.png',
  'صد درجه': '/brands/sad-darajeh.png',
  'رهبر سوم': '/brands/rahbar-sevvom.png',
  روشنگری: '/brands/roshangari.png',
  'سینه فیلیا': '/brands/cinephilia.png',
  فصل۱۱: '/brands/fasl-11.png',
  'فصل 11': '/brands/fasl-11.png',
  مردمک: '/brands/mardomak.png',
  نسیم: '/brands/nasim-online.png',
  'نسیم آنلاین': '/brands/nasim-online.png',
  'نود اقتصادی': '/brands/90-eghtesadi.png',
  کبریت: '/brands/kebrit.png',
  'پل استودیو': '/brands/pol-studio.png',
  مرورگر: '/brands/moroorger.png',
};

/**
 * Renders the supplied logo when the brand has an asset; otherwise keeps a
 * deterministic initial-letter tile for brands without a supplied logo.
 */
export function BrandLogo({
  brand,
  className,
  iconClassName,
}: {
  brand: string;
  /** Wrapper sizing/shape classes, e.g. "h-8 w-8 rounded-lg". */
  className?: string;
  /** Inner glyph sizing for the fallback initial-letter tile. */
  iconClassName?: string;
}) {
  const { primary: color } = getBrandColor(brand);
  const logoFile = BRAND_LOGO_FILES[brand];

  if (logoFile) {
    return (
      <span
        className={cn(
          'relative inline-flex shrink-0 items-center justify-center overflow-hidden',
          className,
        )}
        aria-hidden
      >
        <Image
          src={logoFile}
          alt=""
          fill
          sizes="48px"
          className="object-contain"
        />
      </span>
    );
  }

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
