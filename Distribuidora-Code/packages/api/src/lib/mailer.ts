import axios from 'axios';

/**
 * Aviso de confidencialidad que se agrega al pie de TODOS los correos que
 * manda la plataforma (código de acceso, comprobantes, notificaciones de
 * pedido, avisos de pago, etc.) — deja en claro que TuStockApp es solo un
 * intermediario técnico: no revisa ni almacena el contenido. La comunicación
 * queda en confidencialidad exclusiva entre quien la manda y quien la recibe.
 */
const CONFIDENTIALITY_FOOTER = `
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e0e0e0;font-size:11px;color:#999;line-height:1.5;">
    Este mensaje fue enviado automáticamente por <strong>TuStockApp</strong>, que actúa únicamente
    como intermediario técnico entre las partes. No revisamos, almacenamos ni utilizamos el
    contenido de este correo — es un simple canal de envío. La confidencialidad de esta
    comunicación es exclusiva entre el remitente y el destinatario.
  </div>`;

function withConfidentialityFooter(html: string): string {
  if (html.includes('</body>')) {
    return html.replace('</body>', `${CONFIDENTIALITY_FOOTER}</body>`);
  }
  return html + CONFIDENTIALITY_FOOTER;
}

interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

/**
 * Sends a transactional email through Resend's HTTPS API. We use Resend
 * instead of SMTP because most cloud hosts (Railway included) block outbound
 * SMTP ports (465/587) on their free/hobby tiers — an HTTPS API call sidesteps
 * that entirely.
 *
 * If RESEND_API_KEY isn't configured, logs the content to the console instead
 * of failing — this keeps flows like "forgot password" usable in local/dev
 * environments without real credentials, matching the same graceful-
 * degradation pattern used for order notifications and MercadoPago.
 */
export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}): Promise<void> {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  if (!RESEND_API_KEY) {
    console.warn(
      `[${new Date().toISOString()}] RESEND_API_KEY not configured — email NOT sent. To: ${options.to} | Subject: ${options.subject}\n${options.html}`
    );
    return;
  }

  await axios.post(
    'https://api.resend.com/emails',
    {
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: withConfidentialityFooter(options.html),
      attachments: options.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString('base64'),
      })),
    },
    {
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10_000,
    }
  );
}
