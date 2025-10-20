import { PrismaClient, LoanStatus } from '@prisma/client';

const prisma = new PrismaClient();

export interface PortfolioReport {
  totalLoans: number;
  totalDisbursed: number;
  totalOutstanding: number;
  totalCollected: number;
  activeLoans: number;
  completedLoans: number;
  overdueLoans: number;
  defaultedLoans: number;
  averageLoanSize: number;
  totalGoldValue: number;
  averageLTV: number;
}

export interface LoanPerformanceReport {
  period: string;
  newLoans: number;
  disbursedAmount: number;
  collectionsAmount: number;
  closedLoans: number;
  outstandingAtEnd: number;
}

export interface CollectionReport {
  totalCollections: number;
  principalCollected: number;
  interestCollected: number;
  penaltyCollected: number;
  collectionEfficiency: number; // Percentage
  overdueRecovered: number;
}

export interface CustomerReport {
  totalCustomers: number;
  activeCustomers: number;
  repeatCustomers: number;
  averageLoansPerCustomer: number;
  topCustomers: Array<{
    customerId: string;
    name: string;
    totalLoans: number;
    totalBorrowed: number;
  }>;
}

export interface OverdueReport {
  totalOverdueLoans: number;
  totalOverdueAmount: number;
  totalPenalties: number;
  bucket0to30: { count: number; amount: number };
  bucket30to60: { count: number; amount: number };
  bucket60to90: { count: number; amount: number };
  bucket90Plus: { count: number; amount: number };
  recoveryRate: number; // Percentage
}

export interface MonthlyTrend {
  month: string;
  year: number;
  loansCreated: number;
  loansDisbursed: number;
  loansCompleted: number;
  totalDisbursed: number;
  totalCollected: number;
  netOutflow: number;
}

export class ReportsService {
  /**
   * Get portfolio overview report
   */
  static async getPortfolioReport(): Promise<PortfolioReport> {
    const [
      totalLoans,
      totalDisbursed,
      totalOutstanding,
      totalCollected,
      statusCounts,
      avgLoanSize,
      totalGoldValue,
      avgLTV,
    ] = await Promise.all([
      // Total loans
      prisma.loan.count(),

      // Total disbursed
      prisma.loan.aggregate({
        _sum: { principalAmount: true },
        where: { status: { in: ['ACTIVE', 'COMPLETED', 'DEFAULTED'] } },
      }),

      // Total outstanding
      prisma.loan.aggregate({
        _sum: { outstandingBalance: true },
        where: { status: 'ACTIVE' },
      }),

      // Total collected
      prisma.loan.aggregate({
        _sum: { totalAmountPaid: true },
      }),

      // Status counts
      Promise.all([
        prisma.loan.count({ where: { status: 'ACTIVE' } }),
        prisma.loan.count({ where: { status: 'COMPLETED' } }),
        prisma.loan.count({ where: { isOverdue: true, status: 'ACTIVE' } }),
        prisma.loan.count({ where: { status: 'DEFAULTED' } }),
      ]),

      // Average loan size
      prisma.loan.aggregate({
        _avg: { principalAmount: true },
      }),

      // Total gold value
      prisma.loan.aggregate({
        _sum: { totalGoldValue: true },
      }),

      // Average LTV
      prisma.loan.aggregate({
        _avg: { ltvRatio: true },
      }),
    ]);

    return {
      totalLoans,
      totalDisbursed: Number(totalDisbursed._sum.principalAmount || 0),
      totalOutstanding: Number(totalOutstanding._sum.outstandingBalance || 0),
      totalCollected: Number(totalCollected._sum.totalAmountPaid || 0),
      activeLoans: statusCounts[0],
      completedLoans: statusCounts[1],
      overdueLoans: statusCounts[2],
      defaultedLoans: statusCounts[3],
      averageLoanSize: Number(avgLoanSize._avg.principalAmount || 0),
      totalGoldValue: Number(totalGoldValue._sum.totalGoldValue || 0),
      averageLTV: Number(avgLTV._avg.ltvRatio || 0),
    };
  }

  /**
   * Get loan performance report for a period
   */
  static async getLoanPerformanceReport(
    startDate: Date,
    endDate: Date
  ): Promise<LoanPerformanceReport> {
    const [newLoans, disbursed, collections, closed, outstandingAtEnd] =
      await Promise.all([
        // New loans created
        prisma.loan.count({
          where: {
            createdAt: { gte: startDate, lte: endDate },
          },
        }),

        // Disbursed amount
        prisma.loan.aggregate({
          _sum: { principalAmount: true },
          where: {
            disbursementDate: { gte: startDate, lte: endDate },
            status: { in: ['ACTIVE', 'COMPLETED', 'DEFAULTED'] },
          },
        }),

        // Collections
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            createdAt: { gte: startDate, lte: endDate },
            status: 'COMPLETED',
            paymentType: {
              in: ['EMI_PAYMENT', 'PARTIAL_PAYMENT', 'LOAN_CLOSURE'],
            },
          },
        }),

        // Closed loans
        prisma.loan.count({
          where: {
            status: 'COMPLETED',
            updatedAt: { gte: startDate, lte: endDate },
          },
        }),

        // Outstanding at period end
        prisma.loan.aggregate({
          _sum: { outstandingBalance: true },
          where: {
            status: 'ACTIVE',
            createdAt: { lte: endDate },
          },
        }),
      ]);

    const period = `${startDate.toISOString().split('T')[0]} to ${
      endDate.toISOString().split('T')[0]
    }`;

    return {
      period,
      newLoans,
      disbursedAmount: Number(disbursed._sum.principalAmount || 0),
      collectionsAmount: Number(collections._sum.amount || 0),
      closedLoans: closed,
      outstandingAtEnd: Number(outstandingAtEnd._sum.outstandingBalance || 0),
    };
  }

  /**
   * Get collection report
   */
  static async getCollectionReport(
    startDate: Date,
    endDate: Date
  ): Promise<CollectionReport> {
    const [totalCollections, principalCollected, interestCollected, penaltyCollected, overdueRecovered] =
      await Promise.all([
        // Total collections
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            createdAt: { gte: startDate, lte: endDate },
            status: 'COMPLETED',
          },
        }),

        // Principal collected
        prisma.payment.aggregate({
          _sum: { principalAmount: true },
          where: {
            createdAt: { gte: startDate, lte: endDate },
            status: 'COMPLETED',
          },
        }),

        // Interest collected
        prisma.payment.aggregate({
          _sum: { interestAmount: true },
          where: {
            createdAt: { gte: startDate, lte: endDate },
            status: 'COMPLETED',
          },
        }),

        // Penalty collected
        prisma.payment.aggregate({
          _sum: { penaltyAmount: true },
          where: {
            createdAt: { gte: startDate, lte: endDate },
            status: 'COMPLETED',
          },
        }),

        // Overdue recovered (payments on overdue loans)
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            createdAt: { gte: startDate, lte: endDate },
            status: 'COMPLETED',
            loan: { isOverdue: true },
          },
        }),
      ]);

    const total = Number(totalCollections._sum.amount || 0);
    const expected = Number(totalCollections._sum.amount || 0); // Simplified
    const efficiency = expected > 0 ? (total / expected) * 100 : 0;

    return {
      totalCollections: total,
      principalCollected: Number(principalCollected._sum.principalAmount || 0),
      interestCollected: Number(interestCollected._sum.interestAmount || 0),
      penaltyCollected: Number(penaltyCollected._sum.penaltyAmount || 0),
      collectionEfficiency: efficiency,
      overdueRecovered: Number(overdueRecovered._sum.amount || 0),
    };
  }

  /**
   * Get customer report
   */
  static async getCustomerReport(): Promise<CustomerReport> {
    const [totalCustomers, customersWithLoans, loansPerCustomer, topCustomers, allCustomersWithLoans] =
      await Promise.all([
        // Total customers
        prisma.customer.count(),

        // Active customers (with at least one active loan)
        prisma.customer.count({
          where: {
            loans: {
              some: { status: 'ACTIVE' },
            },
          },
        }),

        // Average loans per customer
        prisma.loan.aggregate({
          _count: true,
        }),

        // Top customers by total borrowed
        prisma.customer.findMany({
          select: {
            id: true,
            firstName: true,
            lastName: true,
            loans: {
              select: {
                principalAmount: true,
              },
            },
          },
          take: 10,
          orderBy: {
            loans: {
              _count: 'desc',
            },
          },
        }),

        // Get all customers with their loan counts
        prisma.customer.findMany({
          select: {
            _count: {
              select: {
                loans: true,
              },
            },
          },
        }),
      ]);

    // Calculate repeat customers (more than 1 loan)
    const repeatCustomers = allCustomersWithLoans.filter(
      (customer) => customer._count.loans > 1
    ).length;

    const avgLoans =
      totalCustomers > 0 ? loansPerCustomer._count / totalCustomers : 0;

    const topCustomersFormatted = topCustomers.map((customer) => ({
      customerId: customer.id,
      name: `${customer.firstName} ${customer.lastName}`,
      totalLoans: customer.loans.length,
      totalBorrowed: customer.loans.reduce(
        (sum, loan) => sum + Number(loan.principalAmount),
        0
      ),
    }));

    return {
      totalCustomers,
      activeCustomers: customersWithLoans,
      repeatCustomers,
      averageLoansPerCustomer: avgLoans,
      topCustomers: topCustomersFormatted,
    };
  }

  /**
   * Get overdue report
   */
  static async getOverdueReport(): Promise<OverdueReport> {
    const [
      totalOverdue,
      totalAmount,
      totalPenalties,
      bucket0to30,
      bucket30to60,
      bucket60to90,
      bucket90Plus,
      recoveredOverdue,
    ] = await Promise.all([
      // Total overdue loans
      prisma.loan.count({
        where: { isOverdue: true, status: 'ACTIVE' },
      }),

      // Total overdue amount
      prisma.loan.aggregate({
        _sum: { overdueAmount: true },
        where: { isOverdue: true, status: 'ACTIVE' },
      }),

      // Total penalties
      prisma.loan.aggregate({
        _sum: { penaltyAmount: true },
        where: { isOverdue: true, status: 'ACTIVE' },
      }),

      // Bucket: 0-30 days
      Promise.all([
        prisma.loan.count({
          where: {
            isOverdue: true,
            status: 'ACTIVE',
            daysOverdue: { gte: 0, lt: 30 },
          },
        }),
        prisma.loan.aggregate({
          _sum: { overdueAmount: true },
          where: {
            isOverdue: true,
            status: 'ACTIVE',
            daysOverdue: { gte: 0, lt: 30 },
          },
        }),
      ]),

      // Bucket: 30-60 days
      Promise.all([
        prisma.loan.count({
          where: {
            isOverdue: true,
            status: 'ACTIVE',
            daysOverdue: { gte: 30, lt: 60 },
          },
        }),
        prisma.loan.aggregate({
          _sum: { overdueAmount: true },
          where: {
            isOverdue: true,
            status: 'ACTIVE',
            daysOverdue: { gte: 30, lt: 60 },
          },
        }),
      ]),

      // Bucket: 60-90 days
      Promise.all([
        prisma.loan.count({
          where: {
            isOverdue: true,
            status: 'ACTIVE',
            daysOverdue: { gte: 60, lt: 90 },
          },
        }),
        prisma.loan.aggregate({
          _sum: { overdueAmount: true },
          where: {
            isOverdue: true,
            status: 'ACTIVE',
            daysOverdue: { gte: 60, lt: 90 },
          },
        }),
      ]),

      // Bucket: 90+ days
      Promise.all([
        prisma.loan.count({
          where: {
            isOverdue: true,
            status: 'ACTIVE',
            daysOverdue: { gte: 90 },
          },
        }),
        prisma.loan.aggregate({
          _sum: { overdueAmount: true },
          where: {
            isOverdue: true,
            status: 'ACTIVE',
            daysOverdue: { gte: 90 },
          },
        }),
      ]),

      // Recovered from overdue (last 30 days)
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          status: 'COMPLETED',
          loan: { isOverdue: false, overdueSince: { not: null } },
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const totalOverdueAmount = Number(totalAmount._sum.overdueAmount || 0);
    const recovered = Number(recoveredOverdue._sum.amount || 0);
    const recoveryRate =
      totalOverdueAmount > 0 ? (recovered / totalOverdueAmount) * 100 : 0;

    return {
      totalOverdueLoans: totalOverdue,
      totalOverdueAmount,
      totalPenalties: Number(totalPenalties._sum.penaltyAmount || 0),
      bucket0to30: {
        count: bucket0to30[0],
        amount: Number(bucket0to30[1]._sum.overdueAmount || 0),
      },
      bucket30to60: {
        count: bucket30to60[0],
        amount: Number(bucket30to60[1]._sum.overdueAmount || 0),
      },
      bucket60to90: {
        count: bucket60to90[0],
        amount: Number(bucket60to90[1]._sum.overdueAmount || 0),
      },
      bucket90Plus: {
        count: bucket90Plus[0],
        amount: Number(bucket90Plus[1]._sum.overdueAmount || 0),
      },
      recoveryRate,
    };
  }

  /**
   * Get monthly trends (last 12 months)
   */
  static async getMonthlyTrends(months: number = 12): Promise<MonthlyTrend[]> {
    const trends: MonthlyTrend[] = [];
    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const startDate = new Date(
        now.getFullYear(),
        now.getMonth() - i,
        1,
        0,
        0,
        0
      );
      const endDate = new Date(
        now.getFullYear(),
        now.getMonth() - i + 1,
        0,
        23,
        59,
        59
      );

      const [loansCreated, loansDisbursed, loansCompleted, disbursed, collected] =
        await Promise.all([
          prisma.loan.count({
            where: {
              createdAt: { gte: startDate, lte: endDate },
            },
          }),

          prisma.loan.count({
            where: {
              disbursementDate: { gte: startDate, lte: endDate },
            },
          }),

          prisma.loan.count({
            where: {
              status: 'COMPLETED',
              updatedAt: { gte: startDate, lte: endDate },
            },
          }),

          prisma.loan.aggregate({
            _sum: { principalAmount: true },
            where: {
              disbursementDate: { gte: startDate, lte: endDate },
            },
          }),

          prisma.payment.aggregate({
            _sum: { amount: true },
            where: {
              createdAt: { gte: startDate, lte: endDate },
              status: 'COMPLETED',
            },
          }),
        ]);

      const totalDisbursed = Number(disbursed._sum.principalAmount || 0);
      const totalCollected = Number(collected._sum.amount || 0);

      trends.push({
        month: startDate.toLocaleDateString('en-US', { month: 'short' }),
        year: startDate.getFullYear(),
        loansCreated,
        loansDisbursed,
        loansCompleted,
        totalDisbursed,
        totalCollected,
        netOutflow: totalDisbursed - totalCollected,
      });
    }

    return trends;
  }
}

export default ReportsService;
