export function SectionHeader({ icon, title, className }: { icon: React.ReactNode; title: string; className?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${className ?? "bg-moss-light text-moss-dark"}`}>{icon}</div>
      <h2 className="font-display text-h2">{title}</h2>
    </div>
  );
}
