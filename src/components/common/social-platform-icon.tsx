import {
  Instagram,
  Youtube,
  Twitter,
  Send,
  type LucideIcon,
} from 'lucide-react';
import type { SocialPlatform } from '@/types/domain';
import { SOCIAL_PLATFORM_BRAND } from '@/types/domain';
import { cn } from '@/lib/utils';

/**
 * Renders a brand glyph for a social platform. Brand icons use the official
 * brand color and fill the container with a tinted background so each platform
 * is instantly recognizable in cards and lists.
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

/**
 * Internal glyph switch. Uses lucide icons where a close-enough brand glyph
 * exists, and a compact custom SVG path otherwise.
 */
function BrandGlyph({
  platform,
  className,
}: {
  platform: SocialPlatform;
  className?: string;
}) {
  const lucideMap: Partial<Record<SocialPlatform, LucideIcon>> = {
    instagram: Instagram,
    youtube: Youtube,
    twitter: Twitter,
  };

  const LucideIcon = lucideMap[platform];
  if (LucideIcon) {
    return <LucideIcon className={cn('h-[1em] w-[1em]', className)} fill="currentColor" />;
  }

  // Send (paper plane) is a recognizable stand-in for Telegram.
  if (platform === 'telegram') {
    return <Send className={cn('h-[1em] w-[1em]', className)} fill="currentColor" />;
  }

  // Custom brand glyphs for Iranian platforms.
  const size = 24; // viewBox; scaled via className h/w.
  switch (platform) {
    case 'eita':
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={cn('h-[1em] w-[1em]', className)}
          fill="currentColor"
        >
          {/* Speech bubble + envelope hint (Eitaa messaging). */}
          <path d="M12 2C6.5 2 2 5.8 2 10.5c0 2.6 1.4 4.9 3.6 6.4L4.5 21l4.3-2.3c1 .3 2.1.4 3.2.4 5.5 0 10-3.8 10-8.6S17.5 2 12 2zm0 2.2c4.3 0 7.8 2.8 7.8 6.3s-3.5 6.3-7.8 6.3c-1 0-2-.2-2.9-.5l-.4-.2-2.2 1.2.5-2.1.1-.4-.4-.3C4.8 13.6 4.2 12.1 4.2 10.5c0-3.5 3.5-6.3 7.8-6.3z" />
        </svg>
      );
    case 'rubika':
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={cn('h-[1em] w-[1em]', className)}
          fill="currentColor"
        >
          {/* Hexagon (Rubika brand is cube/hex-like). */}
          <path d="M12 1.6l9 5.2v10.4l-9 5.2-9-5.2V6.8l9-5.2zm0 2.3L5.2 7.9v8.2L12 20.1l6.8-4V7.9L12 3.9zm-1.4 12.6V7.5h2.7c2.4 0 3.9 1.2 3.9 3.2 0 1.4-.8 2.4-2.1 2.8l2.7 3H15l-2.4-2.8h-1v2.8h-1.9zm1.9-4.4h.9c1.2 0 1.9-.5 1.9-1.5s-.7-1.4-1.9-1.4h-.9v2.9z" />
        </svg>
      );
    case 'soroushplus':
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={cn('h-[1em] w-[1em]', className)}
          fill="currentColor"
        >
          {/* Plus node — network/messaging hub. */}
          <path d="M9.5 3v4.2H5.3v3.6h4.2v4.2h3.6v-4.2h4.2V7.2h-4.2V3H9.5z" />
          <path d="M12 1.5C6.2 1.5 1.5 6.2 1.5 12S6.2 22.5 12 22.5 22.5 17.8 22.5 12 17.8 1.5 12 1.5zm0 2.1c4.6 0 8.4 3.8 8.4 8.4s-3.8 8.4-8.4 8.4S3.6 16.6 3.6 12 7.4 3.6 12 3.6z" opacity="0.45" />
        </svg>
      );
    case 'bale':
      return (
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className={cn('h-[1em] w-[1em]', className)}
          fill="currentColor"
        >
          {/* Bale: stylized chat bubble. */}
          <path d="M12 2C6.5 2 2 5.9 2 10.7c0 2.7 1.5 5.1 3.8 6.7L4.6 22l5-2.6c.8.2 1.6.3 2.4.3 5.5 0 10-3.9 10-8.7S17.5 2 12 2zm4.4 9.8a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm-4.4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm-4.4 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z" />
        </svg>
      );
    default:
      return null;
  }
}
