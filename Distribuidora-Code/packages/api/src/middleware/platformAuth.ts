import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface PlatformAuthRequest extends Request {
  platformAdminId?: string;
}

interface PlatformJwtPayload {
  platformAdminId: string;
  email: string;
  role: 'platform';
}

/**
 * Auth middleware for the super-admin (platform owner) app. Uses a distinct
 * token shape (role: 'platform') so a distributor's JWT can never be reused
 * to access platform-level endpoints, and vice versa.
 */
export function platformAuthMiddleware(
  req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    const decoded = jwt.verify(token, secret) as PlatformJwtPayload;
    if (decoded.role !== 'platform') {
      res.status(403).json({ error: 'Forbidden: not a platform token' });
      return;
    }
    req.platformAdminId = decoded.platformAdminId;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Unauthorized: Token expired' });
      return;
    }
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
}
