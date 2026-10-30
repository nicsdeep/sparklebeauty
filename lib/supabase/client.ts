import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (signed-in user's session, anon key). Used only where a file must go
 * straight from the browser to Storage (product photos), so large files skip the server-action
 * size limit. Storage RLS still decides who may upload.
 */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
