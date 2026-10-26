import 'server-only';
import { createAdminClient } from './supabase/admin';
import type { Role } from './types';

/**
 * Nodigt een gebruiker uit per e-mail. De rol en klant gaan mee als metadata;
 * de database maakt daar bij de eerste login het profiel van (trigger handle_new_user).
 * Aanroeper moet vooraf controleren dat de huidige gebruiker dit mag.
 */
export async function inviteUser(opts: { email: string; fullName: string; role: Role; customerId: string | null }) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(opts.email.trim().toLowerCase(), {
    data: { full_name: opts.fullName, role: opts.role, customer_id: opts.customerId },
    redirectTo: `${process.env.APP_URL ?? ''}/auth/callback`,
  });
  if (!error) return { ok: true as const };
  const exists = /already|registered|exists/i.test(error.message);
  return {
    ok: false as const,
    message: exists ? 'Er bestaat al een account met dit e-mailadres.' : 'De uitnodiging kon niet worden verstuurd.',
  };
}

/** Toegang aan- of uitzetten. Uitzetten blokkeert ook direct het inloggen. */
export async function setUserActive(userId: string, active: boolean) {
  const admin = createAdminClient();
  await admin.from('profiles').update({ active }).eq('id', userId);
  await admin.auth.admin.updateUserById(userId, { ban_duration: active ? 'none' : '876000h' });
}
