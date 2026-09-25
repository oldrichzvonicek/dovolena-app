import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely. Only import this from server
 * code (API routes, route handlers) that needs to act outside any user's own
 * session, e.g. a public iCal feed identified by an unguessable token rather
 * than a login. Never expose SUPABASE_SERVICE_ROLE_KEY to the client bundle.
 */
export function createAdminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    // Next.js caches server-side fetch() by default — the service client must always read live data (iCal feed, cron jobs).
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
}
