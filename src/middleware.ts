import { NextResponse, type NextRequest } from "next/server";

/**
 * Oddělení super-adminu od zákaznické aplikace. Super-admin běží na vlastní adrese (admin.dodio.cz, lokálně
 * admin.localhost:3000), zdroják je stejný. Tady se rozhoduje podle adresy:
 *  - na adrese adminu se cesty přepíšou do /platform/… a dostupné je jen API adminu (/api/platform) a cron úlohy,
 *  - na jakékoli jiné adrese jsou /platform/… a /api/platform/… nedostupné (404), takže zákaznická aplikace admin nevystaví.
 * Cookies mají různé adresy, takže se přihlášení do adminu a do aplikace nesdílí.
 */
const ADMIN_HOSTS = (process.env.PLATFORM_HOSTS ?? "admin.localhost,admin.dodio.cz")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const notFound = () => new NextResponse(null, { status: 404 });

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const { pathname } = req.nextUrl;
  const isAdminHost = ADMIN_HOSTS.includes(host);

  if (!isAdminHost) {
    if (pathname === "/platform" || pathname.startsWith("/platform/") || pathname.startsWith("/api/platform") || pathname === "/api/cron/platform-jobs") return notFound();
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/platform") || pathname === "/api/cron/platform-jobs") return NextResponse.next();
  if (pathname.startsWith("/api/")) return notFound();
  if (pathname === "/platform" || pathname.startsWith("/platform/")) return notFound();

  const url = req.nextUrl.clone();
  url.pathname = `/platform${pathname === "/" ? "" : pathname}`;
  const res = NextResponse.rewrite(url);
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|brand/).*)"],
};
