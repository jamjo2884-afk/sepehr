import { Instagram, Send } from 'lucide-react';
import type { SocialPlatform } from '@/types/domain';
import { SOCIAL_PLATFORM_BRAND } from '@/types/domain';
import { cn } from '@/lib/utils';

/** Brand logos provided as image assets under public/platforms. */
const IMAGE_LOGOS: Partial<Record<SocialPlatform, string>> = {
  aparat: '/platforms/aparat.webp',
  bale: '/platforms/bale.png',
  eita: '/platforms/eita.png',
  gap: '/platforms/gap.webp',
  igap: '/platforms/igap.png',
  instagram: '/platforms/instagram.png',
  rubika: '/platforms/rubika.jpg',
  shad: '/platforms/shad.png',
  site: '/platforms/site.jpg',
  soroushplus: '/platforms/soroush.png',
  telegram: '/platforms/telegram.jpg',
  twitter: '/platforms/x.png',
  virasty: '/platforms/virasty.jpg',
  youtube: '/platforms/youtube.png',
};

/**
 * Renders a brand glyph for a social platform. Platforms with an official
 * logo asset render the image; the rest fall back to an icon glyph tinted
 * with the brand color so each platform is instantly recognizable in cards
 * and lists.
 */
export function SocialPlatformIcon({
  platform,
  className,
  iconClassName,
}: {
  platform: SocialPlatform;
  /** Wrapper sizing/shape classes, e.g. "h-10 w-10 rounded-lg". */
  className?: string;
  /** Inner glyph sizing classes, e.g. "h-5 w-5". */
  iconClassName?: string;
}) {
  const logo = IMAGE_LOGOS[platform];

  if (logo) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center overflow-hidden',
          className,
        )}
        aria-hidden
      >
        <img src={logo} alt="" className="h-full w-full object-contain" />
      </span>
    );
  }

  const { color } = SOCIAL_PLATFORM_BRAND[platform];

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        className,
      )}
      style={{ backgroundColor: `${color}1A`, color }}
      aria-hidden
    >
      <BrandGlyph platform={platform} className={iconClassName} />
    </span>
  );
}

/** Fallback glyphs for platforms without a logo asset yet. */
function BrandGlyph({
  platform,
  className,
}: {
  platform: SocialPlatform;
  className?: string;
}) {
  // All 8 platforms have logo assets; keep this fallback for safety.
  if (platform === 'instagram') {
    return (
      <Instagram className={cn('h-[1em] w-[1em]', className)} fill="currentColor" />
    );
  }

  // Send (paper plane) is a recognizable stand-in for Telegram.
  if (platform === 'telegram') {
    return <Send className={cn('h-[1em] w-[1em]', className)} fill="currentColor" />;
  }

  return null;
}
