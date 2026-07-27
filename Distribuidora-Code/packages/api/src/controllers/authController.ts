import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
import { createCheckoutForDistributor } from '../services/mercadopagoService';
import { AuthRequest } from '../middleware/auth';

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  // JWT is stateless — client discards token
  res.json({ message: 'Logged out successfully' });
}

export async function me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await authService.getProfile(req.distributorId!);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await authService.requestPasswordReset(req.body.email);
    res.json({ message: 'Si el email existe, enviamos un enlace para restablecer la contraseña.' });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { token, newPassword } = req.body;
    await authService.resetPassword(token, newPassword);
    res.json({ message: 'Contraseña restablecida correctamente.' });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.distributorId!, currentPassword, newPassword);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function createCheckout(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const checkoutUrl = await createCheckoutForDistributor(req.distributorId!);
    if (!checkoutUrl) {
      res.status(503).json({
        error:
          'El pago en línea no está disponible todavía. Contacta al administrador de la plataforma.',
      });
      return;
    }
    res.json({ checkoutUrl });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const settings = await authService.updateSettings(req.distributorId!, req.body);
    res.json(settings);
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const profile = await authService.updateProfile(req.distributorId!, req.body);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}
