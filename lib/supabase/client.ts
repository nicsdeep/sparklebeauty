import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (signed-in user's session, anon key), for what must run in the browser:
 * photo uploads straight to Storage (skipping the server-action size limit), live updates
 * (lib/live.ts) and search suggestions as you type (components/search-suggest.tsx). RLS still
 * decides what each user may read or change.
 */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
