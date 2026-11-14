import { PaymentHistory } from '../../../models/PaymentHistory';

const INTERVAL_MS = 24 * 60 * 60 * 1000;
const PENDING_TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function deleteStalePendingPayments(): Promise<void> {
  const cutoff = new Date(Date.now() - PENDING_TTL_MS);
  const result = await PaymentHistory.deleteMany({
    status: 'PENDING',
    createdAt: { $lt: cutoff },
  });
  if (result.deletedCount > 0) {
    console.log(`🧹 Deleted ${result.deletedCount} stale PENDING payment(s) older than 30 days`);
  }
}

export function startPendingPaymentCleanup(): void {
  deleteStalePendingPayments().catch((err) =>
    console.error('Pending payment cleanup failed on startup:', err)
  );
  setInterval(() => {
    deleteStalePendingPayments().catch((err) =>
      console.error('Pending payment cleanup failed:', err)
    );
  }, INTERVAL_MS).unref();
}
