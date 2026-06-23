const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  } else {
    // No SMTP configured: use a JSON transport so the app still works in dev.
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

/**
 * Sends an email. attachments is an array of { filename, content (Buffer) }.
 */
async function sendMail({ to, subject, text, html, attachments }) {
  const t = getTransporter();
  const from = process.env.SMTP_FROM || 'Kafé Lumière <no-reply@kafelumiere.test>';
  const info = await t.sendMail({ from, to, subject, text, html, attachments });
  if (!process.env.SMTP_HOST) {
    console.log(`[email] (dev jsonTransport) -> ${to} | ${subject}`);
  }
  return info;
}

module.exports = { sendMail };
