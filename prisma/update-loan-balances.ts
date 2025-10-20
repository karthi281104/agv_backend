import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateLoanBalances() {
  console.log('🔧 Updating outstanding balances for existing loans...');

  // Get all loans
  const loans = await prisma.loan.findMany();

  console.log(`📊 Found ${loans.length} loans to update`);

  for (const loan of loans) {
    // Get total payments for this loan
    const payments = await prisma.payment.findMany({
      where: {
        loanId: loan.id,
        status: 'COMPLETED',
        paymentType: {
          in: ['EMI_PAYMENT', 'PARTIAL_PAYMENT', 'LOAN_CLOSURE']
        }
      }
    });

    const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const outstanding = Number(loan.principalAmount) - totalPaid;

    // Update loan
    await prisma.loan.update({
      where: { id: loan.id },
      data: {
        outstandingBalance: Math.max(0, outstanding),
        totalAmountPaid: totalPaid
      }
    });

    console.log(`✅ Updated ${loan.loanNumber}: Outstanding = ₹${outstanding.toFixed(2)}, Paid = ₹${totalPaid.toFixed(2)}`);
  }

  console.log('🎉 All loan balances updated successfully!');
}

updateLoanBalances()
  .then(() => {
    console.log('✅ Migration complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
