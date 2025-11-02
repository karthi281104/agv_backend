import express from 'express';
import { body } from 'express-validator';
import bcryptjs from 'bcryptjs';
import prisma from '../utils/prisma';
import { authenticateToken } from '../middleware/auth';
import { handleValidationErrors, asyncHandler } from '../middleware/validation';
import { ApiResponse } from '../types';

const router = express.Router();

// All routes here require auth
router.use(authenticateToken);

// Helper to load JSON setting by key
async function getJsonSetting(key: string, defaultValue: any = {}) {
  const setting = await prisma.settings.findUnique({ where: { key } });
  if (!setting) return defaultValue;
  try {
    return JSON.parse(setting.value);
  } catch {
    return defaultValue;
  }
}

async function setJsonSetting(key: string, value: any, category = 'user', description?: string) {
  const val = JSON.stringify(value);
  await prisma.settings.upsert({
    where: { key },
    update: { value: val, category, description },
    create: { key, value: val, category, description },
  });
}

// GET /api/users/me
router.get('/me', asyncHandler(async (req: express.Request, res: express.Response) => {
  const userId = req.user!.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    const response: ApiResponse = { success: false, message: 'User not found' };
    res.status(404).json(response);
    return;
  }

  const profileKey = `user:${userId}:profile`;
  const profile = await getJsonSetting(profileKey, {});

  const response: ApiResponse = {
    success: true,
    message: 'User profile fetched',
    data: { user, profile },
  };
  res.json(response);
}));

// PUT /api/users/me
router.put('/me', [
  body('firstName').optional().isString().trim().isLength({ min: 1 }).withMessage('First name required'),
  body('lastName').optional().isString().trim().isLength({ min: 1 }).withMessage('Last name required'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('profile').optional().isObject().withMessage('Profile must be an object'),
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const userId = req.user!.id;
  const { firstName, lastName, email, profile } = req.body as { firstName?: string; lastName?: string; email?: string; profile?: Record<string, any>; };

  // Update core user fields if provided
  if (firstName || lastName || email) {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: {
          firstName: firstName ?? undefined,
          lastName: lastName ?? undefined,
          email: email ?? undefined,
        },
      });
    } catch (e: any) {
      const response: ApiResponse = { success: false, message: e?.message || 'Failed to update user' };
      res.status(400).json(response);
      return;
    }
  }

  // Merge and save profile JSON
  if (profile && typeof profile === 'object') {
    const profileKey = `user:${userId}:profile`;
    const current = await getJsonSetting(profileKey, {});
    await setJsonSetting(profileKey, { ...current, ...profile }, 'user', 'User profile extras');
  }

  const updated = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });
  const profileKey = `user:${userId}:profile`;
  const newProfile = await getJsonSetting(profileKey, {});

  const response: ApiResponse = { success: true, message: 'Profile updated', data: { user: updated, profile: newProfile } };
  res.json(response);
}));

// PUT /api/users/me/password
router.put('/me/password', [
  body('currentPassword').isString().isLength({ min: 6 }),
  body('newPassword').isString().isLength({ min: 8 }),
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const userId = req.user!.id;
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
  if (!user) {
    const response: ApiResponse = { success: false, message: 'User not found' };
    res.status(404).json(response);
    return;
  }

  const valid = await bcryptjs.compare(currentPassword, user.password);
  if (!valid) {
    const response: ApiResponse = { success: false, message: 'Current password is incorrect' };
    res.status(400).json(response);
    return;
  }

  const hashed = await bcryptjs.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS || '12'));
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });

  const response: ApiResponse = { success: true, message: 'Password updated successfully' };
  res.json(response);
}));

export default router;
