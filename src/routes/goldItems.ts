import express from 'express';
import { body, param, query } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { handleValidationErrors, asyncHandler } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/gold-items - Get all gold items with filters
router.get('/', [
  query('loanId').optional().isString(),
  query('status').optional().isString()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { loanId, status } = req.query;

  const where: any = {};
  if (loanId) where.loanId = loanId as string;
  if (status) where.status = status;

  const goldItems = await prisma.goldItem.findMany({
    where,
    include: {
      loan: {
        select: {
          id: true,
          loanNumber: true,
          status: true,
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Gold items retrieved successfully',
    data: goldItems
  };

  res.json(response);
}));

// GET /api/gold-items/:id - Get single gold item
router.get('/:id', [
  param('id').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;

  const goldItem = await prisma.goldItem.findUnique({
    where: { id },
    include: {
      loan: {
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true
            }
          }
        }
      }
    }
  });

  if (!goldItem) {
    const response: ApiResponse = {
      success: false,
      message: 'Gold item not found'
    };
    res.status(404).json(response);
    return;
  }

  const response: ApiResponse = {
    success: true,
    message: 'Gold item retrieved successfully',
    data: goldItem
  };

  res.json(response);
}));

// GET /api/gold-items/loan/:loanId - Get all gold items for a loan
router.get('/loan/:loanId', [
  param('loanId').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { loanId } = req.params;

  const goldItems = await prisma.goldItem.findMany({
    where: { loanId },
    orderBy: { createdAt: 'asc' }
  });

  // Calculate summary
  const summary = {
    totalItems: goldItems.length,
    totalWeight: goldItems.reduce((sum, item) => sum + Number(item.weight), 0),
    totalValue: goldItems.reduce((sum, item) => sum + Number(item.totalValue), 0),
    pledgedItems: goldItems.filter(item => item.status === 'PLEDGED').length,
    releasedItems: goldItems.filter(item => item.status === 'RELEASED').length
  };

  const response: ApiResponse = {
    success: true,
    message: 'Loan gold items retrieved successfully',
    data: {
      summary,
      items: goldItems
    }
  };

  res.json(response);
}));

// POST /api/gold-items - Create a new gold item
router.post('/', [
  body('loanId').isString().notEmpty().withMessage('Loan ID is required'),
  body('itemType').isString().notEmpty().withMessage('Item type is required'),
  body('weight').isFloat({ min: 0.001 }).withMessage('Valid weight is required'),
  body('purity').isString().notEmpty().withMessage('Purity is required'),
  body('currentRate').isFloat({ min: 0 }).withMessage('Valid rate is required'),
  body('description').optional().isString(),
  body('images').optional().isArray()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { loanId, itemType, weight, purity, currentRate, description, images } = req.body;

  // Calculate total value
  const totalValue = parseFloat(weight) * parseFloat(currentRate);

  const goldItem = await prisma.goldItem.create({
    data: {
      loanId,
      itemType,
      weight: parseFloat(weight),
      purity,
      currentRate: parseFloat(currentRate),
      totalValue,
      description: description || null,
      images: images || [],
      status: 'PLEDGED'
    }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Gold item created successfully',
    data: goldItem
  };

  res.status(201).json(response);
}));

// PUT /api/gold-items/:id - Update gold item
router.put('/:id', [
  param('id').isString().notEmpty(),
  body('itemType').optional().isString(),
  body('weight').optional().isFloat({ min: 0.001 }),
  body('purity').optional().isString(),
  body('currentRate').optional().isFloat({ min: 0 }),
  body('description').optional().isString(),
  body('images').optional().isArray()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const { itemType, weight, purity, currentRate, description, images } = req.body;

  const goldItem = await prisma.goldItem.findUnique({ where: { id } });

  if (!goldItem) {
    const response: ApiResponse = {
      success: false,
      message: 'Gold item not found'
    };
    res.status(404).json(response);
    return;
  }

  // Recalculate total value if weight or rate changed
  const finalWeight = weight !== undefined ? parseFloat(weight) : Number(goldItem.weight);
  const finalRate = currentRate !== undefined ? parseFloat(currentRate) : Number(goldItem.currentRate);
  const totalValue = finalWeight * finalRate;

  const updatedGoldItem = await prisma.goldItem.update({
    where: { id },
    data: {
      itemType: itemType !== undefined ? itemType : undefined,
      weight: weight !== undefined ? parseFloat(weight) : undefined,
      purity: purity !== undefined ? purity : undefined,
      currentRate: currentRate !== undefined ? parseFloat(currentRate) : undefined,
      totalValue,
      description: description !== undefined ? description : undefined,
      images: images !== undefined ? images : undefined
    }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Gold item updated successfully',
    data: updatedGoldItem
  };

  res.json(response);
}));

// PUT /api/gold-items/:id/release - Release a gold item
router.put('/:id/release', [
  param('id').isString().notEmpty(),
  body('releasedToName').isString().notEmpty().withMessage('Released to name is required'),
  body('releasedToPhone').optional().isString(),
  body('releaseNotes').optional().isString()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const { releasedToName, releasedToPhone, releaseNotes } = req.body;
  const userId = (req as any).user.userId;

  const goldItem = await prisma.goldItem.findUnique({
    where: { id },
    include: {
      loan: true
    }
  });

  if (!goldItem) {
    const response: ApiResponse = {
      success: false,
      message: 'Gold item not found'
    };
    res.status(404).json(response);
    return;
  }

  if (goldItem.status === 'RELEASED') {
    const response: ApiResponse = {
      success: false,
      message: 'Gold item already released'
    };
    res.status(400).json(response);
    return;
  }

  // Check if loan is completed
  if (goldItem.loan.status !== 'COMPLETED') {
    const response: ApiResponse = {
      success: false,
      message: 'Cannot release gold item. Loan must be completed first.'
    };
    res.status(400).json(response);
    return;
  }

  const updatedGoldItem = await prisma.goldItem.update({
    where: { id },
    data: {
      status: 'RELEASED',
      releasedAt: new Date(),
      releasedById: userId,
      releasedToName,
      releasedToPhone: releasedToPhone || null,
      releaseNotes: releaseNotes || null
    }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Gold item released successfully',
    data: updatedGoldItem
  };

  res.json(response);
}));

// PUT /api/gold-items/loan/:loanId/release-all - Release all gold items for a completed loan
router.put('/loan/:loanId/release-all', [
  param('loanId').isString().notEmpty(),
  body('releasedToName').isString().notEmpty().withMessage('Released to name is required'),
  body('releasedToPhone').optional().isString(),
  body('releaseNotes').optional().isString()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { loanId } = req.params;
  const { releasedToName, releasedToPhone, releaseNotes } = req.body;
  const userId = (req as any).user.userId;

  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: {
      goldItems: true
    }
  });

  if (!loan) {
    const response: ApiResponse = {
      success: false,
      message: 'Loan not found'
    };
    res.status(404).json(response);
    return;
  }

  if (loan.status !== 'COMPLETED') {
    const response: ApiResponse = {
      success: false,
      message: 'Cannot release gold items. Loan must be completed first.'
    };
    res.status(400).json(response);
    return;
  }

  // Release all pledged items
  const result = await prisma.goldItem.updateMany({
    where: {
      loanId,
      status: 'PLEDGED'
    },
    data: {
      status: 'RELEASED',
      releasedAt: new Date(),
      releasedById: userId,
      releasedToName,
      releasedToPhone: releasedToPhone || null,
      releaseNotes: releaseNotes || null
    }
  });

  const response: ApiResponse = {
    success: true,
    message: `${result.count} gold items released successfully`,
    data: {
      releasedCount: result.count,
      totalItems: loan.goldItems.length
    }
  };

  res.json(response);
}));

// DELETE /api/gold-items/:id - Delete a gold item
router.delete('/:id', [
  param('id').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;

  const goldItem = await prisma.goldItem.findUnique({
    where: { id },
    include: { loan: true }
  });

  if (!goldItem) {
    const response: ApiResponse = {
      success: false,
      message: 'Gold item not found'
    };
    res.status(404).json(response);
    return;
  }

  // Prevent deletion if loan is not in PENDING status
  if (goldItem.loan.status !== 'PENDING') {
    const response: ApiResponse = {
      success: false,
      message: 'Cannot delete gold item. Loan is already processed.'
    };
    res.status(400).json(response);
    return;
  }

  await prisma.goldItem.delete({
    where: { id }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Gold item deleted successfully'
  };

  res.json(response);
}));

// GET /api/gold-items/stats/summary - Get gold items statistics
router.get('/stats/summary', asyncHandler(async (req: express.Request, res: express.Response) => {
  const [totalItems, pledgedItems, releasedItems, totalWeight, totalValue] = await Promise.all([
    prisma.goldItem.count(),
    prisma.goldItem.count({ where: { status: 'PLEDGED' } }),
    prisma.goldItem.count({ where: { status: 'RELEASED' } }),
    prisma.goldItem.aggregate({
      _sum: { weight: true }
    }),
    prisma.goldItem.aggregate({
      _sum: { totalValue: true }
    })
  ]);

  const response: ApiResponse = {
    success: true,
    message: 'Gold items statistics retrieved successfully',
    data: {
      totalItems,
      pledgedItems,
      releasedItems,
      totalWeight: totalWeight._sum.weight || 0,
      totalValue: totalValue._sum.totalValue || 0
    }
  };

  res.json(response);
}));

export default router;
