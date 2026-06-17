import { getRedisClient } from './redisClient';

const OP_TTL_SECONDS = 60 * 60;

function opKey(operationId: string): string {
  return `lb:op:${operationId}`;
}

export const beginLoadBalancerOperation = async (operationId?: string | null): Promise<void> => {
  if (!operationId) return;
  const redis = await getRedisClient();
  await redis.set(opKey(operationId), 'false', { EX: OP_TTL_SECONDS });
};

export const cancelLoadBalancerOperation = async (operationId: string): Promise<boolean> => {
  const redis = await getRedisClient();
  const exists = await redis.exists(opKey(operationId));
  if (!exists) return false;
  await redis.set(opKey(operationId), 'true', { KEEPTTL: true });
  return true;
};

export const isLoadBalancerOperationCancelled = async (operationId?: string | null): Promise<boolean> => {
  if (!operationId) return false;
  const redis = await getRedisClient();
  const val = await redis.get(opKey(operationId));
  return val === 'true';
};

export const completeLoadBalancerOperation = async (operationId?: string | null): Promise<void> => {
  if (!operationId) return;
  const redis = await getRedisClient();
  await redis.del(opKey(operationId));
};
