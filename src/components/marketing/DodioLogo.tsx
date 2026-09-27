// Dodio's mark: a rounded teal square with a coral "bitten corner" circle in
// the bottom-right — reads as one highlighted day in a calendar. Exact copy
// of the design system's mark.svg geometry; not to be redrawn or recolored.
export function DodioMark({ size = 32, className }: { size?: number; className?: string }) {
  const clipId = `dodio-mark-clip-${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" aria-hidden="true" className={className}>
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="96" height="96" rx="22" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="96" height="96" rx="22" fill="#0F9D7C" />
      <g clipPath={`url(#${clipId})`}>
        <circle cx="96" cy="96" r="34" fill="#F0997B" />
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
