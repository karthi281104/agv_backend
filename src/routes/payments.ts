import express from 'express';
import PDFDocument from 'pdfkit';
import { body, param, query } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { handleValidationErrors, asyncHandler } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { ApiResponse, CreatePaymentRequest, PaginatedResponse } from '../types';
import { getPaginationParams, calculatePagination, createPaginatedResponse } from '../utils/helpers';
import OverdueService from '../services/overdueService';

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/payments/:id/receipt - Generate payment receipt PDF
router.get('/:id/receipt', [
  param('id').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      loan: {
        include: {
          customer: {
            select: { firstName: true, lastName: true, phone: true, email: true }
          }
        }
      },
      createdBy: { select: { firstName: true, lastName: true } }
    }
  });

  if (!payment) {
    res.status(404).json({ success: false, message: 'Payment not found' });
    return;
  }

  const doc = new PDFDocument({ margin: 40 });
  const filename = `receipt_${payment.receiptNumber || id}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  // Header
  doc
    .fontSize(18)
    .text('AGV Finance', { align: 'left' })
    .fontSize(10)
    .text('Payment Receipt', { align: 'left' })
    .moveDown();

  doc
    .fontSize(16)
    .text('Receipt', { align: 'right' })
    .moveDown();

  const customerName = `${payment.loan?.customer?.firstName || ''} ${payment.loan?.customer?.lastName || ''}`.trim();

  // Meta
  doc.fontSize(12).text('Receipt Details').moveDown(0.5);
  doc.fontSize(10)
    .text(`Receipt No: ${payment.receiptNumber || id}`)
    .text(`Date: ${payment.paymentDate ? new Date(payment.paymentDate as any).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN')}`)
    .text(`Recorded By: ${payment.createdBy ? payment.createdBy.firstName + ' ' + payment.createdBy.lastName : 'System'}`)
    .moveDown();

  // Loan/Customer
  doc.fontSize(12).text('Loan & Customer').moveDown(0.5);
  doc.fontSize(10)
    .text(`Loan No: ${payment.loan?.loanNumber || '-'}`)
    .text(`Customer: ${customerName || '-'}`)
    .text(`Phone: ${payment.loan?.customer?.phone || '-'}`)
    .text(`Email: ${payment.loan?.customer?.email || '-'}`)
    .moveDown();

  // Payment breakdown
  doc.fontSize(12).text('Payment').moveDown(0.5);
  doc.fontSize(10)
    .text(`Amount: ₹${Number(payment.amount).toLocaleString('en-IN')}`)
    .text(`Type: ${payment.paymentType}`)
    .text(`Method: ${payment.paymentMethod}`)
    .text(`Transaction ID: ${payment.transactionId || '-'}`)
    .text(`Notes: ${payment.notes || '-'}`)
    .moveDown();

  doc
    .fontSize(9)
    .fillColor('#666')
    .text('Thank you for your payment. This is a computer-generated receipt.', { align: 'center' });

  doc.end();
}));

// GET /api/payments
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('loanId').optional().isString(),
  query('status').optional().isIn(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']),
  query('paymentType').optional().isIn(['LOAN_DISBURSEMENT', 'EMI_PAYMENT', 'PARTIAL_PAYMENT', 'INTEREST_PAYMENT', 'PENALTY_PAYMENT', 'LOAN_CLOSURE'])
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { page, limit } = getPaginationParams(req.query);
  const loanId = req.query.loanId as string;
  const status = req.query.status as string;
  const paymentType = req.query.paymentType as string;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (loanId) where.loanId = loanId;
  if (status) where.status = status;
  if (paymentType) where.paymentType = paymentType;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        loan: {
          select: {
            id: true,
            loanNumber: true,
            customer: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        },
        createdBy: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    }),
    prisma.payment.count({ where })
  ]);

  const pagination = calculatePagination(page, limit, total);
  const response: ApiResponse<PaginatedResponse<any>> = {
    success: true,
    message: 'Payments retrieved successfully',
    data: createPaginatedResponse(payments, pagination)
  };

  res.json(response);
}));

// GET /api/payments/:id
router.get('/:id', [
  param('id').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;

  const payment = await prisma.payment.findUnique({
    where: { id },
    include: {
      loan: {
        include: {
          customer: {
            select: {
              firstName: true,
              lastName: true,
              phone: true
            }
          }
        }
      },
      createdBy: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  });

  if (!payment) {
    const response: ApiResponse = {
      success: false,
      message: 'Payment not found'
    };
    res.status(404).json(response);
    return;
  }

  const response: ApiResponse = {
    success: true,
    message: 'Payment retrieved successfully',
    data: payment
  };

  res.json(response);
}));

// POST /api/payments
router.post('/', [
  body('loanId').isString().notEmpty().withMessage('Loan ID is required'),
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
  body('paymentType').isIn(['LOAN_DISBURSEMENT', 'EMI_PAYMENT', 'PARTIAL_PAYMENT', 'INTEREST_PAYMENT', 'PENALTY_PAYMENT', 'LOAN_CLOSURE']).withMessage('Valid payment type is required'),
  body('paymentMethod').notEmpty().withMessage('Payment method is required'),
  body('transactionId').optional().isString(),
  body('dueDate').optional().isISO8601(),
  body('principalAmount').optional().isFloat({ min: 0 }),
  body('interestAmount').optional().isFloat({ min: 0 }),
  body('penaltyAmount').optional().isFloat({ min: 0 }),
  body('notes').optional().isString()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const paymentData: CreatePaymentRequest = req.body;
  const userId = req.user!.id;

  // Verify loan exists
  const loan = await prisma.loan.findUnique({
    where: { id: paymentData.loanId },
    include: {
      customer: {
        select: {
          firstName: true,
          lastName: true
        }
      }
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

  // Generate receipt number
  const receiptNumber = `RCP${Date.now()}`;

  // Create payment and update loan balance in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create payment
    const payment = await tx.payment.create({
      data: {
        loanId: paymentData.loanId,
        amount: paymentData.amount,
        paymentType: paymentData.paymentType,
        paymentMethod: paymentData.paymentMethod,
        transactionId: paymentData.transactionId,
        dueDate: paymentData.dueDate ? new Date(paymentData.dueDate) : undefined,
        principalAmount: paymentData.principalAmount,
        interestAmount: paymentData.interestAmount,
        penaltyAmount: paymentData.penaltyAmount,
        notes: paymentData.notes,
        receiptNumber,
        createdById: userId,
        status: 'COMPLETED' // Auto-complete for now
      },
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
    });

    // Update loan balance if it's an EMI, partial, or closure payment
    if (['EMI_PAYMENT', 'PARTIAL_PAYMENT', 'LOAN_CLOSURE'].includes(paymentData.paymentType)) {
      const updatedLoan = await tx.loan.findUnique({
        where: { id: paymentData.loanId }
      });

      if (updatedLoan) {
        const newTotalPaid = Number(updatedLoan.totalAmountPaid) + Number(paymentData.amount);
        // FIXED: Calculate from current outstanding, not from principal
        const newOutstanding = Number(updatedLoan.outstandingBalance) - Number(paymentData.amount);

        await tx.loan.update({
          where: { id: paymentData.loanId },
          data: {
            totalAmountPaid: newTotalPaid,
            outstandingBalance: Math.max(0, newOutstanding),
            lastPaymentDate: new Date(), // Update last payment date
            // Update status to COMPLETED if fully paid
            status: newOutstanding <= 0 ? 'COMPLETED' : updatedLoan.status
          }
        });
      }
    }

    return payment;
  });

  // Update overdue status after payment
  try {
    await OverdueService.updateLoanOverdueStatus(paymentData.loanId);
  } catch (error) {
    console.error('Error updating overdue status:', error);
    // Don't fail the payment if overdue update fails
  }

  const response: ApiResponse = {
    success: true,
    message: 'Payment recorded successfully',
    data: result
  };

  res.status(201).json(response);
}));

// PUT /api/payments/:id/status
router.put('/:id/status', [
  param('id').isString().notEmpty(),
  body('status').isIn(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED']).withMessage('Valid status is required'),
  body('notes').optional().isString()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const payment = await prisma.payment.update({
    where: { id },
    data: {
      status,
      notes: notes || undefined
    }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Payment status updated successfully',
    data: payment
  };

  res.json(response);
}));

// GET /api/payments/loan/:loanId/schedule
router.get('/loan/:loanId/schedule', [
  param('loanId').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { loanId } = req.params;

  // Get loan details
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    select: {
      principalAmount: true,
      interestRate: true,
      tenure: true,
      emiAmount: true,
      disbursementDate: true,
      status: true
    }
  });

  if (!loan || !loan.disbursementDate) {
    const response: ApiResponse = {
      success: false,
      message: 'Loan not found or not disbursed'
    };
    res.status(404).json(response);
    return;
  }

  // Get all payments for this loan
  const payments = await prisma.payment.findMany({
    where: {
      loanId,
      status: 'COMPLETED',
      paymentType: { in: ['EMI_PAYMENT', 'PARTIAL_PAYMENT', 'LOAN_CLOSURE'] }
    },
    orderBy: { paymentDate: 'asc' }
  });

  // Generate payment schedule
  const schedule = [];
  let remainingPrincipal = Number(loan.principalAmount);
  const monthlyRate = Number(loan.interestRate) / (12 * 100);
  const emiAmount = Number(loan.emiAmount);
  
  let totalPaid = 0;
  payments.forEach((payment: any) => {
    totalPaid += Number(payment.amount);
  });

  for (let month = 1; month <= loan.tenure; month++) {
    const dueDate = new Date(loan.disbursementDate);
    dueDate.setMonth(dueDate.getMonth() + month);

    const interestAmount = remainingPrincipal * monthlyRate;
    const principalAmount = Math.min(emiAmount - interestAmount, remainingPrincipal);
    
    // Find payment for this month
    const monthPayment = payments.find((p: any) => {
      const paymentMonth = new Date(p.paymentDate);
      return paymentMonth.getMonth() === dueDate.getMonth() && 
             paymentMonth.getFullYear() === dueDate.getFullYear();
    });

    schedule.push({
      month,
      dueDate,
      emiAmount,
      principalAmount: Math.round(principalAmount * 100) / 100,
      interestAmount: Math.round(interestAmount * 100) / 100,
      remainingPrincipal: Math.round((remainingPrincipal - principalAmount) * 100) / 100,
      status: monthPayment ? 'PAID' : (dueDate < new Date() ? 'OVERDUE' : 'PENDING'),
      paymentId: monthPayment?.id,
      paidAmount: monthPayment ? Number(monthPayment.amount) : 0,
      paidDate: monthPayment?.paymentDate
    });

    remainingPrincipal -= principalAmount;
    if (remainingPrincipal <= 0) break;
  }

  const response: ApiResponse = {
    success: true,
    message: 'Payment schedule retrieved successfully',
    data: {
      loan: {
        principalAmount: loan.principalAmount,
        interestRate: loan.interestRate,
        tenure: loan.tenure,
        emiAmount: loan.emiAmount
      },
      totalPaid,
      remainingAmount: Math.max(0, Number(loan.principalAmount) - totalPaid),
      schedule
    }
  };

  res.json(response);
}));

export default router;