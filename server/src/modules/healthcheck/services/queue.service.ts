import { Queue, Worker, type Job } from 'bullmq';
import { HealthCheckScheduler } from '../../../models/HealthCheckScheduler';
import { getUserPlan } from '../../payment/services/subscription.service';
import { PLANS } from '../../../config/plans';
import { onRedisReconnect, redisConnectionForBullMQ } from '../../../utils/redisClient';
import { processHealthCheckJob } from './worker.service';

const QUEUE_NAME = 'health-checks';

let queue: Queue | null = null;
let worker: Worker | null = null;

const getQueue = (): Queue => {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: redisConnectionForBullMQ() });
  }
  return queue;
};

export async function startHealthCheckWorker(): Promise<void> {
  if (worker) return;

  const connection = redisConnectionForBullMQ();
  worker = new Worker(
    QUEUE_NAME,
    async (job: Job<{ loadBalancerId: string }>) => {
      await processHealthCheckJob(job.data.loadBalancerId);
    },
    {
      connection,
      concurrency: Number(process.env.HEALTH_CHECK_CONCURRENCY || 1000),
    }
  );

  worker.on('failed', (job, error) => {
    console.error(`Health check job ${job?.id} failed: ${error.message}`);
  });

  worker.on('ready', () => {
    console.log(`Health check worker started (queue: ${QUEUE_NAME})`);
  });

  onRedisReconnect(async () => {
    console.log('Redis reconnected — resyncing health check schedulers');
    await resyncHealthCheckJobs();
  });
}

export async function resyncHealthCheckJobs(): Promise<void> {
  const cursor = HealthCheckScheduler.find({ enabled: true })
    .select({ loadBalancerId: 1, intervalSeconds: 1, userId: 1 })
    .lean()
    .cursor();

  let total = 0;
  let skipped = 0;
  const batch: Array<{ loadBalancerId: string; intervalSeconds: number; userId: string }> = [];

  const flushBatch = async () => {
    if (batch.length === 0) return;
    const chunk = batch.splice(0);
    await Promise.allSettled(
      chunk.map(async s => {
        const { plan } = await getUserPlan(s.userId.toString());
        if (PLANS[plan].maxHealthCheckLBs === 0) {
          skipped++;
          return;
        }
        await upsertHealthCheckJob(s.loadBalancerId, s.intervalSeconds);
      })
    );
  };

  for await (const doc of cursor) {
    total++;
    batch.push({
      loadBalancerId: doc.loadBalancerId.toString(),
      intervalSeconds: doc.intervalSeconds,
      userId: doc.userId.toString(),
    });
    if (batch.length >= 50) {
      await flushBatch();
    }
  }
  await flushBatch();

  if (total > 0) {
    console.log(`Health check resynced ${total - skipped} scheduler(s) (skipped ${skipped} non-Pro)`);
  }
}

export async function upsertHealthCheckJob(
  loadBalancerId: string,
  intervalSeconds: number
): Promise<void> {
  const healthQueue = getQueue();
  const schedulerId = `lb:${loadBalancerId}`;

  await healthQueue.upsertJobScheduler(
    schedulerId,
    { every: intervalSeconds * 1000 },
    { name: schedulerId, data: { loadBalancerId } }
  );

  console.log(
    `Health check scheduled for ${loadBalancerId} every ${intervalSeconds}s`
  );
}

export async function removeHealthCheckJob(loadBalancerId: string): Promise<void> {
  const healthQueue = getQueue();
  const schedulerId = `lb:${loadBalancerId}`;

  try {
    await healthQueue.removeJobScheduler(schedulerId);
    console.log(`Health check scheduler removed for ${loadBalancerId}`);
  } catch {
    // Job already gone or Redis unavailable — the LB deletion must not fail.
  }
}

export async function enqueueImmediateHealthCheck(loadBalancerId: string): Promise<void> {
  const healthQueue = getQueue();
  await healthQueue.add(
    `lb-immediate:${loadBalancerId}`,
    { loadBalancerId },
    { jobId: `lb-immediate:${loadBalancerId}:${Date.now()}`, removeOnComplete: true, removeOnFail: true }
  );
}

export async function sweepOrphanedSchedulers(): Promise<number> {
  const orphans = await HealthCheckScheduler.aggregate([
    {
      $lookup: {
        from: 'loadbalancers',
        localField: 'loadBalancerId',
        foreignField: '_id',
        as: 'lb',
      },
    },
    { $match: { lb: { $size: 0 } } },
    { $project: { _id: 1, loadBalancerId: 1 } },
  ]);

  if (orphans.length === 0) return 0;

  for (const orphan of orphans) {
    await removeHealthCheckJob(orphan.loadBalancerId.toString());
  }

  const ids = orphans.map(o => o._id);
  await HealthCheckScheduler.deleteMany({ _id: { $in: ids } });
  console.log(`Swept ${orphans.length} orphaned health check scheduler(s)`);
  return orphans.length;
}

export async function closeHealthCheckQueue(): Promise<void> {
  if (worker) {
    await worker.close().catch(() => {});
    worker = null;
  }
  if (queue) {
    await queue.close().catch(() => {});
    queue = null;
  }
}
