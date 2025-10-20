import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  try {
    console.log('🗑️  Starting database reset...\n');

    // Delete in correct order to respect foreign key constraints
    console.log('Deleting payments...');
    const deletedPayments = await prisma.payment.deleteMany({});
    console.log(`✅ Deleted ${deletedPayments.count} payments`);

    console.log('Deleting gold items...');
    const deletedGoldItems = await prisma.goldItem.deleteMany({});
    console.log(`✅ Deleted ${deletedGoldItems.count} gold items`);

    console.log('Deleting loans...');
    const deletedLoans = await prisma.loan.deleteMany({});
    console.log(`✅ Deleted ${deletedLoans.count} loans`);

    console.log('Deleting customers...');
    const deletedCustomers = await prisma.customer.deleteMany({});
    console.log(`✅ Deleted ${deletedCustomers.count} customers`);

    console.log('Deleting gold rates...');
    const deletedGoldRates = await prisma.goldRate.deleteMany({});
    console.log(`✅ Deleted ${deletedGoldRates.count} gold rates`);

    // Keep users for login access - uncomment below to delete users too
    // console.log('Deleting users...');
    // const deletedUsers = await prisma.user.deleteMany({});
    // console.log(`✅ Deleted ${deletedUsers.count} users`);

    console.log('\n✨ Database reset complete!');
    console.log('📊 All counts are now 0');
    console.log('👤 Users preserved for login access\n');

  } catch (error) {
    console.error('❌ Error resetting database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase()
  .then(() => {
    console.log('✅ Reset script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Reset script failed:', error);
    process.exit(1);
  });
