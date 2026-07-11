import nodemailer from 'nodemailer';

interface OrderItem {
  product: { name: string };
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface OrderNotificationData {
  id: string;
  total: number;
  createdAt: Date;
  notes: string | null;
  client: {
    rut: string;
    name: string | null;
    email: string | null;
  };
  items: OrderItem[];
}

interface DistributorSettings {
  notificationEmail: string | null;
  whatsappNumber: string | null;
  sendClientEmail: boolean;
  sendWhatsapp: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount);
}

function buildOrderHtml(order: OrderNotificationData, forClient = false): string {
  const shortId = order.id.slice(-8).toUpperCase();
  const itemRows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px;border:1px solid #e0e0e0;">${item.product.name}</td>
        <td style="padding:8px;border:1px solid #e0e0e0;text-align:center;">${item.quantity}</td>
        <td style="padding:8px;border:1px solid #e0e0e0;text-align:right;">${formatCurrency(item.unitPrice)}</td>
        <td style="padding:8px;border:1px solid #e0e0e0;text-align:right;font-weight:bold;">${formatCurrency(item.subtotal)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Pedido #${shortId}</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="background:#1e3a5f;padding:20px;border-radius:8px 8px 0 0;margin-bottom:0;">
    <h2 style="color:#fff;margin:0;">🛒 ${forClient ? 'Confirmación de Pedido' : 'Nuevo Pedido Recibido'}</h2>
  </div>
  <div style="border:1px solid #e0e0e0;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
    <p><strong>Pedido #:</strong> ${shortId}</p>
    <p><strong>Fecha:</strong> ${new Date(order.createdAt).toLocaleString('es-CL')}</p>
    <p><strong>RUT:</strong> ${order.client.rut}</p>
    <p><strong>Empresa:</strong> ${order.client.name || 'No especificado'}</p>
    ${order.notes ? `<p><strong>Notas:</strong> ${order.notes}</p>` : ''}
    <h3 style="border-bottom:2px solid #1e3a5f;padding-bottom:8px;">Detalle del Pedido</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:8px;border:1px solid #e0e0e0;text-align:left;">Producto</th>
          <th style="padding:8px;border:1px solid #e0e0e0;text-align:center;">Cantidad</th>
          <th style="padding:8px;border:1px solid #e0e0e0;text-align:right;">Precio Unit.</th>
          <th style="padding:8px;border:1px solid #e0e0e0;text-align:right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div style="text-align:right;padding:15px;background:#f0f7ff;border-radius:6px;">
      <span style="font-size:20px;font-weight:bold;color:#1e3a5f;">
        TOTAL: ${formatCurrency(order.total)}
      </span>
    </div>
    ${
      forClient
        ? '<p style="margin-top:20px;color:#666;">Gracias por su pedido. Nos pondremos en contacto a la brevedad.</p>'
        : ''
    }
  </div>
</body>
</html>`;
}

function createTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT || '587', 10),
    secure: SMTP_PORT === '465',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

async function sendWhatsApp(order: OrderNotificationData, toNumber: string): Promise<void> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM } = process.env;

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    console.warn(`[${new Date().toISOString()}] WhatsApp skipped: Twilio credentials not configured`);
    return;
  }

  const shortId = order.id.slice(-8).toUpperCase();
  const itemsList = order.items
    .map((i) => `- ${i.product.name} x${i.quantity} — ${formatCurrency(i.subtotal)}`)
    .join('\n');

  const message =
    `🛒 *Nuevo Pedido Recibido*\n` +
    `📋 Pedido #${shortId}\n` +
    `👤 RUT: ${order.client.rut}\n` +
    `🏢 Empresa: ${order.client.name || 'No especificado'}\n\n` +
    `Productos:\n${itemsList}\n\n` +
    `💰 *Total: ${formatCurrency(order.total)}*\n` +
    `📅 ${new Date(order.createdAt).toLocaleString('es-CL')}`;

  // Dynamic import to avoid loading twilio if not needed
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const twilio = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  await twilio.messages.create({
    body: message,
    from: `whatsapp:${TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${toNumber}`,
  });

  console.log(`[${new Date().toISOString()}] WhatsApp sent to ${toNumber}`);
}

export async function sendOrderNotifications(
  order: OrderNotificationData,
  settings: DistributorSettings
): Promise<void> {
  const transporter = createTransporter();
  const shortId = order.id.slice(-8).toUpperCase();
  const fromEmail = process.env.EMAIL_FROM || 'noreply@stockapp.com';

  // Notify distributor
  if (settings.notificationEmail && transporter) {
    try {
      await transporter.sendMail({
        from: fromEmail,
        to: settings.notificationEmail,
        subject: `Nuevo Pedido #${shortId} - RUT: ${order.client.rut}`,
        html: buildOrderHtml(order, false),
      });
      console.log(`[${new Date().toISOString()}] Email sent to distributor: ${settings.notificationEmail}`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Failed to send email to distributor:`, err);
    }
  }

  // Notify client
  if (settings.sendClientEmail && order.client.email && transporter) {
    try {
      await transporter.sendMail({
        from: fromEmail,
        to: order.client.email,
        subject: `Confirmación de Pedido #${shortId}`,
        html: buildOrderHtml(order, true),
      });
      console.log(`[${new Date().toISOString()}] Email sent to client: ${order.client.email}`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Failed to send email to client:`, err);
    }
  }

  // WhatsApp
  if (settings.sendWhatsapp && settings.whatsappNumber) {
    try {
      await sendWhatsApp(order, settings.whatsappNumber);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Failed to send WhatsApp:`, err);
    }
  }
}
