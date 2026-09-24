// Feature icons: simple filled geometric shapes, matching the design's
// icon language. Inline SVG, no emoji, sized to fill their 44–52px tiles.

export function RequestIcon() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="3" y="5" width="20" height="18" rx="4" fill="#F0997B" />
      <rect x="7" y="2" width="3" height="6" rx="1.5" fill="#712B13" />
      <rect x="16" y="2" width="3" height="6" rx="1.5" fill="#712B13" />
      <circle cx="17" cy="16" r="3" fill="#712B13" />
    </svg>
  );
}

export function ChatApprovalIcon() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 26 26" aria-hidden="true">
      <path
        d="M4 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9l-6 5v-5H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
        fill="#0F9D7C"
      />
      <path
        d="M8.5 12l3 3 6-6"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TeamCalendarIcon() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 26 26" aria-hidden="true">
      <rect x="2" y="5" width="12" height="4" rx="2" fill="#0F9D7C" />
      <rect x="8" y="11" width="16" height="4" rx="2" fill="#085041" />
      <rect x="4" y="17" width="9" height="4" rx="2" fill="#F0997B" />
    </svg>
  );
}

export function ExportIcon() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 26 26" aria-hidden="true">
      <path d="M6 2h10l6 6v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#2C2C2A" />
      <path d="M16 2v6h6" fill="#5F5E5A" />
      <path
        d="M13 11v8M9.5 15.5L13 19l3.5-3.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckIcon({ stroke = "#0F9D7C" }: { stroke?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
      <path
        d="M3 8.5l3 3 7-7"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CircleCheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="mt-0.5 shrink-0">
      <circle cx="11" cy="11" r="11" fill="#E3F2EC" />
      <path
        d="M6.5 11.5l3 3 6-6"
        fill="none"
        stroke="#085041"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M3 6h14M3 10h14M3 14h14" stroke="#2C2C2A" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M5 5l10 10M15 5L5 15"
        stroke="#2C2C2A"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
