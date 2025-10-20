import express from 'express';
import { query } from 'express-validator';
import { handleValidationErrors, asyncHandler } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import ReportsService from '../services/reportsService';
import { ApiResponse } from '../types';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/reports/portfolio - Get portfolio overview
router.get('/portfolio', asyncHandler(async (req: express.Request, res: express.Response) => {
  const report = await ReportsService.getPortfolioReport();

  const response: ApiResponse = {
    success: true,
    message: 'Portfolio report generated successfully',
    data: report,
  };

  res.json(response);
}));

// GET /api/reports/loan-performance - Get loan performance report
router.get('/loan-performance', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate as string)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  
  const endDate = req.query.endDate
    ? new Date(req.query.endDate as string)
    : new Date();

  const report = await ReportsService.getLoanPerformanceReport(startDate, endDate);

  const response: ApiResponse = {
    success: true,
    message: 'Loan performance report generated successfully',
    data: report,
  };

  res.json(response);
}));

// GET /api/reports/collection - Get collection report
router.get('/collection', [
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate as string)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  
  const endDate = req.query.endDate
    ? new Date(req.query.endDate as string)
    : new Date();

  const report = await ReportsService.getCollectionReport(startDate, endDate);

  const response: ApiResponse = {
    success: true,
    message: 'Collection report generated successfully',
    data: report,
  };

  res.json(response);
}));

// GET /api/reports/customer - Get customer report
router.get('/customer', asyncHandler(async (req: express.Request, res: express.Response) => {
  const report = await ReportsService.getCustomerReport();

  const response: ApiResponse = {
    success: true,
    message: 'Customer report generated successfully',
    data: report,
  };

  res.json(response);
}));

// GET /api/reports/overdue - Get overdue report
router.get('/overdue', asyncHandler(async (req: express.Request, res: express.Response) => {
  const report = await ReportsService.getOverdueReport();

  const response: ApiResponse = {
    success: true,
    message: 'Overdue report generated successfully',
    data: report,
  };

  res.json(response);
}));

// GET /api/reports/monthly-trends - Get monthly trends
router.get('/monthly-trends', [
  query('months').optional().isInt({ min: 1, max: 24 })
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const months = req.query.months ? parseInt(req.query.months as string) : 12;

  const trends = await ReportsService.getMonthlyTrends(months);

  const response: ApiResponse = {
    success: true,
    message: 'Monthly trends generated successfully',
    data: trends,
  };

  res.json(response);
}));

export default router;
