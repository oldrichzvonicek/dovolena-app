/**
 * Matice oprávnění super-adminu (tabulka „Role a oprávnění“ v dokumentaci). Kontroluje se na serveru
 * (requirePermission na začátku každého handleru), nikdy jen skrytím tlačítka.
 * Platformní role se jmenují jinak než role v zákaznické aplikaci (admin / HR / účetní), aby se nepletly.
 */

export type PlatformRole = "super_admin" | "support" | "billing";

export const PLATFORM_ROLES: PlatformRole[] = ["super_admin", "support", "billing"];

export const ROLE_LABELS: Record<PlatformRole, string> = {
  super_admin: "Super-admin",
  support: "Podpora",
  billing: "Fakturace",
};

export type Permission =
  | "company.read" // detail firmy a všechna data provozovatele
  | "company.read_billing" // jen seznam firem a fakturační údaje
  | "company.suspend"
  | "company.delete"
  | "company.impersonate"
  | "company.export"
  | "notes.write"
  | "plan.change"
  | "billing.read"
  | "billing.write"
  | "gdpr.handle"
  | "gdpr.forward"
  | "audit.read"
  | "settings.write"
  | "pricing.write"
  | "team.manage";

const ALL: Permission[] = [
  "company.read",
  "company.read_billing",
  "company.suspend",
  "company.delete",
  "company.impersonate",
  "company.export",
  "notes.write",
  "plan.change",
  "billing.read",
  "billing.write",
  "gdpr.handle",
  "gdpr.forward",
  "audit.read",
  "settings.write",
  "pricing.write",
  "team.manage",
];

const MATRIX: Record<PlatformRole, readonly Permission[]> = {
  super_admin: ALL,
  support: ["company.read", "company.read_billing", "company.impersonate", "notes.write", "billing.read", "gdpr.forward", "audit.read"],
  billing: ["company.read_billing", "billing.read", "billing.write"],
};

export function can(role: PlatformRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role]?.includes(permission) ?? false;
}

export function permissionsOf(role: PlatformRole): readonly Permission[] {
  return MATRIX[role];
}

export const isPlatformRole = (v: unknown): v is PlatformRole => typeof v === "string" && (PLATFORM_ROLES as string[]).includes(v);
