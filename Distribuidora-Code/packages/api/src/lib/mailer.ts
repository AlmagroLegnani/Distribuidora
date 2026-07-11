import nodemailer from 'nodemailer';

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587', 10),
    secure: SMTP_PORT === '465',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/**
 * Sends a transactional email if SMTP is configured. If it isn't, logs the
 * content to the console instead of failing — this keeps flows like
 * "forgot password" usable in local/dev environments without real SMTP
 * credentials, matching the same graceful-degradation pattern used for
 * order notifications and MercadoPago.
 */
export async function sendMail(options: { to: string; subject: string; html: string }): Promise<void> {
  const transporter = createTransporter();
  const fromEmail = process.env.EMAIL_FROM || 'noreply@stockapp.com';

  if (!transporter) {
    console.warn(
      `[${new Date().toISOString()}] SMTP not configured — email NOT sent. To: ${options.to} | Subject: ${options.subject}\n${options.html}`
    );
    return;
  }

  await transporter.sendMail({ from: fromEmail, to: options.to, subject: options.subject, html: options.html });
}
