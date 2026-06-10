import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService';
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
