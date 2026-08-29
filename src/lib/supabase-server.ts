import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { config, isSupabaseConfigured } from "@/config"

let serverClient: SupabaseClient | null = null

/** Anon Supabase client for SSG / server components (no session persistence). */
export function getSupabaseServer(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  if (!serverClient) {
    serverClient = createClient(config.supabaseUrl!, config.supabaseAnonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }
  return serverClient
}
