import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from './supabase/server';
import { ADMIN_ROLES, CUSTOMER_ROLES, STAFF_ROLES } from './labels';
import type { Customer, Profile } from './types';

/** Ingelogde gebruiker + profiel. Stuurt door naar /login of /geen-toegang. */
export const getSession = cache(async () => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single<Profile>();
  if (!profile || profile.role === 'geen' || !profile.active) redirect('/geen-toegang');

  const isStaff = STAFF_ROLES.includes(profile.role);
  const isAdmin = ADMIN_ROLES.includes(profile.role);
  const isCustomer = CUSTOMER_ROLES.includes(profile.role);

  let customer: Customer | null = null;
  if (isCustomer && profile.customer_id) {
    const { data } = await supabase.from('customers').select('*').eq('id', profile.customer_id).single<Customer>();
    customer = data;
  }
  return { supabase, user, profile, isStaff, isAdmin, isCustomer, customer };
});

export async function requireStaff() {
  const s = await getSession();
  if (!s.isStaff) redirect('/');
  return s;
}

export async function requireAdmin() {
  const s = await getSession();
  if (!s.isAdmin) redirect('/');
  return s;
}
