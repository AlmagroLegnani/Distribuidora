import { Response, NextFunction } from 'express';
import * as platformService from '../services/platformService';
import type { PlatformAuthRequest } from '../middleware/platformAuth';

export async function login(req: PlatformAuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await platformService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listDistributors(
  _req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const distributors = await platformService.listDistributors();
    res.json(distributors);
  } catch (err) {
    next(err);
  }
}

export async function createDistributor(
  req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await platformService.createDistributor(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getDistributor(
  req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const distributor = await platformService.getDistributorDetail(req.params.id);
    res.json(distributor);
  } catch (err) {
    next(err);
  }
}

export async function suspendDistributor(
  req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const distributor = await platformService.suspend(req.params.id);
    res.json(distributor);
  } catch (err) {
    next(err);
  }
}

export async function activateDistributor(
  req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const distributor = await platformService.activate(req.params.id);
    res.json(distributor);
  } catch (err) {
    next(err);
  }
}

export async function notifyPaymentDue(
  req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await platformService.notifyPaymentDue(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function markDistributorPaid(
  req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const distributor = await platformService.markPaid(req.params.id, req.body);
    res.json(distributor);
  } catch (err) {
    next(err);
  }
}

export async function listPlans(
  _req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const plans = await platformService.listPlans();
    res.json(plans);
  } catch (err) {
    next(err);
  }
}

export async function createPlan(
  req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const plan = await platformService.createPlan(req.body);
    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
}

export async function updatePlan(
  req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const plan = await platformService.updatePlan(req.params.id, req.body);
    res.json(plan);
  } catch (err) {
    next(err);
  }
}
