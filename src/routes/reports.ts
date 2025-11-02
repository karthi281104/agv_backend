import express from 'express';
import PDFDocument from 'pdfkit';
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
// New Combined All-in-One PDF Report
// GET /api/reports/all-in-one.pdf?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&months=12
router.get('/all-in-one.pdf', asyncHandler(async (req: express.Request, res: express.Response) => {
  const startDate = req.query.startDate 
    ? new Date(req.query.startDate as string)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endDate = req.query.endDate
    ? new Date(req.query.endDate as string)
    : new Date();
  const months = req.query.months ? parseInt(req.query.months as string) : 12;

  // Fetch all sections in parallel
  const [portfolio, loanPerf, collections, customers, overdue, trends] = await Promise.all([
    ReportsService.getPortfolioReport(),
    ReportsService.getLoanPerformanceReport(startDate, endDate),
    ReportsService.getCollectionReport(startDate, endDate),
    ReportsService.getCustomerReport(),
    ReportsService.getOverdueReport(),
    ReportsService.getMonthlyTrends(months),
  ]);

  const filename = `all_in_one_report_${new Date().toISOString().split('T')[0]}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 40 });
  doc.pipe(res);

  const addSectionTitle = (title: string) => {
    doc.moveDown(0.5).fontSize(16).fillColor('#1f2937').text(title, { underline: true });
    doc.moveDown(0.25);
  };

  const currency = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  // Header
  doc.fontSize(20).fillColor('#111827').text('All-in-One Portfolio Report', { align: 'center' });
  doc.moveDown(0.2).fontSize(10).fillColor('#6b7280')
    .text(`Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} • Generated: ${new Date().toLocaleString('en-IN')}`, { align: 'center' });
  doc.moveDown(0.8);

  // Portfolio KPIs
  addSectionTitle('Portfolio Overview');
  doc.fontSize(11).fillColor('#111827');
  const kpis = [
    [`Total Loans`, String(portfolio.totalLoans)],
    [`Active Loans`, String(portfolio.activeLoans)],
    [`Completed Loans`, String(portfolio.completedLoans)],
    [`Overdue Loans`, String(portfolio.overdueLoans)],
    [`Defaulted Loans`, String(portfolio.defaultedLoans)],
    [`Total Disbursed`, currency(portfolio.totalDisbursed)],
    [`Total Outstanding`, currency(portfolio.totalOutstanding)],
    [`Total Collected`, currency(portfolio.totalCollected)],
    [`Avg Loan Size`, currency(portfolio.averageLoanSize)],
    [`Total Gold Value`, currency(portfolio.totalGoldValue)],
    [`Average LTV`, `${Math.round(portfolio.averageLTV)}%`],
  ];
  kpis.forEach(([k, v]) => doc.text(`${k}: ${v}`));

  // Loan Performance
  addSectionTitle('Loan Performance');
  doc.text(`Period: ${loanPerf.period}`);
  doc.text(`New Loans: ${loanPerf.newLoans}`);
  doc.text(`Disbursed Amount: ${currency(loanPerf.disbursedAmount)}`);
  doc.text(`Collections Amount: ${currency(loanPerf.collectionsAmount)}`);
  doc.text(`Closed Loans: ${loanPerf.closedLoans}`);
  doc.text(`Outstanding at End: ${currency(loanPerf.outstandingAtEnd)}`);

  // Collections
  addSectionTitle('Collections');
  doc.text(`Total Collections: ${currency(collections.totalCollections)}`);
  doc.text(`Principal Collected: ${currency(collections.principalCollected)}`);
  doc.text(`Interest Collected: ${currency(collections.interestCollected)}`);
  doc.text(`Penalty Collected: ${currency(collections.penaltyCollected)}`);
  doc.text(`Collection Efficiency: ${Math.round(collections.collectionEfficiency)}%`);
  doc.text(`Overdue Recovered: ${currency(collections.overdueRecovered)}`);

  // Customers
  addSectionTitle('Customers');
  doc.text(`Total Customers: ${customers.totalCustomers}`);
  doc.text(`Active Customers: ${customers.activeCustomers}`);
  doc.text(`Repeat Customers: ${customers.repeatCustomers}`);
  doc.text(`Avg Loans per Customer: ${customers.averageLoansPerCustomer.toFixed(2)}`);
  doc.moveDown(0.25).text('Top Customers:');
  customers.topCustomers.slice(0, 10).forEach((c, idx) => {
    doc.text(`${idx + 1}. ${c.name} — Loans: ${c.totalLoans}, Borrowed: ${currency(c.totalBorrowed)}`);
  });

  // Overdue
  addSectionTitle('Overdue');
  doc.text(`Total Overdue Loans: ${overdue.totalOverdueLoans}`);
  doc.text(`Total Overdue Amount: ${currency(overdue.totalOverdueAmount)}`);
  doc.text(`Total Penalties: ${currency(overdue.totalPenalties)}`);
  doc.text(`Recovery Rate: ${Math.round(overdue.recoveryRate)}%`);
  doc.moveDown(0.25).text('Buckets:');
  const buckets: Array<[string, {count:number; amount:number}]> = [
    ['0-30 days', overdue.bucket0to30],
    ['30-60 days', overdue.bucket30to60],
    ['60-90 days', overdue.bucket60to90],
    ['90+ days', overdue.bucket90Plus],
  ];
  buckets.forEach(([name, b]) => doc.text(`${name} — Count: ${b.count}, Amount: ${currency(b.amount)}`));

  // Monthly Trends
  addSectionTitle('Monthly Trends');
  trends.forEach((t) => {
    doc.text(`${t.month} ${t.year}: Created ${t.loansCreated}, Disbursed ${t.loansDisbursed}, Completed ${t.loansCompleted}, ` +
      `Total Disbursed ${currency(t.totalDisbursed)}, Total Collected ${currency(t.totalCollected)}, Net Outflow ${currency(t.netOutflow)}`);
  });

  doc.end();
}));
