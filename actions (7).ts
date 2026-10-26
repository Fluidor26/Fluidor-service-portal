'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { PRIORITY_LABEL, STATUS_LABEL, TYPES } from '@/lib/labels';
import { sendMail, ticketUrl } from '@/lib/notify';
import { getSession, requireStaff } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import type { TicketStatus, TicketType } from '@/lib/types';

const back = (path: string, msg: string, kind: 'fout' | 'ok' = 'fout') =>
  redirect(`${path}${path.includes('?') ? '&' : '?'}${kind}=${encodeURIComponent(msg)}`);

/** E-mailadressen opzoeken voor meldingen. Faalt stil als de service key ontbreekt. */
async function emailsOf(ids: (string | null | undefined)[]) {
  const wanted = ids.filter((x): x is string => !!x);
  if (!wanted.length || !process.env.SUPABASE_SERVICE_ROLE_KEY) return [];
  const { data } = await createAdminClient().from('profiles').select('email').in('id', wanted).eq('active', true);
  return (data ?? []).map((r: { email: string }) => r.email);
}

export async function createTicket(formData: FormData) {
  const { supabase, user, profile } = await getSession();
  const machine_id = String(formData.get('machine_id') || '');
  const type = String(formData.get('type') || '') as TicketType;
  const priority = Number(formData.get('priority') || 2);
  const title = String(formData.get('title') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const contact_name = String(formData.get('contact_name') || '').trim() || profile.full_name;
  const contact_phone = String(formData.get('contact_phone') || '').trim() || null;

  const self = `/tickets/nieuw?machine=${encodeURIComponent(machine_id)}`;
  if (!machine_id) back(self, 'Kies een installatie.');
  if (!TYPES.includes(type)) back(self, 'Kies het soort aanvraag.');
  if (![1, 2, 3, 4].includes(priority)) back(self, 'Kies een prioriteit.');
  if (title.length < 3) back(self, 'Vul een onderwerp in van minimaal 3 tekens.');
  if (!description) back(self, 'Beschrijf wat er aan de hand is.');

  const { data, error } = await supabase
    .from('tickets')
    .insert({ machine_id, type, priority, title: title.slice(0, 160), description, contact_name, contact_phone, created_by: user.id })
    .select('id, number')
    .single();
  if (error || !data) back(self, 'Het ticket kon niet worden opgeslagen. Controleer de gegevens en probeer het opnieuw.');

  const { data: m } = await supabase.from('machines').select('project_number, name, customers(name)').eq('id', machine_id).single();
  const machine = m as unknown as { project_number: string; name: string; customers: { name: string } } | null;
  await sendMail(
    process.env.SERVICEDESK_EMAIL,
    `[${data!.number}] ${priority === 4 ? 'MACHINE STAAT STIL – ' : ''}${title}`,
    [
      `Nieuw serviceticket ${data!.number}`,
      `Klant: ${machine?.customers?.name ?? ''}`,
      `Machine: ${machine?.project_number ?? ''} – ${machine?.name ?? ''}`,
      `Prioriteit: ${PRIORITY_LABEL[priority]}`,
      `Gemeld door: ${contact_name ?? ''}${contact_phone ? ` (${contact_phone})` : ''}`,
      '',
      description,
      '',
      ticketUrl(data!.id),
    ].join('\n'),
  );

  revalidatePath('/tickets');
  back(`/tickets/${data!.id}`, `Ticket ${data!.number} is ingediend. Fluidor neemt het zo snel mogelijk in behandeling.`, 'ok');
}

export async function addMessage(formData: FormData) {
  const { supabase, user, isStaff, profile } = await getSession();
  const ticket_id = String(formData.get('ticket_id') || '');
  const body = String(formData.get('body') || '').trim();
  const kind = isStaff && formData.get('kind') === 'intern' ? 'intern' : 'bericht';
  const self = `/tickets/${ticket_id}`;
  if (!body) back(self, 'Typ eerst een bericht.');

  const { error } = await supabase.from('ticket_messages').insert({ ticket_id, author_id: user.id, kind, body });
  if (error) back(self, 'Het bericht kon niet worden geplaatst.');

  if (kind === 'bericht') {
    const { data: t } = await supabase.from('tickets').select('number, title, created_by, assignee_id').eq('id', ticket_id).single();
    if (t) {
      const to = isStaff ? await emailsOf([t.created_by]) : (await emailsOf([t.assignee_id])).concat(t.assignee_id ? [] : [process.env.SERVICEDESK_EMAIL ?? '']);
      await sendMail(to, `[${t.number}] Nieuwe reactie: ${t.title}`,
        `${profile.full_name} schreef:\n\n${body}\n\nBekijk en reageer: ${ticketUrl(ticket_id)}`);
    }
  }
  revalidatePath(self);
  redirect(self + '#verloop');
}

export async function updateTicket(formData: FormData) {
  const { supabase } = await requireStaff();
  const id = String(formData.get('ticket_id') || '');
  const status = String(formData.get('status') || '') as TicketStatus;
  const assignee_id = String(formData.get('assignee_id') || '') || null;
  const priority = Number(formData.get('priority') || 2);
  const planned_on = String(formData.get('planned_on') || '') || null;
  const self = `/tickets/${id}`;
  if (!(status in STATUS_LABEL)) back(self, 'Onbekende status.');

  const { data: before } = await supabase.from('tickets').select('status, number, title, created_by').eq('id', id).single();
  const { error } = await supabase.from('tickets').update({ status, assignee_id, priority, planned_on }).eq('id', id);
  if (error) back(self, 'Wijziging kon niet worden opgeslagen.');

  if (before && before.status !== status && ['ingepland', 'wacht_op_klant', 'opgelost'].includes(status)) {
    const extra = status === 'wacht_op_klant' ? '\nFluidor wacht op een reactie van u. Reageer via het portaal.' : '';
    await sendMail(await emailsOf([before.created_by]), `[${before.number}] Status: ${STATUS_LABEL[status]}`,
      `De status van uw ticket "${before.title}" is gewijzigd naar ${STATUS_LABEL[status]}.${planned_on && status === 'ingepland' ? `\nIngepland op ${planned_on}.` : ''}${extra}\n\n${ticketUrl(id)}`);
  }
  revalidatePath(self);
  revalidatePath('/tickets');
  back(self, 'Ticket bijgewerkt.', 'ok');
}
