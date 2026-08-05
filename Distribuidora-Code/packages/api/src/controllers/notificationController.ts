import { Response, NextFunction } from 'express';
import * as stockAlertService from '../services/stockAlertService';
import * as reorderSuggestionService from '../services/reorderSuggestionService';
import { AuthRequest } from '../middleware/auth';
import { parsePagination } from '../lib/pagination';

// GET /api/notifications — listado completo para la sección de Notificaciones
export async function list(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { data, total } = await stockAlertService.listStockAlerts(
      req.distributorId!,
      parsePagination(req.query as Record<string, unknown>)
    );
    res.setHeader('X-Total-Count', String(total));
    res.json(data);
  } catch (err) {
    next(err);
  }
}

// GET /api/notifications/unread — usado por el modal al ingresar al panel
export async function unread(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const alerts = await stockAlertService.getUnreadStockAlerts(req.distributorId!);
    res.json(alerts);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/notifications/read — marca como leídas (body: { ids?: string[] })
export async function markRead(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : undefined;
    await stockAlertService.markStockAlertsRead(req.distributorId!, ids);
    res.json({ message: 'Notificaciones marcadas como leídas' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/notifications/:id — elimina una notificación puntual
export async function remove(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    await stockAlertService.deleteStockAlert(req.distributorId!, req.params.id);
    res.json({ message: 'Notificación eliminada' });
  } catch (err) {
    next(err);
  }
}

// POST /api/notifications/:id/send-reminder — botón "Enviar recordatorio" de
// una sugerencia de recompra (type = REORDER_SUGGESTION): manda un push al
// cliente asociado.
export async function sendReminder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await reorderSuggestionService.sendReorderReminder(req.distributorId!, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
