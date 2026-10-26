import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/** Supabase-client namens de ingelogde gebruiker. Alle rechten (RLS) gelden. */
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Aangeroepen vanuit een server component: de middleware ververst de sessie.
          }
        },
      },
    },
  );
}
