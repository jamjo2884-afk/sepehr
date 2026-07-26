import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export function Logo({ className, showText = true }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-glow">
        <span className="text-lg font-bold text-primary-foreground">م</span>
        <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10" />
      </div>
      {showText ? (
        <div className="flex flex-col leading-none">
          <span className="text-sm font-bold tracking-tight text-foreground">
            مدیا اواس
          </span>
          <span className="mt-0.5 text-[10px] font-medium text-muted-foreground">
            Media Operating System
          </span>
        </div>
      ) : null}
    </div>
  );
}
