import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { ApiResponse } from '../types';
import { asyncHandler } from '../middleware/validation';

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/dashboard/stats
router.get('/stats', asyncHandler(async (req: express.Request, res: express.Response) => {
  // Get date ranges for calculations
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));

  // Run all queries in parallel
  const [
    totalCustomers,
    activeCustomers,
    totalLoans,
    activeLoans,
    pendingLoans,
    completedLoans,
    totalDisbursed,
    totalCollected,
    monthlyDisbursed,
    monthlyCollected,
    recentPayments,
    overduePayments,
    pendingLoanAmount,
    activeLoanAmount,
    totalOutstanding
  ] = await Promise.all([
    // Customer stats
    prisma.customer.count({ where: { isActive: true } }),
    prisma.customer.count({ 
      where: { 
        isActive: true,
        createdAt: { gte: thirtyDaysAgo }
      } 
    }),
    
    // Loan stats
    prisma.loan.count(),
    prisma.loan.count({ where: { status: 'ACTIVE' } }),
    prisma.loan.count({ where: { status: 'PENDING' } }),
    prisma.loan.count({ where: { status: 'COMPLETED' } }),
    
    // Financial stats - Disbursed amount (ACTIVE + COMPLETED only)
    prisma.loan.aggregate({
      where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
      _sum: { principalAmount: true }
    }),
    prisma.payment.aggregate({
      where: { 
        status: 'COMPLETED',
        paymentType: { in: ['EMI_PAYMENT', 'PARTIAL_PAYMENT', 'LOAN_CLOSURE'] }
      },
      _sum: { amount: true }
    }),
    
    // Monthly stats
    prisma.loan.aggregate({
      where: { 
        status: { in: ['ACTIVE', 'COMPLETED'] },
        disbursementDate: { gte: startOfMonth }
      },
      _sum: { principalAmount: true }
    }),
    prisma.payment.aggregate({
      where: { 
        status: 'COMPLETED',
        paymentType: { in: ['EMI_PAYMENT', 'PARTIAL_PAYMENT', 'LOAN_CLOSURE'] },
        paymentDate: { gte: startOfMonth }
      },
      _sum: { amount: true }
    }),
    
    // Recent payments
    prisma.payment.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        loan: {
          select: {
            loanNumber: true,
            customer: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    }),
    
    // Overdue payments count
    prisma.loan.count({
      where: {
        status: 'ACTIVE',
        maturityDate: { lt: today }
      }
    }),
    
    // Pending loan amount (awaiting approval/disbursement)
    prisma.loan.aggregate({
      where: { status: 'PENDING' },
      _sum: { principalAmount: true }
    }),
    
    // Active loan amount (currently disbursed)
    prisma.loan.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { principalAmount: true }
    }),
    
    // Total outstanding (Active loans - Payments)
    prisma.loan.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { principalAmount: true }
    })
  ]);

  const stats = {
    customers: {
      total: totalCustomers,
      active: activeCustomers,
      newThisMonth: activeCustomers
    },
    loans: {
      total: totalLoans,
      active: activeLoans,
      pending: pendingLoans,
      completed: completedLoans,
      overdue: overduePayments
    },
    financial: {
      // Total disbursed (ACTIVE + COMPLETED loans only - money actually given out)
      totalDisbursed: Number(totalDisbursed._sum.principalAmount || 0),
      
      // Total collected (all payments received)
      totalCollected: Number(totalCollected._sum.amount || 0),
      
      // Monthly disbursed (this month's disbursements)
      monthlyDisbursed: Number(monthlyDisbursed._sum.principalAmount || 0),
      
      // Monthly collected (this month's collections)
      monthlyCollected: Number(monthlyCollected._sum.amount || 0),
      
      // Outstanding amount (Active loans - Payments received)
      outstandingAmount: Number(activeLoanAmount._sum.principalAmount || 0) - Number(totalCollected._sum.amount || 0),
      
      // Pending approval amount (PENDING loans awaiting disbursement)
      pendingApprovalAmount: Number(pendingLoanAmount._sum.principalAmount || 0),
      
      // Active loan amount (currently disbursed and active)
      activeLoanAmount: Number(activeLoanAmount._sum.principalAmount || 0),
      
      // Total interest earned (would need calculation from loan terms)
      totalInterestEarned: 0, // Placeholder - needs proper calculation
      
      // Overdue amount (would need payment schedule calculation)
      overdueAmount: 0 // Placeholder - needs proper calculation
    },
    recentActivity: {
      recentPayments: recentPayments.map((payment: any) => ({
        id: payment.id,
        amount: Number(payment.amount),
        paymentType: payment.paymentType,
        paymentDate: payment.paymentDate,
        customer: `${payment.loan.customer.firstName} ${payment.loan.customer.lastName}`,
        loanNumber: payment.loan.loanNumber
      }))
    }
  };

  const response: ApiResponse = {
    success: true,
    message: 'Dashboard stats retrieved successfully',
    data: stats
  };

  res.json(response);
}));

// GET /api/dashboard/charts
router.get('/charts', asyncHandler(async (req: express.Request, res: express.Response) => {
  const today = new Date();
  const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1);
  
  // Monthly loan disbursement chart data
  const monthlyLoans = await prisma.$queryRaw`
    SELECT 
      DATE_TRUNC('month', "disbursementDate") as month,
      COUNT(*)::int as count,
      SUM("principalAmount")::float as amount
    FROM loans 
    WHERE "disbursementDate" >= ${sixMonthsAgo}
    AND "disbursementDate" IS NOT NULL
    GROUP BY DATE_TRUNC('month', "disbursementDate")
    ORDER BY month ASC
  ` as Array<{month: Date, count: number, amount: number}>;

  // Monthly payments chart data
  const monthlyPayments = await prisma.$queryRaw`
    SELECT 
      DATE_TRUNC('month', "paymentDate") as month,
      COUNT(*)::int as count,
      SUM("amount")::float as amount
    FROM payments 
    WHERE "paymentDate" >= ${sixMonthsAgo}
    AND "status" = 'COMPLETED'
    AND "paymentType" IN ('EMI_PAYMENT', 'PARTIAL_PAYMENT', 'LOAN_CLOSURE')
    GROUP BY DATE_TRUNC('month', "paymentDate")
    ORDER BY month ASC
  ` as Array<{month: Date, count: number, amount: number}>;

  // Loan status distribution
  const loanStatusData = await prisma.loan.groupBy({
    by: ['status'],
    _count: { status: true },
    _sum: { principalAmount: true }
  });

  // Gold item types distribution
  const goldItemTypes = await prisma.goldItem.groupBy({
    by: ['itemType'],
    _count: { itemType: true },
    _sum: { totalValue: true }
  });

  const chartData = {
    monthlyLoans: monthlyLoans.map(item => ({
      month: item.month.toISOString().substring(0, 7), // YYYY-MM format
      count: item.count,
      amount: item.amount
    })),
    monthlyPayments: monthlyPayments.map(item => ({
      month: item.month.toISOString().substring(0, 7),
      count: item.count,
      amount: item.amount
    })),
    loanStatus: loanStatusData.map((item: any) => ({
      status: item.status,
      count: item._count.status,
      amount: Number(item._sum.principalAmount || 0)
    })),
    goldItemTypes: goldItemTypes.map((item: any) => ({
      type: item.itemType,
      count: item._count.itemType,
      value: Number(item._sum.totalValue || 0)
    }))
  };

  const response: ApiResponse = {
    success: true,
    message: 'Dashboard chart data retrieved successfully',
    data: chartData
  };

  res.json(response);
}));

export default router;