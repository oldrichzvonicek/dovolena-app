// The six absence icons from the Dodio design system's asset store (Icons
// group) — solid geometric shapes in a fixed brand color per type, ported
// 1:1 from their SVGs (no SVG-as-component loader configured here). Per
// the design system's own README they never change color by status; that's
// what the status Badge is for.
const icons = {
  vacation: (
    <>
      <circle cx="32" cy="32" r="14" fill="#0F9D7C" />
      <circle cx="58" cy="32" r="4" fill="#0F9D7C" />
      <circle cx="50.4" cy="50.4" r="4" fill="#0F9D7C" />
      <circle cx="32" cy="58" r="4" fill="#0F9D7C" />
      <circle cx="13.6" cy="50.4" r="4" fill="#0F9D7C" />
      <circle cx="6" cy="32" r="4" fill="#0F9D7C" />
      <circle cx="13.6" cy="13.6" r="4" fill="#0F9D7C" />
      <circle cx="32" cy="6" r="4" fill="#0F9D7C" />
      <circle cx="50.4" cy="13.6" r="4" fill="#0F9D7C" />
    </>
  ),
  sick: (
    <>
      <rect x="26" y="8" width="12" height="34" rx="6" fill="#F0997B" />
      <circle cx="32" cy="50" r="11" fill="#F0997B" />
    </>
  ),
  "home-office": (
    <>
      <polygon points="32,8 58,30 6,30" fill="#2C2C2A" />
      <rect x="16" y="28" width="32" height="28" rx="4" fill="#2C2C2A" />
    </>
  ),
  doctor: (
    <>
      <rect x="26" y="12" width="12" height="40" rx="4" fill="#0F9D7C" />
      <rect x="12" y="26" width="40" height="12" rx="4" fill="#0F9D7C" />
    </>
  ),
  "unpaid-leave": (
    <>
      <rect x="10" y="14" width="44" height="40" rx="6" fill="none" stroke="#2C2C2A" strokeWidth="3" />
      <rect x="18" y="8" width="6" height="10" rx="3" fill="#2C2C2A" />
      <rect x="40" y="8" width="6" height="10" rx="3" fill="#2C2C2A" />
      <rect x="22" y="34" width="20" height="6" rx="3" fill="#F0997B" />
    </>
  ),
  "comp-day": (
    <>
      <circle cx="32" cy="32" r="22" fill="none" stroke="#2C2C2A" strokeWidth="3" />
      <line x1="32" y1="32" x2="32" y2="18" stroke="#2C2C2A" strokeWidth="3" strokeLinecap="round" />
      <line x1="32" y1="32" x2="44" y2="32" stroke="#2C2C2A" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="32" r="3" fill="#2C2C2A" />
    </>
  ),
} as const;

export type LeaveIconName = keyof typeof icons;

// Our leave_types.key values (schema.sql seed_default_leave_types) that have
// a matching design-system icon. Company-custom types, and "osetrovacka" /
// "materska" (no matching icon in the design system), fall back to a plain
// color dot wherever this map has no entry.
const keyToIcon: Record<string, LeaveIconName> = {
  dovolena: "vacation",
  sick: "sick",
  nemoc: "sick",
  home_office: "home-office",
  lekar: "doctor",
  nahradni_volno: "comp-day",
};

export function leaveIconFor(typeKey: string): LeaveIconName | null {
  return keyToIcon[typeKey] ?? null;
}

export function LeaveTypeIcon({ name, size = 16, className }: { name: LeaveIconName; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      {icons[name]}
    </svg>
  );
}
