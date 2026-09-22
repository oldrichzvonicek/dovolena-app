export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="border-b border-line bg-paper px-8 py-6">
      <h1 className="font-display text-2xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </header>
  );
}
