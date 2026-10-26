'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function origin() {
  return process.env.APP_URL || headers().get('origin') || '';
}

/** Medewerkers: inloggen met het Microsoft-account (Entra ID). */
export async function signInWithMicrosoft() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: { scopes: 'email openid profile', redirectTo: `${origin()}/auth/callback` },
  });
  if (error || !data.url) redirect('/login?fout=' + encodeURIComponent('Inloggen met Microsoft is niet gelukt. Probeer het opnieuw.'));
  redirect(data.url);
}

/** Klanten: inloglink per e-mail. Alleen voor bestaande (uitgenodigde) gebruikers. */
export async function sendLoginLink(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect('/login?fout=' + encodeURIComponent('Vul een geldig e-mailadres in.'));
  }
  const supabase = createClient();
  await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin()}/auth/callback` },
  });
  // Altijd dezelfde melding, zodat niet af te leiden is welke adressen een account hebben.
  redirect('/login?verstuurd=1');
}
