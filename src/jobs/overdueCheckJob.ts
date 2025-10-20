import cron from 'node-cron';
import OverdueService from '../services/overdueService';

/**
 * Scheduled job to update overdue status for all active loans
 * Runs daily at midnight
 */
export function startOverdueCheckJob() {
  // Run every day at midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    console.log('🕐 Running scheduled overdue check...');
    
    try {
      const result = await OverdueService.updateAllOverdueLoans();
      
      console.log('✅ Overdue check completed:', {
        totalProcessed: result.totalProcessed,
        newOverdueLoans: result.newOverdueCount,
        clearedOverdueLoans: result.clearedOverdueCount,
        timestamp: new Date().toISOString(),
      });

      // Check for loans that should be marked as defaulted (>90 days overdue)
      const overdueLoans = await OverdueService.getOverdueLoans({ minDaysOverdue: 90 });
      
      let defaultedCount = 0;
      for (const loan of overdueLoans) {
        const wasDefaulted = await OverdueService.checkAndMarkDefaulted(loan.id, 90);
        if (wasDefaulted) defaultedCount++;
      }

      if (defaultedCount > 0) {
        console.log(`⚠️  Marked ${defaultedCount} loan(s) as DEFAULTED`);
      }

    } catch (error) {
      console.error('❌ Error in overdue check job:', error);
    }
  });

  console.log('🚀 Overdue check job scheduled (runs daily at midnight)');
}

/**
 * Run overdue check immediately (for testing or manual triggers)
 */
export async function runOverdueCheckNow() {
  console.log('🕐 Running immediate overdue check...');
  
  try {
    const result = await OverdueService.updateAllOverdueLoans();
    
    console.log('✅ Overdue check completed:', result);
    return result;
  } catch (error) {
    console.error('❌ Error in overdue check:', error);
    throw error;
  }
}
