import { cookies } from "next/headers";
import { createServerClient, type SetAllCookies } from "@supabase/ssr";

/** Session-aware Supabase client for Route Handlers — reads the caller's auth cookies (set by the browser client), so RLS applies as that user, not as an admin. */
export async function createRouteClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Route Handlers can write cookies; ignore if called somewhere that can't (e.g. during a static render).
        }
      },
    },
  });
}
