import express from 'express';
import { body, param, query } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { handleValidationErrors, asyncHandler } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { ApiResponse, CreateCustomerRequest, PaginatedResponse } from '../types';
import { getPaginationParams, calculatePagination, createPaginatedResponse } from '../utils/helpers';

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/customers
router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isString(),
  query('status').optional().isString(),
  query('hasActiveLoans').optional().isBoolean().toBoolean(),
  query('sort').optional().isString(),
  query('order').optional().isIn(['asc','desc'])
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { page, limit } = getPaginationParams(req.query);
  const search = req.query.search as string;
  const statusParam = (req.query.status as string) || '';
  const hasActiveLoans = (req.query.hasActiveLoans as any) as boolean | undefined;
  const sort = (req.query.sort as string) || 'createdAt';
  const order = (req.query.order as 'asc' | 'desc') || 'desc';
  const skip = (page - 1) * limit;

  // Build status-based filters
  let statusConditions: any[] = [];
  if (statusParam) {
    const statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean);
    statuses.forEach(s => {
      if (s === 'active') {
        statusConditions.push({ isActive: true });
      } else if (s === 'inactive') {
        statusConditions.push({ isActive: false });
      } else if (s === 'pending_verification') {
        statusConditions.push({ kycVerified: false });
      }
    });
  }

  // Build search filter
  const searchCondition = search ? {
    OR: [
      { firstName: { contains: search, mode: 'insensitive' as const } },
      { lastName: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
      { phone: { contains: search, mode: 'insensitive' as const } }
    ]
  } : undefined;

  // Combine where conditions
  let where: any = {};
  if (searchCondition) where = { ...where, ...searchCondition };
  if (statusConditions.length === 1) {
    where = { AND: [where, statusConditions[0]] };
  } else if (statusConditions.length > 1) {
    where = { AND: [where, { OR: statusConditions }] };
  }

  if (hasActiveLoans === true) {
    where = {
      AND: [
        where,
        { loans: { some: { status: 'ACTIVE' } } }
      ]
    };
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: sort === 'name'
        ? [{ firstName: order } as any, { lastName: order } as any]
        : { createdAt: order },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        city: true,
        state: true,
        occupation: true,
        monthlyIncome: true,
        isActive: true,
        kycVerified: true,
        createdAt: true,
        _count: {
          select: { loans: true }
        }
      }
    }),
    prisma.customer.count({ where })
  ]);

  // Aggregate active loans and amounts for the page of customers
  const customerIds = customers.map(c => c.id);
  const [activeLoansAgg, disbursedAgg] = await Promise.all([
    prisma.loan.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds }, status: 'ACTIVE' },
      _count: { _all: true },
      _sum: { outstandingBalance: true }
    }),
    prisma.loan.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds }, status: { in: ['ACTIVE', 'COMPLETED'] } },
      _sum: { principalAmount: true }
    })
  ]);

  const activeMap = new Map<string, { count: number; outstanding: number }>();
  activeLoansAgg.forEach(row => {
    activeMap.set(row.customerId, {
      count: row._count._all,
      outstanding: Number(row._sum.outstandingBalance || 0)
    });
  });
  const disbursedMap = new Map<string, number>();
  disbursedAgg.forEach(row => {
    disbursedMap.set(row.customerId, Number(row._sum.principalAmount || 0));
  });

  const enrichedCustomers = customers.map(c => ({
    ...c,
    activeLoans: activeMap.get(c.id)?.count || 0,
    totalOutstanding: activeMap.get(c.id)?.outstanding || 0,
    totalDisbursed: disbursedMap.get(c.id) || 0,
  }));

  const pagination = calculatePagination(page, limit, total);
  const response: ApiResponse<PaginatedResponse<any>> = {
    success: true,
    message: 'Customers retrieved successfully',
    data: createPaginatedResponse(enrichedCustomers, pagination)
  };

  res.json(response);
}));

// GET /api/customers/search - Customer search endpoint for loan creation
router.get('/search', [
  query('q').isString().notEmpty().withMessage('Search query is required')
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const searchQuery = req.query.q as string;

  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { firstName: { contains: searchQuery, mode: 'insensitive' as const } },
        { lastName: { contains: searchQuery, mode: 'insensitive' as const } },
        { phone: { contains: searchQuery, mode: 'insensitive' as const } },
        { email: { contains: searchQuery, mode: 'insensitive' as const } },
        { aadharNumber: { contains: searchQuery, mode: 'insensitive' as const } }
      ],
      isActive: true
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      aadharNumber: true
    },
    take: 10, // Limit search results
    orderBy: { firstName: 'asc' }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Customer search results',
    data: customers
  };

  res.json(response);
}));

// (moved) export route is defined above '/:id' to avoid being captured by the catch-all

// GET /api/customers/:id
router.get('/:id', [
  param('id').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      loans: {
        select: {
          id: true,
          loanNumber: true,
          principalAmount: true,
          status: true,
          applicationDate: true,
          maturityDate: true
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!customer) {
    const response: ApiResponse = {
      success: false,
      message: 'Customer not found'
    };
    res.status(404).json(response);
    return;
  }

  const response: ApiResponse = {
    success: true,
    message: 'Customer retrieved successfully',
    data: customer
  };

  res.json(response);
}));

// POST /api/customers
router.post('/', [
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('phone').matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit phone number is required'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('address').notEmpty().withMessage('Address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('state').notEmpty().withMessage('State is required'),
  body('pincode').matches(/^\d{6}$/).withMessage('Valid 6-digit pincode is required'),
  body('dateOfBirth').optional().isISO8601().withMessage('Valid date of birth is required'),
  body('occupation').optional().notEmpty().withMessage('Occupation is required'),
  body('monthlyIncome').optional().isFloat({ min: 0 }).withMessage('Valid monthly income is required'),
  body('aadharNumber').custom((value, { req }) => {
    // Remove spaces and validate 12 digits
    const cleanAadhar = value.replace(/\s/g, '');
    if (!/^\d{12}$/.test(cleanAadhar)) {
      throw new Error('Valid 12-digit Aadhar number is required');
    }
    // Store cleaned value back to request
    req.body.aadharNumber = cleanAadhar;
    return true;
  }),
  body('panNumber').custom((value, { req }) => {
    // Remove spaces and validate PAN format
    const cleanPAN = value.replace(/\s/g, '').toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPAN)) {
      throw new Error('Valid PAN number is required (format: ABCDE1234F)');
    }
    // Store cleaned value back to request
    req.body.panNumber = cleanPAN;
    return true;
  })
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const customerData: CreateCustomerRequest = req.body;

  console.log('Creating customer with data:', customerData);

  // Only use fields that exist in the Prisma schema (validation has already cleaned Aadhar and PAN)
  const createData: any = {
    firstName: customerData.firstName,
    lastName: customerData.lastName,
    email: customerData.email || undefined,
    phone: customerData.phone,
    address: customerData.address,
    city: customerData.city,
    state: customerData.state,
    pincode: customerData.pincode,
    aadharNumber: customerData.aadharNumber, // Already cleaned by validation
    panNumber: customerData.panNumber // Already cleaned by validation
  };
  
  // Only add monthlyIncome if it's provided (since it's optional in schema)
  if (customerData.monthlyIncome !== undefined) {
    createData.monthlyIncome = customerData.monthlyIncome;
  }
  
  // Only add dateOfBirth if it's provided
  if (customerData.dateOfBirth) {
    createData.dateOfBirth = new Date(customerData.dateOfBirth);
  }
  
  // Only add occupation if it's provided
  if (customerData.occupation) {
    createData.occupation = customerData.occupation;
  }

  try {
    const customer = await prisma.customer.create({
      data: createData
    });

    console.log('Customer created successfully:', customer.id);

    const response: ApiResponse = {
      success: true,
      message: 'Customer created successfully',
      data: customer
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error('Error creating customer:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0];
      let message = 'A customer with this information already exists';
      
      if (field === 'phone') {
        message = 'A customer with this phone number already exists';
      } else if (field === 'email') {
        message = 'A customer with this email already exists';  
      } else if (field === 'aadharNumber') {
        message = 'A customer with this Aadhar number already exists';
      } else if (field === 'panNumber') {
        message = 'A customer with this PAN number already exists';
      }
      
      const response: ApiResponse = {
        success: false,
        message: message,
        error: 'Duplicate entry'
      };
      
      res.status(409).json(response);
      return;
    }
    
    // Re-throw other errors to be handled by global error handler
    throw error;
  }
}));

// PUT /api/customers/:id
router.put('/:id', [
  param('id').isString().notEmpty(),
  body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('phone').optional().matches(/^[6-9]\d{9}$/).withMessage('Valid 10-digit phone number is required'),
  body('email').optional().isEmail().withMessage('Valid email is required'),
  body('monthlyIncome').optional().isFloat({ min: 0 }).withMessage('Valid monthly income is required')
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  const updateData = req.body;

  // Remove undefined values
  Object.keys(updateData).forEach(key => {
    if (updateData[key] === undefined) {
      delete updateData[key];
    }
  });

  const customer = await prisma.customer.update({
    where: { id },
    data: updateData
  });

  const response: ApiResponse = {
    success: true,
    message: 'Customer updated successfully',
    data: customer
  };

  res.json(response);
}));

// GET /api/customers/:id/loans - Get all loans for a customer with details
router.get('/:id/loans', [
  param('id').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;

  // Verify customer exists
  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, firstName: true, lastName: true }
  });

  if (!customer) {
    const response: ApiResponse = {
      success: false,
      message: 'Customer not found'
    };
    res.status(404).json(response);
    return;
  }

  // Get all loans with comprehensive details
  const loans = await prisma.loan.findMany({
    where: { customerId: id },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true
        }
      },
      goldItems: true,
      payments: {
        orderBy: { paymentDate: 'desc' },
        take: 5 // Latest 5 payments per loan
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Calculate summary statistics
  const summary = {
    totalLoans: loans.length,
    activeLoans: loans.filter(l => l.status === 'ACTIVE').length,
    pendingLoans: loans.filter(l => l.status === 'PENDING').length,
    completedLoans: loans.filter(l => l.status === 'COMPLETED').length,
    rejectedLoans: loans.filter(l => l.status === 'REJECTED').length,
    totalDisbursed: loans
      .filter(l => l.status === 'ACTIVE' || l.status === 'COMPLETED')
      .reduce((sum, l) => sum + Number(l.principalAmount), 0),
    totalOutstanding: loans
      .filter(l => l.status === 'ACTIVE')
      .reduce((sum, l) => sum + Number((l as any).outstandingBalance || l.principalAmount), 0),
    totalPaid: loans
      .filter(l => l.status === 'ACTIVE' || l.status === 'COMPLETED')
      .reduce((sum, l) => sum + Number((l as any).totalAmountPaid || 0), 0)
  };

  const response: ApiResponse = {
    success: true,
    message: 'Customer loans retrieved successfully',
    data: {
      customer: {
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`
      },
      summary,
      loans
    }
  };

  res.json(response);
}));

// DELETE /api/customers/:id
router.delete('/:id', [
  param('id').isString().notEmpty()
], handleValidationErrors, asyncHandler(async (req: express.Request, res: express.Response) => {
  const { id } = req.params;

  await prisma.customer.update({
    where: { id },
    data: { isActive: false }
  });

  const response: ApiResponse = {
    success: true,
    message: 'Customer deactivated successfully'
  };

  res.json(response);
}));

// GET /api/customers/export - Export customers as CSV (excel-readable)
router.get('/export', asyncHandler(async (req: express.Request, res: express.Response) => {
  const format = ((req.query.format as string) || 'csv').toLowerCase();
  const search = req.query.search as string | undefined;
  const statusParam = (req.query.status as string) || '';
  const hasActiveLoans = req.query.hasActiveLoans === 'true';

  // Build where as in list route
  let where: any = {};
  if (search) {
    where = {
      ...where,
      OR: [
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search, mode: 'insensitive' as const } }
      ]
    };
  }
  const statuses = statusParam ? statusParam.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (statuses.length > 0) {
    const statusConditions: any[] = [];
    statuses.forEach(s => {
      if (s === 'active') statusConditions.push({ isActive: true });
      else if (s === 'inactive') statusConditions.push({ isActive: false });
      else if (s === 'pending_verification') statusConditions.push({ kycVerified: false });
    });
    where = statusConditions.length === 1 ? { AND: [where, statusConditions[0]] } : { AND: [where, { OR: statusConditions }] };
  }
  if (hasActiveLoans) {
    where = { AND: [where, { loans: { some: { status: 'ACTIVE' } } }] };
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      city: true,
      state: true,
      isActive: true,
      kycVerified: true,
      createdAt: true,
    }
  });

  const customerIds = customers.map(c => c.id);
  const [activeLoansAgg, disbursedAgg] = await Promise.all([
    prisma.loan.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds }, status: 'ACTIVE' },
      _count: { _all: true },
      _sum: { outstandingBalance: true }
    }),
    prisma.loan.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds }, status: { in: ['ACTIVE', 'COMPLETED'] } },
      _sum: { principalAmount: true }
    })
  ]);

  const activeMap = new Map<string, { count: number; outstanding: number }>();
  activeLoansAgg.forEach(row => {
    activeMap.set(row.customerId, {
      count: row._count._all,
      outstanding: Number(row._sum.outstandingBalance || 0)
    });
  });
  const disbursedMap = new Map<string, number>();
  disbursedAgg.forEach(row => {
    disbursedMap.set(row.customerId, Number(row._sum.principalAmount || 0));
  });

  const rows = customers.map(c => {
    const status = c.isActive ? (c.kycVerified ? 'active' : 'pending_verification') : 'inactive';
    return [
      c.id,
      `${c.firstName} ${c.lastName}`.trim(),
      c.phone,
      c.email || '',
      c.city || '',
      c.state || '',
      status,
      (activeMap.get(c.id)?.count || 0).toString(),
      (activeMap.get(c.id)?.outstanding || 0).toString(),
      (disbursedMap.get(c.id) || 0).toString(),
      c.createdAt.toISOString()
    ];
  });

  const header = [
    'CustomerID','Name','Phone','Email','City','State','Status','ActiveLoans','TotalOutstanding','TotalDisbursed','CreatedAt'
  ];
  const csv = [header, ...rows]
    .map(cols => cols.map(v => {
      const val = String(v ?? '');
      return /[",\n]/.test(val) ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(','))
    .join('\n');

  const filename = `customers_${new Date().toISOString().slice(0,10)}.${format === 'csv' ? 'csv' : 'csv'}`;
  // Prepend UTF-8 BOM for better Excel compatibility
  const bom = '\ufeff';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(bom + csv);
}));

export default router;