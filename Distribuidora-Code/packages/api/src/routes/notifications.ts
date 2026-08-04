import { Router } from 'express';
import * as notificationController from '../controllers/notificationController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// GET /api/notifications
router.get('/', notificationController.list);

// GET /api/notifications/unread
router.get('/unread', notificationController.unread);

// PATCH /api/notifications/read
router.patch('/read', notificationController.markRead);

// DELETE /api/notifications/:id
router.delete('/:id', notificationController.remove);

// POST /api/notifications/:id/send-reminder
router.post('/:id/send-reminder', notificationController.sendReminder);

export default router;
