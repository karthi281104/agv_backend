import express from 'express';
import PDFDocument from 'pdfkit';
import { body, param, query } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { handleValidationErrors, asyncHandler } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { ApiResponse, CreateLoanRequest, PaginatedResponse } from '../types';
import { getPaginationParams, calculatePagination, createPaginatedResponse, generateLoanNumber, calculateEMI, calculateLTV } from '../utils/helpers';

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/loans/:id/bill - Generate loan bill/invoice PDF
router.get('/:id/bill', [
  param('id').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;

  const loan = await prisma.loan.findUnique({
    where: { id },
    include: {
      customer: {
        select: { firstName: true, lastName: true, phone: true, email: true, address: true }
      },
      goldItems: true
    }
  });

  if (!loan) {
    res.status(404).json({ success: false, message: 'Loan not found' });
    return;
  }

  // Prepare PDF
  const doc = new PDFDocument({ margin: 40 });
  const filename = `loan_bill_${loan.loanNumber || id}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // Pipe to response
  doc.pipe(res);

  // Header
  doc
    .fontSize(18)
    .text('AGV Finance', { align: 'left' })
    .moveDown(0.2)
    .fontSize(10)
    .text('Gold Loan Management System')
    .text('Phone: +91-XXXXXXXXXX  |  Email: support@agvgold.com')
    .moveDown();

  doc
    .fontSize(16)
    .text('Loan Bill / Invoice', { align: 'right' })
    .moveDown();

  // Customer & Loan Details
  const custName = `${loan.customer?.firstName || ''} ${loan.customer?.lastName || ''}`.trim();
  const leftX = 40;
  const rightX = 320;
  const startY = doc.y;

  doc.fontSize(12).text('Customer Details', leftX, startY).moveDown(0.5);
  doc.fontSize(10)
    .text(`Name: ${custName || 'N/A'}`)
    .text(`Phone: ${loan.customer?.phone || 'N/A'}`)
    .text(`Email: ${loan.customer?.email || 'N/A'}`)
    .moveDown();

  doc.fontSize(12).text('Loan Details', rightX, startY).moveDown(0.5);
  doc.fontSize(10)
    .text(`Loan No: ${loan.loanNumber}`)
    .text(`Principal: ₹${Number(loan.principalAmount).toLocaleString('en-IN')}`)
    .text(`Interest: ${loan.interestRate}% p.a.`)
    .text(`Tenure: ${loan.tenure} months`)
    .text(`EMI: ₹${Number(loan.emiAmount || 0).toLocaleString('en-IN')}`)
    .text(`Maturity: ${loan.maturityDate ? new Date(loan.maturityDate).toLocaleDateString('en-IN') : 'N/A'}`)
    .moveDown();

  // Gold Items Table (if any)
  if (loan.goldItems && loan.goldItems.length > 0) {
    doc.moveDown().fontSize(12).text('Pledged Gold Items').moveDown(0.5);
    const tableTop = doc.y;
    const colWidths = [160, 80, 80, 100];
    const headers = ['Item Type', 'Weight (g)', 'Purity', 'Est. Value (₹)'];

    // Header row
    let x = leftX;
    headers.forEach((h, i) => {
      doc.font('Helvetica-Bold').fontSize(10).text(h, x, tableTop);
      x += colWidths[i];
    });
    doc.moveDown();

    // Rows
    let rowY = tableTop + 16;
    loan.goldItems.forEach((gi) => {
      let cx = leftX;
      doc.font('Helvetica').fontSize(10)
        .text(gi.itemType || '-', cx, rowY, { width: colWidths[0] }); cx += colWidths[0];
      doc.text(String(gi.weight ?? '-'), cx, rowY, { width: colWidths[1], align: 'right' }); cx += colWidths[1];
      doc.text(String(gi.purity ?? '-'), cx, rowY, { width: colWidths[2], align: 'right' }); cx += colWidths[2];
      doc.text(Number(gi.totalValue || 0).toLocaleString('en-IN'), cx, rowY, { width: colWidths[3], align: 'right' });
      rowY += 16;
    });
    doc.moveDown();
  }

  // Summary
  const summaryY = doc.y + 10;
  doc
    .moveTo(leftX, summaryY)
    .lineTo(555, summaryY)
    .strokeColor('#cccccc')
    .stroke()
    .fillColor('#000');

  doc.moveDown().font('Helvetica-Bold').text('Summary').moveDown(0.3);
  doc.font('Helvetica').fontSize(10)
    .text(`Outstanding Balance: ₹${Number(loan.outstandingBalance || loan.principalAmount).toLocaleString('en-IN')}`)
    .text(`Status: ${loan.status}`)
    .moveDown(2)
    .fontSize(9)
    .fillColor('#666')
    .text('This is a computer-generated bill. For questions, contact AGV Finance support.', { align: 'center' });

  doc.end();
}));

// GET /api/loans
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['PENDING', 'APPROVED', 'ACTIVE', 'COMPLETED', 'REJECTED', 'DEFAULTED']),
  query('customerId').optional().isString()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { page, limit } = getPaginationParams(req.query);
  const status = req.query.status as string;
  const customerId = req.query.customerId as string;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;
  if (customerId) where.customerId = customerId;

  const [loans, total] = await Promise.all([
    prisma.loan.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        goldItems: true,
        _count: {
          select: { payments: true }
        }
      }
    }),
    prisma.loan.count({ where })
  ]);

  const pagination = calculatePagination(page, limit, total);
  const response: ApiResponse<PaginatedResponse<any>> = {
    success: true,
    message: 'Loans retrieved successfully',
    data: createPaginatedResponse(loans, pagination)
  };

  res.json(response);
}));

// GET /api/loans/:id
router.get('/:id', [
  param('id').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;

  const loan = await prisma.loan.findUnique({
    where: { id },
    include: {
      customer: true,
      goldItems: true,
      payments: {
        orderBy: { createdAt: 'desc' }
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true
        }
      },
      approvedBy: {
        select: {
          id: true,
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

  const response: ApiResponse = {
    success: true,
    message: 'Loan retrieved successfully',
    data: loan
  };

  res.json(response);
}));

// POST /api/loans
router.post('/', [
  body('customerId').isString().notEmpty().withMessage('Customer ID is required'),
  body('principalAmount').isFloat({ min: 1000 }).withMessage('Principal amount must be at least ₹1,000'),
  body('interestRate').isFloat({ min: 0.1, max: 50 }).withMessage('Interest rate must be between 0.1% and 50%'),
  body('tenure').isInt({ min: 1, max: 60 }).withMessage('Tenure must be between 1 and 60 months'),
  body('goldItems').optional().isArray().withMessage('Gold items must be an array'),
  body('goldItems.*.itemType').optional().notEmpty().withMessage('Item type is required'),
  body('goldItems.*.weight').optional().isFloat({ min: 0.1 }).withMessage('Weight must be at least 0.1 grams'),
  body('goldItems.*.purity').optional().notEmpty().withMessage('Purity is required'),
  body('goldItems.*.currentRate').optional().isFloat({ min: 1 }).withMessage('Current rate is required')
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const loanData: CreateLoanRequest = req.body;
  const userId = req.user!.id;

  // Verify customer exists
  const customer = await prisma.customer.findUnique({
    where: { id: loanData.customerId }
  });

  if (!customer) {
    const response: ApiResponse = {
      success: false,
      message: 'Customer not found'
    };
    res.status(404).json(response);
    return;
  }

  // Calculate totals
  const goldItems = loanData.goldItems || [];
  const hasGoldItems = goldItems.length > 0;
  const totalGoldWeight = hasGoldItems ? goldItems.reduce((sum, item) => sum + item.weight, 0) : 0;
  const totalGoldValue = hasGoldItems ? goldItems.reduce((sum, item) => sum + (item.weight * item.currentRate), 0) : 0;
  const ltvRatio = totalGoldValue > 0 ? calculateLTV(loanData.principalAmount, totalGoldValue) : 0;
  const emiAmount = calculateEMI(loanData.principalAmount, loanData.interestRate, loanData.tenure);
  const loanNumber = generateLoanNumber();

  // Calculate maturity date
  const maturityDate = new Date();
  maturityDate.setMonth(maturityDate.getMonth() + loanData.tenure);

  const loan = await prisma.loan.create({
    data: {
      loanNumber,
      customerId: loanData.customerId,
      principalAmount: loanData.principalAmount,
      interestRate: loanData.interestRate,
      tenure: loanData.tenure,
      emiAmount,
      outstandingBalance: loanData.principalAmount, // Initialize with principal amount
      totalAmountPaid: 0, // No payments yet
      totalGoldWeight,
      totalGoldValue,
      ltvRatio,
      maturityDate,
      purpose: loanData.purpose,
      remarks: loanData.remarks,
      createdById: userId,
      ...(hasGoldItems && {
        goldItems: {
          create: goldItems.map(item => ({
            itemType: item.itemType,
            weight: item.weight,
            purity: item.purity,
            description: item.description,
            currentRate: item.currentRate,
            totalValue: item.weight * item.currentRate
          }))
        }
      })
    },
    include: {
      goldItems: true,
      customer: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Loan application created successfully',
    data: loan
  };

  res.status(201).json(response);
}));

// PUT /api/loans/:id/approve
router.put('/:id/approve', [
  param('id').isString().notEmpty(),
  body('remarks').optional().isString()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const { remarks } = req.body;
  const userId = req.user!.id;

  const loan = await prisma.loan.update({
    where: { id },
    data: {
      status: 'APPROVED',
      approvalDate: new Date(),
      approvedById: userId,
      remarks: remarks || undefined
    },
    include: {
      customer: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Loan approved successfully',
    data: loan
  };

  res.json(response);
}));

// PUT /api/loans/:id/reject
router.put('/:id/reject', [
  param('id').isString().notEmpty(),
  body('remarks').notEmpty().withMessage('Rejection reason is required')
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const { remarks } = req.body;

  const loan = await prisma.loan.update({
    where: { id },
    data: {
      status: 'REJECTED',
      remarks
    }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Loan rejected successfully',
    data: loan
  };

  res.json(response);
}));

// PUT /api/loans/:id/disburse
router.put('/:id/disburse', [
  param('id').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  const loan = await prisma.loan.update({
    where: { id },
    data: {
      status: 'ACTIVE',
      disbursementDate: new Date()
    }
  });

  // Create disbursement payment record
  await prisma.payment.create({
    data: {
      loanId: id,
      amount: loan.principalAmount,
      paymentType: 'LOAN_DISBURSEMENT',
      paymentMethod: 'Bank Transfer',
      status: 'COMPLETED',
      createdById: userId,
      notes: 'Loan amount disbursed to customer'
    }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Loan disbursed successfully',
    data: loan
  };

  res.json(response);
}));

export default router;