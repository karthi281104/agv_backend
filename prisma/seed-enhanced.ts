import { PrismaClient, LoanStatus, PaymentStatus, PaymentType, UserRole } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding with comprehensive dummy data...');

  // Create default admin user
  const hashedPassword = await bcryptjs.hash('admin123', 12);
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@agvgold.com' },
    update: {},
    create: {
      email: 'admin@agvgold.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN
    }
  });

  console.log('✅ Created admin user:', adminUser.email);

  // Create sample employees
  const employeePassword = await bcryptjs.hash('employee123', 12);
  
  const employee = await prisma.user.upsert({
    where: { email: 'employee@agvgold.com' },
    update: {},
    create: {
      email: 'employee@agvgold.com',
      password: employeePassword,
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.EMPLOYEE
    }
  });

  console.log('✅ Created employee user:', employee.email);

  // Create manager user
  const managerPassword = await bcryptjs.hash('manager123', 12);
  
  const manager = await prisma.user.upsert({
    where: { email: 'manager@agvgold.com' },
    update: {},
    create: {
      email: 'manager@agvgold.com',
      password: managerPassword,
      firstName: 'Jane',
      lastName: 'Smith',
      role: UserRole.MANAGER
    }
  });

  console.log('✅ Created manager user:', manager.email);

  // Create default gold rates
  const goldRates = [
    { purity: '24K', rate: 6800 },
    { purity: '22K', rate: 6200 },
    { purity: '18K', rate: 5100 },
    { purity: '14K', rate: 3950 }
  ];

  for (const rateData of goldRates) {
    const existingRate = await prisma.goldRate.findFirst({
      where: {
        purity: rateData.purity,
        isActive: true
      }
    });

    if (!existingRate) {
      await prisma.goldRate.create({
        data: {
          purity: rateData.purity,
          rate: rateData.rate,
          isActive: true
        }
      });
    }
  }

  console.log('✅ Created default gold rates');

  // Create default settings
  const settings = [
    { key: 'MAX_LTV_RATIO', value: '75', description: 'Maximum Loan to Value ratio percentage', category: 'lending' },
    { key: 'MIN_LOAN_AMOUNT', value: '5000', description: 'Minimum loan amount in INR', category: 'lending' },
    { key: 'MAX_LOAN_AMOUNT', value: '5000000', description: 'Maximum loan amount in INR', category: 'lending' },
    { key: 'DEFAULT_INTEREST_RATE', value: '12', description: 'Default annual interest rate percentage', category: 'lending' },
    { key: 'MAX_TENURE_MONTHS', value: '36', description: 'Maximum loan tenure in months', category: 'lending' },
    { key: 'PENALTY_RATE', value: '2', description: 'Monthly penalty rate percentage', category: 'lending' },
    { key: 'COMPANY_NAME', value: 'AGV Gold Lending', description: 'Company name', category: 'general' },
    { key: 'COMPANY_ADDRESS', value: 'Mumbai, Maharashtra, India', description: 'Company address', category: 'general' },
    { key: 'COMPANY_PHONE', value: '+91-9876543210', description: 'Company contact number', category: 'general' },
    { key: 'COMPANY_EMAIL', value: 'info@agvgold.com', description: 'Company email', category: 'general' }
  ];

  for (const setting of settings) {
    await prisma.settings.upsert({
      where: { key: setting.key },
      update: {},
      create: setting
    });
  }

  console.log('✅ Created default settings');

  // Create multiple sample customers
  const customerData = [
    {
      firstName: 'Rajesh',
      lastName: 'Kumar',
      email: 'rajesh.kumar@example.com',
      phone: '9876543210',
      address: '123 Main Street, Andheri',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
      dateOfBirth: new Date('1985-05-15'),
      occupation: 'Business Owner',
      monthlyIncome: 75000,
      aadharNumber: '123456789012',
      panNumber: 'ABCDE1234F',
      kycVerified: true
    },
    {
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya.sharma@example.com',
      phone: '9876543211',
      address: '456 Park Avenue, Bandra',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
      dateOfBirth: new Date('1990-08-22'),
      occupation: 'Software Engineer',
      monthlyIncome: 95000,
      aadharNumber: '234567890123',
      panNumber: 'BCDEF2345G',
      kycVerified: true
    },
    {
      firstName: 'Amit',
      lastName: 'Singh',
      email: 'amit.singh@example.com',
      phone: '9876543212',
      address: '789 Garden Road, Pune',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      dateOfBirth: new Date('1982-12-10'),
      occupation: 'Restaurant Owner',
      monthlyIncome: 120000,
      aadharNumber: '345678901234',
      panNumber: 'CDEFG3456H',
      kycVerified: true
    },
    {
      firstName: 'Sunita',
      lastName: 'Patel',
      email: 'sunita.patel@example.com',
      phone: '9876543213',
      address: '321 Commerce Street, Ahmedabad',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380001',
      dateOfBirth: new Date('1988-03-18'),
      occupation: 'Textile Business',
      monthlyIncome: 85000,
      aadharNumber: '456789012345',
      panNumber: 'DEFGH4567I',
      kycVerified: false
    },
    {
      firstName: 'Vikram',
      lastName: 'Reddy',
      email: 'vikram.reddy@example.com',
      phone: '9876543214',
      address: '654 Tech Park, Hyderabad',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500001',
      dateOfBirth: new Date('1987-07-25'),
      occupation: 'IT Consultant',
      monthlyIncome: 110000,
      aadharNumber: '567890123456',
      panNumber: 'EFGHI5678J',
      kycVerified: true
    },
    {
      firstName: 'Kavya',
      lastName: 'Nair',
      email: 'kavya.nair@example.com',
      phone: '9876543215',
      address: '987 Beach Road, Kochi',
      city: 'Kochi',
      state: 'Kerala',
      pincode: '682001',
      dateOfBirth: new Date('1992-11-30'),
      occupation: 'Doctor',
      monthlyIncome: 150000,
      aadharNumber: '678901234567',
      panNumber: 'FGHIJ6789K',
      kycVerified: true
    },
    {
      firstName: 'Ravi',
      lastName: 'Gupta',
      email: 'ravi.gupta@example.com',
      phone: '9876543216',
      address: '147 Market Square, Jaipur',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      dateOfBirth: new Date('1983-04-12'),
      occupation: 'Jewelry Merchant',
      monthlyIncome: 200000,
      aadharNumber: '789012345678',
      panNumber: 'GHIJK7890L',
      kycVerified: true
    },
    {
      firstName: 'Meera',
      lastName: 'Joshi',
      email: 'meera.joshi@example.com',
      phone: '9876543217',
      address: '258 Hill Station Road, Shimla',
      city: 'Shimla',
      state: 'Himachal Pradesh',
      pincode: '171001',
      dateOfBirth: new Date('1986-09-08'),
      occupation: 'Hotel Owner',
      monthlyIncome: 90000,
      aadharNumber: '890123456789',
      panNumber: 'HIJKL8901M',
      kycVerified: false
    }
  ];

  const customers = [];
  for (const custData of customerData) {
    const customer = await prisma.customer.upsert({
      where: { phone: custData.phone },
      update: {},
      create: custData
    });
    customers.push(customer);
  }

  console.log('✅ Created sample customers:', customers.length);

  // Create sample loans for customers
  const loans = [];
  
  // Loan 1 - Rajesh Kumar (ACTIVE)
  const loan1 = await prisma.loan.create({
    data: {
      customerId: customers[0].id,
      principalAmount: 250000,
      interestRate: 12,
      tenure: 24,
      emiAmount: 11788.46,
      totalGoldWeight: 50.5,
      totalGoldValue: 312500,
      ltvRatio: 80.0,
      status: LoanStatus.ACTIVE,
      applicationDate: new Date('2024-01-15'),
      approvalDate: new Date('2024-01-16'),
      disbursementDate: new Date('2024-01-17'),
      maturityDate: new Date('2026-01-17'),
      createdById: adminUser.id,
      approvedById: adminUser.id,
      purpose: 'Business expansion',
      loanNumber: 'GL240115001'
    }
  });
  loans.push(loan1);

  // Loan 2 - Priya Sharma (ACTIVE)
  const loan2 = await prisma.loan.create({
    data: {
      customerId: customers[1].id,
      principalAmount: 150000,
      interestRate: 11.5,
      tenure: 18,
      emiAmount: 9284.32,
      totalGoldWeight: 30.2,
      totalGoldValue: 187200,
      ltvRatio: 80.1,
      status: LoanStatus.ACTIVE,
      applicationDate: new Date('2024-02-20'),
      approvalDate: new Date('2024-02-21'),
      disbursementDate: new Date('2024-02-22'),
      maturityDate: new Date('2025-08-22'),
      createdById: employee.id,
      approvedById: manager.id,
      purpose: 'Home renovation',
      loanNumber: 'GL240220002'
    }
  });
  loans.push(loan2);

  // Loan 3 - Amit Singh (COMPLETED)
  const loan3 = await prisma.loan.create({
    data: {
      customerId: customers[2].id,
      principalAmount: 500000,
      interestRate: 13,
      tenure: 36,
      emiAmount: 16899.43,
      totalGoldWeight: 82.3,
      totalGoldValue: 625000,
      ltvRatio: 80.0,
      status: LoanStatus.COMPLETED,
      applicationDate: new Date('2023-06-10'),
      approvalDate: new Date('2023-06-11'),
      disbursementDate: new Date('2023-06-12'),
      maturityDate: new Date('2024-06-12'),
      createdById: employee.id,
      approvedById: adminUser.id,
      purpose: 'Restaurant equipment',
      loanNumber: 'GL230610003'
    }
  });
  loans.push(loan3);

  // Loan 4 - Sunita Patel (PENDING)
  const loan4 = await prisma.loan.create({
    data: {
      customerId: customers[3].id,
      principalAmount: 100000,
      interestRate: 12.5,
      tenure: 12,
      emiAmount: 8884.88,
      totalGoldWeight: 20.1,
      totalGoldValue: 125000,
      ltvRatio: 80.0,
      status: LoanStatus.PENDING,
      applicationDate: new Date('2024-10-15'),
      createdById: employee.id,
      purpose: 'Working capital',
      loanNumber: 'GL241015004'
    }
  });
  loans.push(loan4);

  // Loan 5 - Vikram Reddy (ACTIVE)
  const loan5 = await prisma.loan.create({
    data: {
      customerId: customers[4].id,
      principalAmount: 350000,
      interestRate: 11.8,
      tenure: 30,
      emiAmount: 13524.67,
      totalGoldWeight: 65.8,
      totalGoldValue: 437500,
      ltvRatio: 80.0,
      status: LoanStatus.ACTIVE,
      applicationDate: new Date('2024-03-08'),
      approvalDate: new Date('2024-03-09'),
      disbursementDate: new Date('2024-03-10'),
      maturityDate: new Date('2026-09-10'),
      createdById: manager.id,
      approvedById: adminUser.id,
      purpose: 'IT equipment purchase',
      loanNumber: 'GL240308005'
    }
  });
  loans.push(loan5);

  // Loan 6 - Kavya Nair (DEFAULTED)
  const loan6 = await prisma.loan.create({
    data: {
      customerId: customers[5].id,
      principalAmount: 200000,
      interestRate: 11,
      tenure: 24,
      emiAmount: 9373.42,
      totalGoldWeight: 40.5,
      totalGoldValue: 250000,
      ltvRatio: 80.0,
      status: LoanStatus.DEFAULTED,
      applicationDate: new Date('2023-12-05'),
      approvalDate: new Date('2023-12-06'),
      disbursementDate: new Date('2023-12-07'),
      maturityDate: new Date('2025-12-07'),
      createdById: employee.id,
      approvedById: manager.id,
      purpose: 'Medical equipment',
      loanNumber: 'GL231205006'
    }
  });
  loans.push(loan6);

  console.log('✅ Created sample loans:', loans.length);

  // Create gold items for loans
  await prisma.goldItem.createMany({
    data: [
      {
        loanId: loan1.id,
        itemType: 'Necklace',
        weight: 25.5,
        purity: '22K',
        description: 'Traditional gold necklace',
        currentRate: 6200,
        totalValue: 158100,
        images: ['necklace1.jpg']
      },
      {
        loanId: loan1.id,
        itemType: 'Bangles',
        weight: 25.0,
        purity: '22K',
        description: 'Set of gold bangles',
        currentRate: 6200,
        totalValue: 155000,
        images: ['bangles1.jpg']
      },
      {
        loanId: loan2.id,
        itemType: 'Chain',
        weight: 15.2,
        purity: '22K',
        description: 'Gold chain with pendant',
        currentRate: 6200,
        totalValue: 94240,
        images: ['chain1.jpg']
      },
      {
        loanId: loan2.id,
        itemType: 'Earrings',
        weight: 15.0,
        purity: '22K',
        description: 'Gold earrings pair',
        currentRate: 6200,
        totalValue: 93000,
        images: ['earrings1.jpg']
      }
    ]
  });

  // Create payments
  await prisma.payment.createMany({
    data: [
      // Disbursement for Loan 1
      {
        loanId: loan1.id,
        amount: 250000,
        paymentType: PaymentType.LOAN_DISBURSEMENT,
        paymentMethod: 'Bank Transfer',
        status: PaymentStatus.COMPLETED,
        paymentDate: new Date('2024-01-17'),
        createdById: adminUser.id,
        receiptNumber: 'RCP240117001'
      },
      // EMI payments for Loan 1
      {
        loanId: loan1.id,
        amount: 11788.46,
        paymentType: PaymentType.EMI_PAYMENT,
        paymentMethod: 'UPI',
        status: PaymentStatus.COMPLETED,
        paymentDate: new Date('2024-02-17'),
        principalAmount: 8788.46,
        interestAmount: 3000,
        createdById: employee.id,
        receiptNumber: 'RCP240217001'
      },
      {
        loanId: loan1.id,
        amount: 11788.46,
        paymentType: PaymentType.EMI_PAYMENT,
        paymentMethod: 'Cash',
        status: PaymentStatus.COMPLETED,
        paymentDate: new Date('2024-03-17'),
        principalAmount: 8850,
        interestAmount: 2938.46,
        createdById: employee.id,
        receiptNumber: 'RCP240317001'
      },
      // Disbursement for Loan 2
      {
        loanId: loan2.id,
        amount: 150000,
        paymentType: PaymentType.LOAN_DISBURSEMENT,
        paymentMethod: 'Bank Transfer',
        status: PaymentStatus.COMPLETED,
        paymentDate: new Date('2024-02-22'),
        createdById: manager.id,
        receiptNumber: 'RCP240222001'
      },
      // EMI for Loan 2
      {
        loanId: loan2.id,
        amount: 9284.32,
        paymentType: PaymentType.EMI_PAYMENT,
        paymentMethod: 'Bank Transfer',
        status: PaymentStatus.COMPLETED,
        paymentDate: new Date('2024-03-22'),
        principalAmount: 7034.32,
        interestAmount: 2250,
        createdById: employee.id,
        receiptNumber: 'RCP240322001'
      },
      // Completed loan (Loan 3)
      {
        loanId: loan3.id,
        amount: 500000,
        paymentType: PaymentType.LOAN_DISBURSEMENT,
        paymentMethod: 'Bank Transfer',
        status: PaymentStatus.COMPLETED,
        paymentDate: new Date('2023-06-12'),
        createdById: adminUser.id,
        receiptNumber: 'RCP230612001'
      },
      {
        loanId: loan3.id,
        amount: 608380.48,
        paymentType: PaymentType.LOAN_CLOSURE,
        paymentMethod: 'Bank Transfer',
        status: PaymentStatus.COMPLETED,
        paymentDate: new Date('2024-06-12'),
        principalAmount: 500000,
        interestAmount: 108380.48,
        createdById: manager.id,
        receiptNumber: 'RCP240612001'
      },
      // Disbursement for Loan 5
      {
        loanId: loan5.id,
        amount: 350000,
        paymentType: PaymentType.LOAN_DISBURSEMENT,
        paymentMethod: 'Bank Transfer',
        status: PaymentStatus.COMPLETED,
        paymentDate: new Date('2024-03-10'),
        createdById: adminUser.id,
        receiptNumber: 'RCP240310001'
      },
      // EMI for Loan 5
      {
        loanId: loan5.id,
        amount: 13524.67,
        paymentType: PaymentType.EMI_PAYMENT,
        paymentMethod: 'UPI',
        status: PaymentStatus.COMPLETED,
        paymentDate: new Date('2024-04-10'),
        principalAmount: 10024.67,
        interestAmount: 3500,
        createdById: employee.id,
        receiptNumber: 'RCP240410001'
      }
    ]
  });

  console.log('✅ Created comprehensive payment records');

  console.log('🎉 Database seeding completed with comprehensive dummy data!');
  console.log('\n📊 Data Summary:');
  console.log('- Users: 3 (Admin, Manager, Employee)');
  console.log('- Customers: 8');
  console.log('- Loans: 6 (2 Active, 1 Completed, 1 Pending, 1 Defaulted)');
  console.log('- Gold Items: 4');
  console.log('- Payments: 9');
  console.log('- Gold Rates: 4');
  console.log('- Settings: 10');
  
  console.log('\n📋 Default login credentials:');
  console.log('Admin: admin@agvgold.com / admin123');
  console.log('Manager: manager@agvgold.com / manager123');
  console.log('Employee: employee@agvgold.com / employee123');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });