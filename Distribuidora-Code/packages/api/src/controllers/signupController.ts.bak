import { Request, Response, NextFunction } from 'express';
import * as signupService from '../services/signupService';
import * as platformService from '../services/platformService';
import { DISTRIBUTOR_CATEGORIES } from '../lib/distributorCategories';

export async function listPlans(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const plans = await platformService.listActivePlans();
    res.json(plans);
  } catch (err) {
    next(err);
  }
}

export function listCategories(_req: Request, res: Response): void {
  res.json(DISTRIBUTOR_CATEGORIES);
}

export async function signup(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await signupService.signupDistributor(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
