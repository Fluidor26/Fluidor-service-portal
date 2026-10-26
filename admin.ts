import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Client met de service role key: omzeilt alle rechten.
 * Alleen gebruiken nadat in code is gecontroleerd dat de gebruiker dit mag
 * (uitnodigen van gebruikers, e-mailadressen opzoeken voor meldingen).
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY ontbreekt in de omgeving.');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
