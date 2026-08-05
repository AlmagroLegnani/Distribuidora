import { Response, NextFunction } from 'express';
import * as platformService from '../services/platformService';
import * as contactRequestService from '../services/contactRequestService';
import type { PlatformAuthRequest } from '../middleware/platformAuth';

export async function login(req: PlatformAuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await platformService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getProfile(
  req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const admin = await platformService.getProfile(req.platformAdminId!);
    res.json(admin);
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(
  req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const admin = await platformService.updateProfile(req.platformAdminId!, req.body);
    res.json(admin);
  } catch (err) {
    next(err);
  }
}

export async function changePassword(
  req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await platformService.changeMyPassword(req.platformAdminId!, req.body.currentPassword, req.body.newPassword);
    res.json({ ok: true });
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

export async function changeDistributorPlan(
  req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const distributor = await platformService.changePlan(req.params.id, req.body.planId);
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

export async function impersonateDistributor(
  req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await platformService.impersonateDistributor(req.platformAdminId!, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function resendAccess(
  req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await platformService.resendAccess(req.params.id);
    res.json(result);
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

// ─── Solicitudes de contacto ─────────────────────────────────────────────────

export async function listContactRequests(
  _req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const requests = await contactRequestService.list();
    res.json(requests);
  } catch (err) {
    next(err);
  }
}

export async function updateContactRequestStatus(
  req: PlatformAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const request = await contactRequestService.updateStatus(req.params.id, req.body);
    res.json(request);
  } catch (err) {
    next(err);
  }
}
