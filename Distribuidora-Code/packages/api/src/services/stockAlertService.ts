import { prisma } from '../lib/prisma';
import { sendMail } from '../lib/mailer';
import type { PaginationParams } from '../lib/pagination';

/** Debajo de esta cantidad de unidades se considera "stock bajo" y se avisa al distribuidor. */
export const LOW_STOCK_THRESHOLD = 30;

function buildLowStockEmailHtml(productName: string, stock: number): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Aviso de stock bajo</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="background:#b45309;padding:20px;border-radius:8px 8px 0 0;">
    <h2 style="color:#fff;margin:0;">⚠️ Stock bajo</h2>
  </div>
  <div style="border:1px solid #e0e0e0;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
    <p>El producto <strong>${productName}</strong> tiene poco stock disponible.</p>
    <p style="font-size:18px;"><strong>Quedan ${stock} unidades</strong> (umbral de aviso: ${LOW_STOCK_THRESHOLD}).</p>
    <p style="color:#666;margin-top:20px;">Ingresa a tu backoffice para reponer el stock de este producto.</p>
  </div>
</body>
</html>`;
}

/**
 * Debe llamarse después de cualquier operación que pueda haber cambiado el
 * stock de un producto (venta/pedido, edición manual, ajuste de stock).
 *
 * Si el stock quedó por debajo de LOW_STOCK_THRESHOLD y todavía no se había
 * avisado (Product.lowStockAlerted === false), crea un StockAlert, envía un
 * email al distribuidor y marca el producto como "ya avisado" para no repetir
 * la alerta en cada pedido subsiguiente mientras el stock se mantenga bajo.
 *
 * Si el stock volvió a estar por encima del umbral, resetea esa marca para
 * poder avisar de nuevo si en el futuro vuelve a caer.
 *
 * Es "best effort": nunca debe hacer fallar el flujo de pedidos/stock que la
 * llama, así que cualquier error (por ejemplo de envío de email) se loguea y
 * se traga acá.
 */
export async function checkLowStock(distributorId: string, productId: string): Promise<void> {
  try {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.active) return;

    if (product.stock >= LOW_STOCK_THRESHOLD) {
      if (product.lowStockAlerted) {
        await prisma.product.update({
          where: { id: productId },
          data: { lowStockAlerted: false },
        });
      }
      return;
    }

    // Ya está por debajo del umbral, pero ya se había avisado y no se resolvió: no repetir.
    if (product.lowStockAlerted) return;

    const alert = await prisma.stockAlert.create({
      data: {
        distributorId,
        productId,
        productName: product.name,
        stockAtAlert: product.stock,
        threshold: LOW_STOCK_THRESHOLD,
      },
    });

    await prisma.product.update({
      where: { id: productId },
      data: { lowStockAlerted: true },
    });

    const distributor = await prisma.distributor.findUnique({
      where: { id: distributorId },
      include: { settings: true },
    });
    if (!distributor) return;

    const to = distributor.settings?.notificationEmail || distributor.email;
    try {
      await sendMail({
        to,
        subject: `Stock bajo: ${product.name} (quedan ${product.stock})`,
        html: buildLowStockEmailHtml(product.name, product.stock),
      });
      await prisma.stockAlert.update({
        where: { id: alert.id },
        data: { emailSentAt: new Date() },
      });
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Failed to send low-stock email:`, err);
    }
  } catch (err) {
    console.error(`[${new Date().toISOString()}] checkLowStock failed:`, err);
  }
}

function buildPaymentDueEmailHtml(distributorName: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Tu plan está por vencer</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="background:#b91c1c;padding:20px;border-radius:8px 8px 0 0;">
    <h2 style="color:#fff;margin:0;">⏰ Tu plan está por vencer</h2>
  </div>
  <div style="border:1px solid #e0e0e0;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
    <p>Hola ${distributorName},</p>
    <p style="font-size:16px;">${message}</p>
    <p style="color:#666;margin-top:20px;">Podés pagar directamente desde tu panel, en Configuración, o coordinarlo con nosotros según lo acordado.</p>
  </div>
</body>
</html>`;
}

/**
 * Crea un aviso de "se te vence el pago" para el distribuidor y le manda un
 * email. Lo dispara a mano el superadmin desde el panel de Distribuidoras
 * (ver platformService.notifyPaymentDue) cuando quiere avisarle que se
 * acerca su vencimiento; también queda guardado en su sección de
 * Notificaciones y dispara el modal la próxima vez que entre al panel.
 */
export async function createPaymentDueNotice(
  distributorId: string,
  message: string
): Promise<void> {
  const distributor = await prisma.distributor.findUnique({ where: { id: distributorId } });
  if (!distributor) throw new Error('Distributor not found');

  const alert = await prisma.stockAlert.create({
    data: {
      distributorId,
      type: 'PAYMENT_DUE',
      message,
    },
  });

  try {
    await sendMail({
      to: distributor.email,
      subject: 'Tu plan de TuStockApp está por vencer',
      html: buildPaymentDueEmailHtml(distributor.name, message),
    });
    await prisma.stockAlert.update({
      where: { id: alert.id },
      data: { emailSentAt: new Date() },
    });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] Failed to send payment-due email:`, err);
  }
}

export async function listStockAlerts(
  distributorId: string,
  pagination: PaginationParams = {}
): Promise<{ data: Awaited<ReturnType<typeof prisma.stockAlert.findMany>>; total: number }> {
  const where = { distributorId };
  const [data, total] = await Promise.all([
    prisma.stockAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...pagination,
    }),
    prisma.stockAlert.count({ where }),
  ]);
  return { data, total };
}

export async function getUnreadStockAlerts(distributorId: string) {
  return prisma.stockAlert.findMany({
    where: { distributorId, read: false },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getUnreadStockAlertCount(distributorId: string): Promise<number> {
  return prisma.stockAlert.count({ where: { distributorId, read: false } });
}

/** Marca como leídas las alertas indicadas (o todas las pendientes si no se pasan ids). */
export async function markStockAlertsRead(distributorId: string, ids?: string[]): Promise<void> {
  await prisma.stockAlert.updateMany({
    where: { distributorId, ...(ids && ids.length > 0 ? { id: { in: ids } } : {}) },
    data: { read: true },
  });
}

/** Elimina una notificación puntual. Filtra por distributorId para que nadie pueda borrar avisos ajenos. */
export async function deleteStockAlert(distributorId: string, id: string): Promise<void> {
  await prisma.stockAlert.deleteMany({ where: { id, distributorId } });
}
