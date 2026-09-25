import { useId } from "react";

/**
 * App brand mark from the Dodio design system's asset store (mark.svg) —
 * a teal rounded square with a coral circle clipped into the bottom-right
 * corner, read as one "marked-off day" on a calendar. Ported 1:1 (viewBox
 * 0 0 96 96, same fills) rather than imported as a file — no SVG-as-
 * component loader is configured in this project. The clip path id is
 * unique per instance so two logos on the same page (e.g. sidebar header
 * + footer) don't collide.
 */
export function AppLogo({ className }: { className?: string }) {
  const clipId = `dodio-mark-clip-${useId()}`;
  return (
    <svg viewBox="0 0 96 96" className={className} role="img" aria-label="Dodio">
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
