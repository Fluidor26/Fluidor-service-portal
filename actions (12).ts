'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin, getSession } from '@/lib/session';
import { inviteUser, setUserActive } from '@/lib/users';
import { STAFF_ROLES } from '@/lib/labels';
import type { Role } from '@/lib/types';

const back = (path: string, msg: string, kind: 'fout' | 'ok' = 'fout') =>
  redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);
const str = (fd: FormData, k: string) => String(fd.get(k) || '').trim();
const opt = (fd: FormData, k: string) => str(fd, k) || null;

export async function createCustomer(fd: FormData) {
  const { supabase } = await requireAdmin();
  const name = str(fd, 'name');
  if (!name) back('/beheer/klanten', 'Vul de naam van de klant in.');
  const { data, error } = await supabase.from('customers')
    .insert({ name, city: opt(fd, 'city'), erp_number: opt(fd, 'erp_number'), contract: fd.get('contract') === 'service_maintenance_plan' ? 'service_maintenance_plan' : 'geen' })
    .select('id').single();
  if (error || !data) back('/beheer/klanten', error?.code === '23505' ? 'Dit debiteurnummer bestaat al.' : 'Klant kon niet worden aangemaakt.');
  revalidatePath('/beheer/klanten');
  back(`/beheer/klanten/${data!.id}`, `${name} is aangemaakt. Voeg nu locaties, installaties en gebruikers toe.`, 'ok');
}

export async function updateCustomer(fd: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = str(fd, 'id');
  const self = `/beheer/klanten/${id}`;
  const { error } = await supabase.from('customers').update({
    name: str(fd, 'name'), city: opt(fd, 'city'), erp_number: opt(fd, 'erp_number'),
    contract: fd.get('contract') === 'service_maintenance_plan' ? 'service_maintenance_plan' : 'geen',
  }).eq('id', id);
  if (error) back(self, 'Gegevens konden niet worden opgeslagen.');
  await supabase.from('internal_notes').upsert({ entity: 'customer', entity_id: id, body: str(fd, 'notes'), updated_by: user.id, updated_at: new Date().toISOString() });
  revalidatePath(self);
  back(self, 'Klantgegevens opgeslagen.', 'ok');
}

export async function addLocation(fd: FormData) {
  const { supabase } = await requireAdmin();
  const customer_id = str(fd, 'customer_id');
  const self = `/beheer/klanten/${customer_id}`;
  if (!str(fd, 'name')) back(self, 'Vul de naam van de locatie in.');
  const { error } = await supabase.from('locations').insert({ customer_id, name: str(fd, 'name'), address: opt(fd, 'address') });
  if (error) back(self, 'Locatie kon niet worden toegevoegd.');
  revalidatePath(self);
  back(self, 'Locatie toegevoegd.', 'ok');
}

export async function addLine(fd: FormData) {
  const { supabase } = await requireAdmin();
  const customer_id = str(fd, 'customer_id');
  const self = `/beheer/klanten/${customer_id}`;
  if (!str(fd, 'name')) back(self, 'Vul de naam van de productielijn in.');
  const { error } = await supabase.from('production_lines').insert({ customer_id, location_id: opt(fd, 'location_id'), name: str(fd, 'name') });
  if (error) back(self, 'Productielijn kon niet worden toegevoegd.');
  revalidatePath(self);
  back(self, 'Productielijn toegevoegd.', 'ok');
}

export async function addMachine(fd: FormData) {
  const { supabase } = await requireAdmin();
  const customer_id = str(fd, 'customer_id');
  const self = `/beheer/klanten/${customer_id}`;
  const project_number = str(fd, 'project_number').toUpperCase();
  if (!project_number || !str(fd, 'name')) back(self, 'Vul projectnummer en naam van de installatie in.');
  const { data, error } = await supabase.from('machines').insert({
    customer_id, project_number, name: str(fd, 'name'),
    serial_number: opt(fd, 'serial_number'), machine_type: opt(fd, 'machine_type'),
    location_id: opt(fd, 'location_id'), line_id: opt(fd, 'line_id'),
    delivered_on: opt(fd, 'delivered_on'), contract_start: opt(fd, 'contract_start'), next_service_on: opt(fd, 'next_service_on'),
  }).select('id').single();
  if (error || !data) back(self, error?.code === '23505' ? `Projectnummer ${project_number} bestaat al.` : 'Installatie kon niet worden toegevoegd.');
  revalidatePath(self);
  back(`/installaties/${data!.id}`, `${project_number} is toegevoegd. Upload hier de documentatie.`, 'ok');
}

export async function inviteCustomerUser(fd: FormData) {
  const s = await getSession();
  const isOwnCustomerAdmin = s.profile.role === 'klant_beheerder';
  if (!s.isAdmin && !isOwnCustomerAdmin) redirect('/');
  // Een klantbeheerder kan alleen collega's van de eigen klant uitnodigen, als klantgebruiker.
  const customer_id = isOwnCustomerAdmin ? s.profile.customer_id! : str(fd, 'customer_id');
  const role: Role = s.isAdmin && fd.get('role') === 'klant_beheerder' ? 'klant_beheerder' : 'klant_gebruiker';
  const self = isOwnCustomerAdmin ? '/collegas' : `/beheer/klanten/${customer_id}`;
  const email = str(fd, 'email');
  const fullName = str(fd, 'full_name');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !fullName) back(self, 'Vul naam en een geldig e-mailadres in.');
  const res = await inviteUser({ email, fullName, role, customerId: customer_id });
  if (!res.ok) back(self, res.message);
  revalidatePath(self);
  back(self, `Uitnodiging verstuurd naar ${email}.`, 'ok');
}

export async function toggleUser(fd: FormData) {
  const s = await getSession();
  const id = str(fd, 'id');
  const active = fd.get('active') === '1';
  const self = str(fd, 'back') || '/';
  if (id === s.user.id) back(self, 'U kunt uw eigen toegang niet uitzetten.');
  if (!s.isAdmin) {
    // Klantbeheerder: alleen collega's van de eigen klant
    const { data: target } = await s.supabase.from('profiles').select('customer_id, role').eq('id', id).maybeSingle();
    if (s.profile.role !== 'klant_beheerder' || !target || target.customer_id !== s.profile.customer_id || target.role !== 'klant_gebruiker') {
      back(self, 'U heeft geen rechten om deze gebruiker te wijzigen.');
    }
  }
  await setUserActive(id, active);
  revalidatePath(self);
  back(self, active ? 'Toegang hersteld.' : 'Toegang ingetrokken. Deze gebruiker kan niet meer inloggen.', 'ok');
}

export async function setStaffRole(fd: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = str(fd, 'id');
  const role = str(fd, 'role') as Role;
  if (![...STAFF_ROLES, 'geen'].includes(role)) back('/beheer/medewerkers', 'Onbekende rol.');
  if (id === user.id && role !== 'beheerder' && role !== 'coordinator') back('/beheer/medewerkers', 'U kunt uw eigen beheerrechten niet intrekken.');
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id).is('customer_id', null);
  if (error) back('/beheer/medewerkers', 'Rol kon niet worden gewijzigd.');
  revalidatePath('/beheer/medewerkers');
  back('/beheer/medewerkers', 'Rol bijgewerkt.', 'ok');
}
