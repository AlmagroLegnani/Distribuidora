import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { reconcileSubscription } from '../services/subscriptionService';

export interface AuthRequest extends Request {
  distributorId?: string;
}

interface JwtPayload {
  distributorId: string;
  email: string;
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  let distributorId: string;
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    const decoded = jwt.verify(token, secret) as JwtPayload;
    distributorId = decoded.distributorId;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Unauthorized: Token expired' });
      return;
    }
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
    return;
  }

  // Lazily reconcile subscription state (trial/grace-period expiry) since
  // there is no background job scheduler in this stack.
  try {
    await reconcileSubscription(distributorId);
  } catch {
    // Never block a request just because the reconcile step failed
  }

  const distributor = await prisma.distributor.findUnique({
    where: { id: distributorId },
    select: { active: true },
  });

  if (!distributor || !distributor.active) {
    res.status(402).json({
      error:
        'Tu suscripción no está activa. Regulariza tu pago para seguir usando la plataforma.',
    });
    return;
  }

  req.distributorId = distributorId;
  next();
}
