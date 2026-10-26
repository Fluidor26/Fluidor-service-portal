'use server';

import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { DOC_CATEGORY_LABEL } from '@/lib/labels';
import { requireStaff } from '@/lib/session';

const back = (path: string, msg: string, kind: 'fout' | 'ok' = 'fout') =>
  redirect(`${path}?${kind}=${encodeURIComponent(msg)}`);

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = /\.(pdf|docx?|xlsx?|dwg|dxf|step|stp|png|jpe?g|txt|zip)$/i;

export async function uploadDocument(formData: FormData) {
  const { supabase, user } = await requireStaff();
  const machine_id = String(formData.get('machine_id') || '');
  const self = `/installaties/${machine_id}`;
  const file = formData.get('file');
  const title = String(formData.get('title') || '').trim();
  const category = String(formData.get('category') || 'overig');
  const revision = String(formData.get('revision') || '').trim() || null;
  const visibility = formData.get('visibility') === 'extern' ? 'extern' : 'intern';

  if (!(file instanceof File) || file.size === 0) back(self, 'Kies een bestand.');
  const f = file as File;
  if (f.size > MAX_BYTES) back(self, 'Het bestand is groter dan 25 MB.');
  if (!ALLOWED.test(f.name)) back(self, 'Dit bestandstype is niet toegestaan.');
  if (!(category in DOC_CATEGORY_LABEL)) back(self, 'Onbekende categorie.');

  const { data: m } = await supabase.from('machines').select('customer_id').eq('id', machine_id).single();
  if (!m) back(self, 'Onbekende installatie.');

  const safeName = f.name.replace(/[^\w.\-]+/g, '_').slice(-120);
  const path = `${m!.customer_id}/${machine_id}/${randomUUID()}-${safeName}`;
  const up = await supabase.storage.from('documenten').upload(path, f, { contentType: f.type || 'application/octet-stream' });
  if (up.error) back(self, 'Uploaden is mislukt. Probeer het opnieuw.');

  const { error } = await supabase.from('documents').insert({
    machine_id, title: title || f.name, category, revision, visibility,
    storage_path: path, file_name: f.name, size_bytes: f.size, uploaded_by: user.id,
  });
  if (error) {
    await supabase.storage.from('documenten').remove([path]);
    back(self, 'Het document kon niet worden opgeslagen.');
  }
  revalidatePath(self);
  back(self, `${title || f.name} is toegevoegd${visibility === 'extern' ? ' en zichtbaar voor de klant' : ' (alleen intern)'}.`, 'ok');
}

export async function setDocumentVisibility(formData: FormData) {
  const { supabase } = await requireStaff();
  const id = String(formData.get('id') || '');
  const machine_id = String(formData.get('machine_id') || '');
  const visibility = formData.get('visibility') === 'extern' ? 'extern' : 'intern';
  await supabase.from('documents').update({ visibility }).eq('id', id);
  revalidatePath(`/installaties/${machine_id}`);
  redirect(`/installaties/${machine_id}#documenten`);
}

export async function deleteDocument(formData: FormData) {
  const { supabase } = await requireStaff();
  const id = String(formData.get('id') || '');
  const machine_id = String(formData.get('machine_id') || '');
  const { data: d } = await supabase.from('documents').select('storage_path, title').eq('id', id).single();
  if (d) {
    await supabase.storage.from('documenten').remove([d.storage_path]);
    await supabase.from('documents').delete().eq('id', id);
  }
  revalidatePath(`/installaties/${machine_id}`);
  back(`/installaties/${machine_id}`, `${d?.title ?? 'Document'} is verwijderd.`, 'ok');
}

export async function updateMachine(formData: FormData) {
  const { supabase, user } = await requireStaff();
  const id = String(formData.get('id') || '');
  const self = `/installaties/${id}`;
  const val = (k: string) => String(formData.get(k) || '').trim() || null;
  const { error } = await supabase.from('machines').update({
    name: val('name') ?? undefined,
    serial_number: val('serial_number'),
    machine_type: val('machine_type'),
    delivered_on: val('delivered_on'),
    contract_start: val('contract_start'),
    next_service_on: val('next_service_on'),
  }).eq('id', id);
  if (error) back(self, 'Gegevens konden niet worden opgeslagen.');
  await supabase.from('internal_notes').upsert({
    entity: 'machine', entity_id: id, body: String(formData.get('notes') || ''), updated_by: user.id, updated_at: new Date().toISOString(),
  });
  revalidatePath(self);
  back(self, 'Installatiegegevens opgeslagen.', 'ok');
}

export async function addComponent(formData: FormData) {
  const { supabase } = await requireStaff();
  const machine_id = String(formData.get('machine_id') || '');
  const self = `/installaties/${machine_id}`;
  const description = String(formData.get('description') || '').trim();
  if (!description) back(self, 'Vul een omschrijving in.');
  const { error } = await supabase.from('components').insert({
    machine_id,
    description,
    article_number: String(formData.get('article_number') || '').trim() || null,
    quantity: Number(formData.get('quantity') || 1),
    is_spare_part: formData.get('is_spare_part') === 'on',
  });
  if (error) back(self, 'Onderdeel kon niet worden toegevoegd.');
  revalidatePath(self);
  redirect(self + '#onderdelen');
}

export async function deleteComponent(formData: FormData) {
  const { supabase } = await requireStaff();
  const machine_id = String(formData.get('machine_id') || '');
  await supabase.from('components').delete().eq('id', String(formData.get('id') || ''));
  revalidatePath(`/installaties/${machine_id}`);
  redirect(`/installaties/${machine_id}#onderdelen`);
}
