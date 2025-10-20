import express from 'express';
import { body, param } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { handleValidationErrors, asyncHandler } from '../middleware/validation';
import { authenticateToken, requireManagerOrAdmin } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/gold-rates
router.get('/', asyncHandler(async (req: express.Request, res: express.Response) => {
  const goldRates = await prisma.goldRate.findMany({
    where: { isActive: true },
    orderBy: { date: 'desc' }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Gold rates retrieved successfully',
    data: goldRates
  };

  res.json(response);
}));

// GET /api/gold-rates/current
router.get('/current', asyncHandler(async (req: express.Request, res: express.Response) => {
  const currentRates = await prisma.goldRate.findMany({
    where: { 
      isActive: true,
      date: {
        gte: new Date(new Date().setHours(0, 0, 0, 0))
      }
    },
    orderBy: { date: 'desc' },
    take: 10
  });

  const response: ApiResponse = {
    success: true,
    message: 'Current gold rates retrieved successfully',
    data: currentRates
  };

  res.json(response);
}));

// POST /api/gold-rates
router.post('/', requireManagerOrAdmin, [
  body('purity').notEmpty().withMessage('Purity is required'),
  body('rate').isFloat({ min: 1 }).withMessage('Rate must be greater than 0')
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { purity, rate } = req.body;

  // Deactivate existing rates for this purity
  await prisma.goldRate.updateMany({
    where: { purity, isActive: true },
    data: { isActive: false }
  });

  // Create new rate
  const goldRate = await prisma.goldRate.create({
    data: {
      purity,
      rate
    }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Gold rate updated successfully',
    data: goldRate
  };

  res.status(201).json(response);
}));

// PUT /api/gold-rates/:id
router.put('/:id', requireManagerOrAdmin, [
  param('id').isString().notEmpty(),
  body('rate').isFloat({ min: 1 }).withMessage('Rate must be greater than 0')
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const { rate } = req.body;

  const goldRate = await prisma.goldRate.update({
    where: { id },
    data: { rate }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Gold rate updated successfully',
    data: goldRate
  };

  res.json(response);
}));

// DELETE /api/gold-rates/:id
router.delete('/:id', requireManagerOrAdmin, [
  param('id').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;

  await prisma.goldRate.update({
    where: { id },
    data: { isActive: false }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Gold rate deactivated successfully'
  };

  res.json(response);
}));

export default router;