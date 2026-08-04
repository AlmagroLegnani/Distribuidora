import { Response, NextFunction } from 'express';
import * as orderService from '../services/orderService';
import { AuthRequest } from '../middleware/auth';
import { OrderStatus } from '@stockapp/db';
import { parsePagination } from '../lib/pagination';
import { buildOrderReceiptPdf } from '../lib/receiptPdf';
import { sendMail } from '../lib/mailer';

export async function list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, documento, dateFrom, dateTo } = req.query as Record<string, string | undefined>;
    const { data, total } = await orderService.listOrders(
      req.distributorId!,
      {
        status: status as OrderStatus | undefined,
        documento,
        dateFrom,
        dateTo,
      },
      parsePagination(req.query as Record<string, unknown>)
    );
    res.setHeader('X-Total-Count', String(total));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await orderService.getOrderById(req.distributorId!, req.params.id);
    res.json(order);
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const order = await orderService.updateOrderStatus(
      req.distributorId!,
      req.params.id,
      req.body.status as OrderStatus,
      {
        date: req.body.estimatedDeliveryDate || undefined,
        time: req.body.estimatedDeliveryTime || undefined,
      }
    );
    res.json(order);
  } catch (err) {
    next(err);
  }
}

/**
 * Generates a printable order receipt (PDF) and, if the client has an email
 * on file AND the distributor has "Enviar email de confirmación al cliente"
 * activado en Configuración, emails it to them as an attachment. Returns the
 * PDF so the distributor can also view/print it right away from the
 * backoffice. This is an internal comprobante, not a legally valid CFE — see
 * lib/receiptPdf.ts for details.
 */
export async function getReceipt(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const order = await orderService.getOrderForReceipt(req.distributorId!, req.params.id);
    const pdfBuffer = await buildOrderReceiptPdf(order);
    const shortId = order.id.slice(-8).toUpperCase();

    let emailedTo: string | null = null;
    const sendClientEmail = order.distributor.settings?.sendClientEmail ?? true;
    if (sendClientEmail && order.client.email) {
      try {
        await sendMail({
          to: order.client.email,
          subject: `Comprobante de tu pedido #${shortId} — ${order.distributor.name}`,
          html: `<p>Hola${order.client.name ? ' ' + order.client.name : ''},</p>
            <p>Te adjuntamos el comprobante de tu pedido realizado a <strong>${order.distributor.name}</strong>.</p>
            <p>Gracias por tu compra.</p>`,
          attachments: [
            {
              filename: `comprobante-pedido-${shortId}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ],
        });
        emailedTo = order.client.email;
      } catch (err) {
        console.error(`[${new Date().toISOString()}] Failed to email order receipt to client:`, err);
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="comprobante-pedido-${shortId}.pdf"`);
    if (emailedTo) res.setHeader('X-Client-Email', emailedTo);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

export async function getDashboard(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = await orderService.getDashboardStats(req.distributorId!);
    res.json(stats);
  } catch (err) {
    next(err);
  }
}
