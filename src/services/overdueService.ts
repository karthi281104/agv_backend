import { PrismaClient, Loan } from '@prisma/client';

const prisma = new PrismaClient();

interface OverdueCalculationResult {
  isOverdue: boolean;
  daysOverdue: number;
  overdueAmount: number;
  penaltyAmount: number;
  nextDueDate: Date | null;
}

export class OverdueService {
  /**
   * Calculate if a loan is overdue and compute penalties
   */
  static calculateOverdueStatus(loan: Loan): OverdueCalculationResult {
    const now = new Date();
    
    // Only ACTIVE loans can be overdue
    if (loan.status !== 'ACTIVE') {
      return {
        isOverdue: false,
        daysOverdue: 0,
        overdueAmount: 0,
        penaltyAmount: 0,
        nextDueDate: null,
      };
    }

    // Calculate next due date based on disbursement date and tenure
    const nextDueDate = this.calculateNextDueDate(loan);
    
    if (!nextDueDate || now <= nextDueDate) {
      return {
        isOverdue: false,
        daysOverdue: 0,
        overdueAmount: 0,
        penaltyAmount: 0,
        nextDueDate,
      };
    }

    // Calculate days overdue
    const daysOverdue = Math.floor((now.getTime() - nextDueDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // FIXED: Calculate overdue amount as EMI amount (monthly installment), not entire outstanding
    // If outstanding is less than EMI, use outstanding
    const emiAmount = Number(loan.emiAmount || 0);
    const outstanding = Number(loan.outstandingBalance);
    const overdueAmount = Math.min(emiAmount, outstanding);
    
    // Calculate penalty on the overdue EMI amount
    const penaltyAmount = this.calculatePenalty(loan, daysOverdue, overdueAmount);

    return {
      isOverdue: true,
      daysOverdue,
      overdueAmount,
      penaltyAmount,
      nextDueDate,
    };
  }

  /**
   * Calculate next EMI due date
   */
  static calculateNextDueDate(loan: Loan): Date | null {
    if (!loan.disbursementDate) return null;

    const disbursementDate = new Date(loan.disbursementDate);
    const lastPaymentDate = loan.lastPaymentDate ? new Date(loan.lastPaymentDate) : null;
    const now = new Date();
    
    // FIXED: Calculate next due date properly
    if (lastPaymentDate) {
      // If payment was made, next due is 1 month from last payment
      const nextDue = new Date(lastPaymentDate);
      nextDue.setMonth(nextDue.getMonth() + 1);
      
      // Keep the same day of month as disbursement date
      nextDue.setDate(disbursementDate.getDate());
      
      return nextDue;
    } else {
      // No payment made yet, calculate from disbursement
      const nextDue = new Date(disbursementDate);
      nextDue.setMonth(nextDue.getMonth() + 1);
      
      // If calculated date is in the past and loan is old, find current EMI period
      if (nextDue < now) {
        const monthsSinceDisbursement = Math.floor(
          (now.getTime() - disbursementDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44) // More accurate month calculation
        );
        nextDue.setMonth(disbursementDate.getMonth() + monthsSinceDisbursement + 1);
        nextDue.setDate(disbursementDate.getDate());
      }
      
      return nextDue;
    }
  }

  /**
   * Calculate penalty amount based on loan configuration
   */
  static calculatePenalty(loan: Loan, daysOverdue: number, overdueAmount: number): number {
    if (daysOverdue <= 0) return 0;

    const penaltyRate = Number(loan.penaltyRate);
    
    if (loan.penaltyType === 'PERCENTAGE') {
      // FIXED: Penalty as percentage PER YEAR, converted to daily rate
      // Formula: overdueAmount * (penaltyRate/100/365) * daysOverdue
      // Example: ₹10,000 overdue * (24%/100/365) * 30 days = ₹197.26
      return (overdueAmount * (penaltyRate / 100 / 365) * daysOverdue);
    } else {
      // Fixed penalty per day (e.g., ₹50 per day)
      return penaltyRate * daysOverdue;
    }
  }

  /**
   * Update overdue status for a single loan
   */
  static async updateLoanOverdueStatus(loanId: string): Promise<Loan> {
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan) {
      throw new Error('Loan not found');
    }

    const overdueStatus = this.calculateOverdueStatus(loan);

    const updatedLoan = await prisma.loan.update({
      where: { id: loanId },
      data: {
        isOverdue: overdueStatus.isOverdue,
        daysOverdue: overdueStatus.daysOverdue,
        overdueAmount: overdueStatus.overdueAmount,
        penaltyAmount: overdueStatus.penaltyAmount,
        nextDueDate: overdueStatus.nextDueDate,
        overdueSince: overdueStatus.isOverdue && !loan.isOverdue 
          ? new Date() 
          : loan.overdueSince,
      },
    });

    return updatedLoan;
  }

  /**
   * Update overdue status for all active loans
   */
  static async updateAllOverdueLoans(): Promise<{
    totalProcessed: number;
    newOverdueCount: number;
    clearedOverdueCount: number;
  }> {
    const activeLoans = await prisma.loan.findMany({
      where: {
        status: 'ACTIVE',
      },
    });

    let newOverdueCount = 0;
    let clearedOverdueCount = 0;

    for (const loan of activeLoans) {
      const wasOverdue = loan.isOverdue;
      const overdueStatus = this.calculateOverdueStatus(loan);

      await prisma.loan.update({
        where: { id: loan.id },
        data: {
          isOverdue: overdueStatus.isOverdue,
          daysOverdue: overdueStatus.daysOverdue,
          overdueAmount: overdueStatus.overdueAmount,
          penaltyAmount: overdueStatus.penaltyAmount,
          nextDueDate: overdueStatus.nextDueDate,
          overdueSince: overdueStatus.isOverdue && !wasOverdue 
            ? new Date() 
            : loan.overdueSince,
        },
      });

      if (!wasOverdue && overdueStatus.isOverdue) newOverdueCount++;
      if (wasOverdue && !overdueStatus.isOverdue) clearedOverdueCount++;
    }

    return {
      totalProcessed: activeLoans.length,
      newOverdueCount,
      clearedOverdueCount,
    };
  }

  /**
   * Get all overdue loans
   */
  static async getOverdueLoans(filters?: {
    minDaysOverdue?: number;
    maxDaysOverdue?: number;
    minAmount?: number;
  }) {
    const where: any = {
      isOverdue: true,
      status: 'ACTIVE',
    };

    if (filters?.minDaysOverdue) {
      where.daysOverdue = { gte: filters.minDaysOverdue };
    }

    if (filters?.maxDaysOverdue) {
      where.daysOverdue = { 
        ...where.daysOverdue,
        lte: filters.maxDaysOverdue 
      };
    }

    if (filters?.minAmount) {
      where.overdueAmount = { gte: filters.minAmount };
    }

    const loans = await prisma.loan.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: {
        daysOverdue: 'desc',
      },
    });

    return loans;
  }

  /**
   * Get overdue statistics
   */
  static async getOverdueStatistics() {
    const [totalOverdue, totalOverdueAmount, totalPenalties, avgDaysOverdue] = await Promise.all([
      prisma.loan.count({
        where: { isOverdue: true, status: 'ACTIVE' },
      }),
      prisma.loan.aggregate({
        where: { isOverdue: true, status: 'ACTIVE' },
        _sum: { overdueAmount: true },
      }),
      prisma.loan.aggregate({
        where: { isOverdue: true, status: 'ACTIVE' },
        _sum: { penaltyAmount: true },
      }),
      prisma.loan.aggregate({
        where: { isOverdue: true, status: 'ACTIVE' },
        _avg: { daysOverdue: true },
      }),
    ]);

    // Get overdue buckets
    const buckets = await Promise.all([
      prisma.loan.count({
        where: { isOverdue: true, status: 'ACTIVE', daysOverdue: { gte: 0, lt: 30 } },
      }),
      prisma.loan.count({
        where: { isOverdue: true, status: 'ACTIVE', daysOverdue: { gte: 30, lt: 60 } },
      }),
      prisma.loan.count({
        where: { isOverdue: true, status: 'ACTIVE', daysOverdue: { gte: 60, lt: 90 } },
      }),
      prisma.loan.count({
        where: { isOverdue: true, status: 'ACTIVE', daysOverdue: { gte: 90 } },
      }),
    ]);

    return {
      totalOverdueLoans: totalOverdue,
      totalOverdueAmount: totalOverdueAmount._sum.overdueAmount || 0,
      totalPenalties: totalPenalties._sum.penaltyAmount || 0,
      averageDaysOverdue: Math.round(avgDaysOverdue._avg.daysOverdue || 0),
      buckets: {
        lessThan30Days: buckets[0],
        from30To60Days: buckets[1],
        from60To90Days: buckets[2],
        moreThan90Days: buckets[3],
      },
    };
  }

  /**
   * Mark loan as defaulted if overdue for too long
   */
  static async checkAndMarkDefaulted(loanId: string, defaultThresholdDays: number = 90): Promise<boolean> {
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
    });

    if (!loan || !loan.isOverdue) return false;

    if (loan.daysOverdue >= defaultThresholdDays) {
      await prisma.loan.update({
        where: { id: loanId },
        data: {
          status: 'DEFAULTED',
        },
      });
      return true;
    }

    return false;
  }
}

export default OverdueService;
