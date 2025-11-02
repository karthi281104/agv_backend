import express from 'express';
import { body } from 'express-validator';
import prisma from '../utils/prisma';
import { authenticateToken } from '../middleware/auth';
import { handleValidationErrors, asyncHandler } from '../middleware/validation';
import { ApiResponse } from '../types';

const router = express.Router();

router.use(authenticateToken);

async function getSetting(key: string, fallback?: string) {
  const s = await prisma.settings.findUnique({ where: { key } });
  return s?.value ?? fallback;
}

async function setSetting(key: string, value: string, category = 'system', description?: string) {
  await prisma.settings.upsert({
    where: { key },
    update: { value, category, description },
    create: { key, value, category, description },
  });
}

async function getJson(key: string, defaultValue: any = {}) {
  const s = await prisma.settings.findUnique({ where: { key } });
  if (!s) return defaultValue;
  try { return JSON.parse(s.value); } catch { return defaultValue; }
}

async function setJson(key: string, value: any, category = 'user', description?: string) {
  await setSetting(key, JSON.stringify(value), category, description);
}

// GET /api/settings/system
router.get('/system', asyncHandler(async (req: express.Request, res: express.Response) => {
  const defaults = {
    language: 'en',
    currency: 'inr',
    dateFormat: 'dd/mm/yyyy',
    numberFormat: 'indian',
    interestRate: '12',
    maxLoanAmount: '1000000',
    minLoanAmount: '5000',
    goldRateSource: 'live',
  };

  const keys = Object.keys(defaults) as Array<keyof typeof defaults>;
  const entries = await Promise.all(keys.map(async (k) => [k, await getSetting(`system:${k}`, defaults[k])] as const));
  const data = Object.fromEntries(entries);

  const response: ApiResponse = { success: true, message: 'System settings', data };
  res.json(response);
}));

// PUT /api/settings/system
router.put('/system', [
  body('language').optional().isString(),
  body('currency').optional().isString(),
  body('dateFormat').optional().isString(),
  body('numberFormat').optional().isString(),
  body('interestRate').optional().isString(),
  body('maxLoanAmount').optional().isString(),
  body('minLoanAmount').optional().isString(),
  body('goldRateSource').optional().isString(),
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const allowed = ['language','currency','dateFormat','numberFormat','interestRate','maxLoanAmount','minLoanAmount','goldRateSource'];
  const updates: Record<string, string> = {};
  for (const k of allowed) {
    if (k in req.body) {
      updates[k] = String((req.body as any)[k]);
      await setSetting(`system:${k}`, updates[k], 'system', 'System configuration');
    }
  }
  const response: ApiResponse = { success: true, message: 'System settings updated', data: updates };
  res.json(response);
}));

// GET /api/settings/preferences (user-specific)
router.get('/preferences', asyncHandler(async (req: express.Request, res: express.Response) => {
  const key = `user:${req.user!.id}:preferences`;
  const prefs = await getJson(key, {
    emailNotifications: true,
    smsNotifications: true,
    overdueAlerts: true,
    darkMode: false,
    timezone: 'ist',
    dateFormat: 'dd/mm/yyyy',
    currency: 'inr',
    language: 'en',
  });
  const response: ApiResponse = { success: true, message: 'Preferences', data: prefs };
  res.json(response);
}));

// PUT /api/settings/preferences
router.put('/preferences', [
  body('emailNotifications').optional().isBoolean(),
  body('smsNotifications').optional().isBoolean(),
  body('overdueAlerts').optional().isBoolean(),
  body('darkMode').optional().isBoolean(),
  body('timezone').optional().isString(),
  body('dateFormat').optional().isString(),
  body('currency').optional().isString(),
  body('language').optional().isString(),
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const key = `user:${req.user!.id}:preferences`;
  const current = await getJson(key, {});
  const updated = { ...current, ...req.body };
  await setJson(key, updated, 'user', 'User notification and display preferences');
  const response: ApiResponse = { success: true, message: 'Preferences updated', data: updated };
  res.json(response);
}));

export default router;
