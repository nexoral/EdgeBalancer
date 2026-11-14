import { Queue, Worker } from 'bullmq';
import { PaymentHistory } from '../../../models/PaymentHistory';
import { redisConnectionForBullMQ } from '../../../utils/redisClient';

const QUEUE_NAME = 'payment-cleanup';
const EVERY_24H = 24 * 60 * 60 * 1000;
const PENDING_TTL_MS = 30 * 24 * 60 * 60 * 1000;

let queue: Queue | null = null;
let worker: Worker | null = null;

export async function startPendingPaymentCleanup(): Promise<void> {
  const connection = redisConnectionForBullMQ();

  queue = new Queue(QUEUE_NAME, { connection });

  worker = new Worker(
    QUEUE_NAME,
    async () => {
      const cutoff = new Date(Date.now() - PENDING_TTL_MS);
      const result = await PaymentHistory.deleteMany({
        status: 'PENDING',
        createdAt: { $lt: cutoff },
      });
      if (result.deletedCount > 0) {
        console.log(`🧹 Deleted ${result.deletedCount} stale PENDING payment(s) older than 30 days`);
      }
    },
    { connection }
  );

  worker.on('failed', (_job, err) => {
    console.error(`payment-cleanup job failed: ${err.message}`);
  });

  await queue.upsertJobScheduler(
    'daily-pending-cleanup',
    { every: EVERY_24H },
    { name: 'daily-pending-cleanup' }
  );
}

export async function closePendingPaymentCleanup(): Promise<void> {
  await worker?.close();
  await queue?.close();
}
