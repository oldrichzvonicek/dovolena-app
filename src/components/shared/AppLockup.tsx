import { useId } from "react";

/**
 * Horizontal "lockup" — the Dodio mark plus the "dodio" wordmark side by side — for spots that show the
 * brand as one unit on a light background (sidebar header, standalone pages outside the signed-in shell).
 * Ported 1:1 from the brand's lockup.svg (same viewBox, same mark). The wordmark uses `fill-ink` rather
 * than a hardcoded color so it still reads correctly in dark mode, unlike the source file's fixed #2C2C2A.
 */
export function AppLockup({ className }: { className?: string }) {
  const clipId = `dodio-lockup-clip-${useId()}`;
  return (
    <svg viewBox="0 0 300 96" className={className} role="img" aria-label="Dodio">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="96" height="96" rx="22" />
        </clipPath>
      </defs>
      <rect x="0" y="0" width="96" height="96" rx="22" fill="#0F9D7C" />
      <g clipPath={`url(#${clipId})`}>
        <circle cx="96" cy="96" r="34" fill="#F0997B" />
      </g>
      <text x="120" y="62" className="font-display fill-ink" fontSize="44" fontWeight="700" letterSpacing="-1">
        dodio
      </text>
    </svg>
  );
}
