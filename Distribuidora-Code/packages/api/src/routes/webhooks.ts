import { Router, Request, Response } from 'express';
import * as mercadopagoService from '../services/mercadopagoService';

const router = Router();

// POST /api/webhooks/mercadopago — payment notifications (no auth: MercadoPago calls this directly)
router.post('/mercadopago', async (req: Request, res: Response) => {
  try {
    await mercadopagoService.handlePaymentWebhook(req.query as Record<string, unknown>, req.body);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] MercadoPago webhook error:`, err);
  }
  // Always ack 200 so MercadoPago doesn't endlessly retry a notification we
  // already logged/handled (or intentionally ignored, e.g. wrong type).
  res.sendStatus(200);
});

export default router;
