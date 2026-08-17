import { useId } from 'react';
import { cn } from '@/lib/utils';

/* ============================================================
   MEDIA DECK — Logo System
   Concept: abstract geometric M fused with a media dashboard.
   The M doubles as a rising data chart; inside the deck panel:
   a hairline baseline, two data bars, data points on the M
   peaks, and a subtle play-notch at the M's center valley.
   ============================================================ */

export type LogoTheme = 'dark' | 'light' | 'mono-white' | 'mono-black';
export type LogoVariant = 'horizontal' | 'stacked' | 'icon' | 'wordmark';

const GRADIENT_FROM = '#1677FF';
const GRADIENT_TO = '#16C7D9';

type ThemeColors = {
  panel: string;
  panelStroke: string;
  mStroke: 'gradient' | string;
  dot: string;
  bar: string;
  baseline: string;
  notch: string;
  textMain: string;
  textAccent: string;
};

const THEME_COLORS: Record<LogoTheme, ThemeColors> = {
  dark: {
    panel: '#071426',
    panelStroke: 'rgba(255,255,255,0.16)',
    mStroke: 'gradient',
    dot: '#ffffff',
    bar: 'rgba(255,255,255,0.35)',
    baseline: 'rgba(255,255,255,0.18)',
    notch: '#16C7D9',
    textMain: '#F8FAFC',
    textAccent: '#1677FF',
  },
  light: {
    panel: '#ffffff',
    panelStroke: 'rgba(7,20,38,0.14)',
    mStroke: 'gradient',
    dot: '#ffffff',
    bar: 'rgba(7,20,38,0.30)',
    baseline: 'rgba(7,20,38,0.18)',
    notch: '#16C7D9',
    textMain: '#071426',
    textAccent: '#1677FF',
  },
  'mono-white': {
    panel: 'transparent',
    panelStroke: 'rgba(255,255,255,0.5)',
    mStroke: '#FFFFFF',
    dot: '#FFFFFF',
    bar: 'rgba(255,255,255,0.5)',
    baseline: 'rgba(255,255,255,0.35)',
    notch: '#FFFFFF',
    textMain: '#FFFFFF',
    textAccent: '#FFFFFF',
  },
  'mono-black': {
    panel: 'transparent',
    panelStroke: 'rgba(7,20,38,0.5)',
    mStroke: '#071426',
    dot: '#071426',
    bar: 'rgba(7,20,38,0.5)',
    baseline: 'rgba(7,20,38,0.35)',
    notch: '#071426',
    textMain: '#071426',
    textAccent: '#071426',
  },
};

interface LogoMarkProps {
  className?: string;
  theme?: LogoTheme;
}

/** Symbol only — the M + deck mark. Works at favicon sizes. */
export function LogoMark({ className, theme = 'dark' }: LogoMarkProps) {
  const gradientId = useId();
  const c = THEME_COLORS[theme];
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-9 w-9 shrink-0', className)}
      aria-hidden
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="48"
          y2="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor={GRADIENT_FROM} />
          <stop offset="1" stopColor={GRADIENT_TO} />
        </linearGradient>
      </defs>

      {/* deck / dashboard panel */}
      <rect
        x="1.5"
        y="1.5"
        width="45"
        height="45"
        rx="12"
        fill={c.panel}
        stroke={c.panelStroke}
        strokeWidth="1.5"
      />

      {/* chart baseline */}
      <line
        x1="10"
        y1="37.5"
        x2="38"
        y2="37.5"
        stroke={c.baseline}
        strokeWidth="1"
      />

      {/* data bars on the baseline */}
      <rect x="12.5" y="35" width="2" height="2.5" rx="0.75" fill={c.bar} />
      <rect x="33.5" y="35.5" width="2" height="2" rx="0.75" fill={c.bar} />

      {/* solid geometric M — stems + chart-like diagonals */}
      <path
        d="M11 12 L16.5 12 L16.5 29 L24 34 L31.5 29 L31.5 12 L37 12 L37 34 L11 34 Z"
        fill={c.mStroke === 'gradient' ? `url(#${gradientId})` : c.mStroke}
      />

      {/* play notch — media reference filling the M's valley */}
      <path d="M16.5 29 L24 34 L31.5 29 Z" fill={c.notch} />

      {/* data points on the M stem tops */}
      <circle cx="13.75" cy="12" r="2.4" fill={c.dot} />
      <circle cx="34.25" cy="12" r="2.4" fill={c.dot} />
    </svg>
  );
}

interface WordmarkProps {
  theme?: LogoTheme;
  className?: string;
  twoLine?: boolean;
}

/** MEDIA DECK wordmark (Inter). MEDIA = textMain, DECK = textAccent. */
function Wordmark({ theme = 'dark', className, twoLine }: WordmarkProps) {
  const c = THEME_COLORS[theme];
  if (twoLine) {
    return (
      <span
        dir="ltr"
        className={cn(
          'font-inter flex flex-col font-bold leading-none tracking-[0.12em]',
          className,
        )}
      >
        <span style={{ color: c.textMain }}>MEDIA</span>
        <span className="mt-1" style={{ color: c.textAccent }}>
          DECK
        </span>
      </span>
    );
  }
  return (
    <span
      dir="ltr"
      className={cn('font-inter font-bold tracking-[0.1em]', className)}
    >
      <span style={{ color: c.textMain }}>MEDIA</span>{' '}
      <span style={{ color: c.textAccent }}>DECK</span>
    </span>
  );
}

interface LogoProps {
  className?: string;
  variant?: LogoVariant;
  theme?: LogoTheme;
  /** Backwards-compatible shortcut: showText={false} renders icon-only. */
  showText?: boolean;
}

/**
 * Full logo lockup.
 * horizontal: mark beside a two-line wordmark
 * stacked:    mark above a two-line wordmark
 * icon:       mark only
 * wordmark:   text only
 */
export function Logo({
  className,
  variant = 'horizontal',
  theme = 'dark',
  showText,
}: LogoProps) {
  const effectiveVariant: LogoVariant =
    showText === false ? 'icon' : variant;

  if (effectiveVariant === 'icon') {
    return <LogoMark className={className} theme={theme} />;
  }

  if (effectiveVariant === 'wordmark') {
    return <Wordmark theme={theme} className={className} />;
  }

  if (effectiveVariant === 'stacked') {
    return (
      <div className={cn('flex flex-col items-center gap-2', className)}>
        <LogoMark theme={theme} />
        <Wordmark theme={theme} twoLine className="text-[13px]" />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark theme={theme} />
      <Wordmark theme={theme} twoLine className="text-[13px]" />
    </div>
  );
}
