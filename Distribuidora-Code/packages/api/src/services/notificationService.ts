import { IvaType } from '@prisma/client';
import { sendMail } from '../lib/mailer';
import { IVA_LABELS, ivaAmountFromFinalPrice } from '../lib/iva';

interface OrderItem {
  product: { name: string };
  quantity: number;
  unitPrice: number;
  subtotal: number;
  ivaType: IvaType;
}

interface OrderNotificationData {
  id: string;
  total: number;
  createdAt: Date;
  notes: string | null;
  client: {
    rut: string | null;
    cedula: string | null;
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
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 0,
  }).format(amount);
}

function documentLine(client: { rut: string | null; cedula: string | null }): { label: string; value: string } {
  return client.rut ? { label: 'RUT', value: client.rut } : { label: 'Cédula', value: client.cedula || '' };
}

function buildOrderHtml(order: OrderNotificationData, forClient = false): string {
  const shortId = order.id.slice(-8).toUpperCase();
  const itemRows = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px;border:1px solid #e0e0e0;">${item.product.name}</td>
        <td style="padding:8px;border:1px solid #e0e0e0;text-align:center;">${item.quantity}</td>
        <td style="padding:8px;border:1px solid #e0e0e0;text-align:center;">${IVA_LABELS[item.ivaType]}</td>
        <td style="padding:8px;border:1px solid #e0e0e0;text-align:right;">${formatCurrency(item.unitPrice)}</td>
        <td style="padding:8px;border:1px solid #e0e0e0;text-align:right;font-weight:bold;">${formatCurrency(item.subtotal)}</td>
      </tr>`
    )
    .join('');

  // Discriminación de IVA por tasa — mismo cálculo que el comprobante PDF y
  // la pantalla de confirmación del cliente: el precio ya incluye el IVA,
  // así que se calcula "hacia atrás" cuánto de ese precio es impuesto.
  const subtotalByIva: Record<IvaType, number> = { BASICA: 0, MINIMA: 0 };
  for (const item of order.items) {
    subtotalByIva[item.ivaType] += item.subtotal;
  }
  const ivaTypesUsed = (Object.keys(subtotalByIva) as IvaType[]).filter(
    (t) => subtotalByIva[t] > 0
  );
  const ivaBreakdownHtml =
    ivaTypesUsed.length > 0
      ? `
    <div style="padding:12px 15px;background:#f5f5f5;border-radius:6px;margin-bottom:20px;">
      <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#666;">Discriminación de IVA (incluido en el precio)</p>
      ${ivaTypesUsed
        .map((ivaType) => {
          const subtotal = subtotalByIva[ivaType];
          const ivaAmount = ivaAmountFromFinalPrice(subtotal, ivaType);
          return `<p style="margin:2px 0;font-size:12px;color:#666;">${IVA_LABELS[ivaType]} — gravado: ${formatCurrency(subtotal)} · IVA contenido: ${formatCurrency(ivaAmount)}</p>`;
        })
        .join('')}
    </div>`
      : '';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Pedido #${shortId}</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="background:#1e3a5f;padding:20px;border-radius:8px 8px 0 0;margin-bottom:0;">
    <h2 style="color:#fff;margin:0;">🛒 ${forClient ? 'Confirmación de Pedido' : 'Nuevo Pedido Recibido'}</h2>
  </div>
  <div style="border:1px solid #e0e0e0;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
    <p><strong>Pedido #:</strong> ${shortId}</p>
    <p><strong>Fecha:</strong> ${new Date(order.createdAt).toLocaleString('es-UY')}</p>
    <p><strong>${documentLine(order.client).label}:</strong> ${documentLine(order.client).value}</p>
    <p><strong>Razón Social:</strong> ${order.client.name || 'No especificado'}</p>
    ${order.notes ? `<p><strong>Notas:</strong> ${order.notes}</p>` : ''}
    <h3 style="border-bottom:2px solid #1e3a5f;padding-bottom:8px;">Detalle del Pedido</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:8px;border:1px solid #e0e0e0;text-align:left;">Producto</th>
          <th style="padding:8px;border:1px solid #e0e0e0;text-align:center;">Cantidad</th>
          <th style="padding:8px;border:1px solid #e0e0e0;text-align:center;">IVA</th>
          <th style="padding:8px;border:1px solid #e0e0e0;text-align:right;">Precio Unit.</th>
          <th style="padding:8px;border:1px solid #e0e0e0;text-align:right;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div style="text-align:right;padding:15px;background:#f0f7ff;border-radius:6px;margin-bottom:20px;">
      <span style="font-size:20px;font-weight:bold;color:#1e3a5f;">
        TOTAL: ${formatCurrency(order.total)}
      </span>
    </div>
    ${ivaBreakdownHtml}
    ${
      forClient
        ? '<p style="margin-top:20px;color:#666;">Gracias por su pedido. Nos pondremos en contacto a la brevedad.</p>'
        : ''
    }
  </div>
</body>
</html>`;
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

  const doc = documentLine(order.client);
  const message =
    `🛒 *Nuevo Pedido Recibido*\n` +
    `📋 Pedido #${shortId}\n` +
    `👤 ${doc.label}: ${doc.value}\n` +
    `🏢 Razón Social: ${order.client.name || 'No especificado'}\n\n` +
    `Productos:\n${itemsList}\n\n` +
    `💰 *Total: ${formatCurrency(order.total)}*\n` +
    `📅 ${new Date(order.createdAt).toLocaleString('es-UY')}`;

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
  const shortId = order.id.slice(-8).toUpperCase();

  // Notify distributor
  if (settings.notificationEmail) {
    try {
      await sendMail({
        to: settings.notificationEmail,
        subject: `Nuevo Pedido #${shortId} - ${documentLine(order.client).label}: ${documentLine(order.client).value}`,
        html: buildOrderHtml(order, false),
      });
      console.log(`[${new Date().toISOString()}] Email sent to distributor: ${settings.notificationEmail}`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Failed to send email to distributor:`, err);
    }
  } else if (!settings.notificationEmail) {
    console.warn(
      `[${new Date().toISOString()}] No se mandó aviso de pedido a la distribuidora: no tiene "Email de notificaciones" cargado en Configuración.`
    );
  }

  // Notify client
  if (settings.sendClientEmail && order.client.email) {
    try {
      await sendMail({
        to: order.client.email,
        subject: `Confirmación de Pedido #${shortId}`,
        html: buildOrderHtml(order, true),
      });
      console.log(`[${new Date().toISOString()}] Email sent to client: ${order.client.email}`);
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Failed to send email to client:`, err);
    }
  } else if (settings.sendClientEmail && !order.client.email) {
    console.warn(
      `[${new Date().toISOString()}] No se mandó confirmación al cliente: el cliente (documento ${
        order.client.rut || order.client.cedula || '?'
      }) no tiene email cargado.`
    );
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
