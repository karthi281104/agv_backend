import express from 'express';
import { query, param } from 'express-validator';
import { handleValidationErrors, asyncHandler } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import OverdueService from '../services/overdueService';
import { ApiResponse } from '../types';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/overdue/loans - Get all overdue loans
router.get('/loans', [
  query('minDaysOverdue').optional().isInt({ min: 0 }),
  query('maxDaysOverdue').optional().isInt({ min: 0 }),
  query('minAmount').optional().isFloat({ min: 0 })
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const filters = {
    minDaysOverdue: req.query.minDaysOverdue ? parseInt(req.query.minDaysOverdue as string) : undefined,
    maxDaysOverdue: req.query.maxDaysOverdue ? parseInt(req.query.maxDaysOverdue as string) : undefined,
    minAmount: req.query.minAmount ? parseFloat(req.query.minAmount as string) : undefined,
  };

  const loans = await OverdueService.getOverdueLoans(filters);

  const response: ApiResponse = {
    success: true,
    message: 'Overdue loans retrieved successfully',
    data: loans,
  };

  res.json(response);
}));

// GET /api/overdue/statistics - Get overdue statistics
router.get('/statistics', asyncHandler(async (req: express.Request, res: express.Response) => {
  const stats = await OverdueService.getOverdueStatistics();

  const response: ApiResponse = {
    success: true,
    message: 'Overdue statistics retrieved successfully',
    data: stats,
  };

  res.json(response);
}));

// POST /api/overdue/update-all - Update overdue status for all active loans
router.post('/update-all', asyncHandler(async (req: express.Request, res: express.Response) => {
  const result = await OverdueService.updateAllOverdueLoans();

  const response: ApiResponse = {
    success: true,
    message: 'Overdue status updated for all active loans',
    data: result,
  };

  res.json(response);
}));

// POST /api/overdue/update/:loanId - Update overdue status for specific loan
router.post('/update/:loanId', [
  param('loanId').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { loanId } = req.params;

  const loan = await OverdueService.updateLoanOverdueStatus(loanId);

  const response: ApiResponse = {
    success: true,
    message: 'Loan overdue status updated successfully',
    data: loan,
  };

  res.json(response);
}));

// POST /api/overdue/check-default/:loanId - Check if loan should be marked as defaulted
router.post('/check-default/:loanId', [
  param('loanId').isString().notEmpty(),
  query('thresholdDays').optional().isInt({ min: 1 })
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { loanId } = req.params;
  const thresholdDays = req.query.thresholdDays 
    ? parseInt(req.query.thresholdDays as string) 
    : 90;

  const wasMarkedDefaulted = await OverdueService.checkAndMarkDefaulted(loanId, thresholdDays);

  const response: ApiResponse = {
    success: true,
    message: wasMarkedDefaulted 
      ? 'Loan marked as DEFAULTED due to extended overdue period'
      : 'Loan does not meet criteria for default status',
    data: { wasMarkedDefaulted, thresholdDays },
  };

  res.json(response);
}));

export default router;
