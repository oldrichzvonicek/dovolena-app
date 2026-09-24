// Dodio's mark: a rounded teal square with a coral "bitten corner" circle —
// reads as one highlighted day in a calendar. Reproduced from the design
// system's mark.svg/lockup.svg description; not to be redrawn or recolored.
export function DodioMark({ size = 32, className }: { size?: number; className?: string }) {
  const clipId = `dodio-mark-clip-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <defs>
        <clipPath id={clipId}>
          <rect width="32" height="32" rx="8" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="32" height="32" fill="#0F9D7C" />
        <circle cx="32" cy="0" r="13" fill="#F0997B" />
      </g>
    </svg>
  );
}

export function DodioLockup({
  markSize = 32,
  wordmarkClassName,
  className,
}: {
  markSize?: number;
  wordmarkClassName?: string;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <DodioMark size={markSize} />
      <span className={`font-dodio-display font-bold ${wordmarkClassName ?? ""}`}>dodio</span>
    </span>
  );
}
