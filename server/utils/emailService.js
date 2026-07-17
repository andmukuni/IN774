import nodemailer from 'nodemailer';
import { getSmtpCredentials } from './systemSettingsHelpers.js';

let cachedTransport = null;
let cachedSignature = '';

function buildTransport(settings) {
  const signature = `${settings.smtpHost}|${settings.smtpPort}|${settings.smtpSecure}|${settings.smtpUser}|${Boolean(settings.smtpPassword)}`;
  if (cachedTransport && cachedSignature === signature) {
    return cachedTransport;
  }

  if (!settings.smtpEnabled) {
    throw new Error('Outbound email is disabled. Enable SMTP in System Settings.');
  }
  if (!settings.smtpHost?.trim()) {
    throw new Error('SMTP host is not configured.');
  }
  if (!settings.smtpUser?.trim()) {
    throw new Error('SMTP username is not configured.');
  }
  if (!settings.smtpPassword) {
    throw new Error('SMTP password is not configured.');
  }

  cachedTransport = nodemailer.createTransport({
    host: settings.smtpHost.trim(),
    port: Number(settings.smtpPort) || 587,
    secure: Boolean(settings.smtpSecure),
    auth: {
      user: settings.smtpUser.trim(),
      pass: settings.smtpPassword,
    },
  });
  cachedSignature = signature;
  return cachedTransport;
}

export async function sendEmail({ to, subject, html, text }) {
  const settings = await getSmtpCredentials();
  const transport = buildTransport(settings);
  const fromName = settings.smtpFromName?.trim() || settings.companyName?.trim() || 'Goodfellow Inventory';
  const fromEmail = settings.smtpFromEmail?.trim() || settings.smtpUser?.trim();
  if (!fromEmail) {
    throw new Error('SMTP from email is not configured.');
  }

  return transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    text,
    html,
  });
}

export function invalidateEmailTransportCache() {
  cachedTransport = null;
  cachedSignature = '';
}
