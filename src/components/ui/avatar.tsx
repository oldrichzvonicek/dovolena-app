import { cn } from "@/lib/utils";

/** Kolečko s fotkou (pokud je nahraná) nebo iniciálami. `className` řídí velikost, pozadí i barvu textu. */
export function Avatar({ url, initials, name, className }: { url?: string | null; initials?: string | null; name?: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- dynamická URL ze Supabase Storage, stejně jako LogoCard
  if (url) return <img src={url} alt={name ?? "Fotka"} className={cn("rounded-full object-cover", className)} />;
  return <div className={cn("flex items-center justify-center rounded-full", className)}>{initials}</div>;
}
