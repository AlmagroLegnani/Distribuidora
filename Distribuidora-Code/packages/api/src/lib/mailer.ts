import nodemailer from 'nodemailer';
import { prisma } from './prisma';

/**
 * Aviso de confidencialidad que se agrega al pie de TODOS los correos que
 * manda la plataforma (código de acceso, comprobantes, notificaciones de
 * pedido, avisos de pago, etc.) — deja en claro que TuStockApp es solo un
 * intermediario técnico: no revisa ni conserva el contenido, y esta copia se
 * borra de nuestra bandeja de enviados pasada una hora (ver
 * emailCleanupService.ts). La comunicación queda en confidencialidad
 * exclusiva entre quien la manda y quien la recibe.
 */
const CONFIDENTIALITY_FOOTER = `
  <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e0e0e0;font-size:11px;color:#999;line-height:1.5;">
    Este mensaje fue enviado automáticamente por <strong>TuStockApp</strong>, que actúa únicamente
    como intermediario técnico entre las partes. No revisamos, almacenamos ni utilizamos el
    contenido de este correo — es un simple canal de envío, y esta copia se elimina de nuestra
    bandeja de enviados dentro de la hora. La confidencialidad de esta comunicación es exclusiva
    entre el remitente y el destinatario.
  </div>`;

function withConfidentialityFooter(html: string): string {
  if (html.includes('</body>')) {
    return html.replace('</body>', `${CONFIDENTIALITY_FOOTER}</body>`);
  }
  return html + CONFIDENTIALITY_FOOTER;
}

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  // `family: 4` no está en los tipos de @types/nodemailer pero nodemailer sí
  // lo reenvía al socket subyacente en tiempo de ejecución — por eso se arma
  // como `any` acá, para no pelear con el chequeo de propiedades del literal.
  const options: any = {
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587', 10),
    secure: SMTP_PORT === '465',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    // Forzamos IPv4: muchos hosts cloud (Railway incluido) tienen IPv6 mal
    // ruteado, lo que hace que nodemailer intente conectar por IPv6 primero,
    // se cuelgue, y termine en "Connection timeout" contra smtp.gmail.com.
    family: 4,
    // Timeouts explícitos para que, si la conexión SMTP falla igual, el error
    // salga rápido (segundos) en vez de dejar la request colgada hasta que el
    // proxy de la plataforma la corte sola con un 502.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  };
  return nodemailer.createTransport(options);
}

interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

/**
 * Sends a transactional email if SMTP is configured. If it isn't, logs the
 * content to the console instead of failing — this keeps flows like
 * "forgot password" usable in local/dev environments without real SMTP
 * credentials, matching the same graceful-degradation pattern used for
 * order notifications and MercadoPago.
 */
export async function sendMail(options: {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAttachment[];
}): Promise<void> {
  const transporter = createTransporter();
  const fromEmail = process.env.EMAIL_FROM || 'noreply@stockapp.com';

  if (!transporter) {
    console.warn(
      `[${new Date().toISOString()}] SMTP not configured — email NOT sent. To: ${options.to} | Subject: ${options.subject}\n${options.html}`
    );
    return;
  }

  const info = await transporter.sendMail({
    from: fromEmail,
    to: options.to,
    subject: options.subject,
    html: withConfidentialityFooter(options.html),
    attachments: options.attachments,
  });

  // Guardamos el Message-ID para que el job de limpieza (ver
  // emailCleanupService.ts) pueda borrar esta copia de "Enviados" en Gmail
  // pasada una hora. Si esto falla no rompe el envío del correo — es solo
  // best-effort para la limpieza posterior.
  if (info?.messageId) {
    try {
      await prisma.sentEmail.create({ data: { messageId: info.messageId } });
    } catch (err) {
      console.error(`[${new Date().toISOString()}] No se pudo registrar el mail para limpieza:`, err);
    }
  }
}
