import 'server-only';
import nodemailer from 'nodemailer';

/**
 * E-mailmeldingen via SMTP (bijv. een Microsoft 365-servicemailbox).
 * Zonder SMTP-instellingen gebeurt er niets; het portaal werkt dan gewoon zonder meldingen.
 * Een mislukte e-mail mag een ticketactie nooit laten mislukken.
 */
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

export async function sendMail(to: string | string[] | null | undefined, subject: string, text: string) {
  const t = getTransporter();
  const recipients = (Array.isArray(to) ? to : [to]).filter((x): x is string => !!x);
  if (!t || recipients.length === 0) return;
  try {
    await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: recipients, subject, text });
  } catch (err) {
    console.error('E-mailmelding mislukt:', err);
  }
}

export function ticketUrl(id: string) {
  return `${process.env.APP_URL ?? ''}/tickets/${id}`;
}
