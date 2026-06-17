import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import crypto from 'crypto';
import { getRedisClient } from '../utils/redisClient';

interface IdempotencyRecord {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  requestBodyHash: string;
}

const TTL_SECONDS = 24 * 60 * 60;
const PROCESSING_TTL_SECONDS = 300;

function idempKey(composite: string): string {
  return `idempotency:${composite}`;
}

function processingKey(composite: string): string {
  return `idempotency:processing:${composite}`;
}

function hashRequestBody(body: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(body || {})).digest('hex');
}

async function idempotencyPlugin(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;

    const idempotencyKey = request.headers['idempotency-key'] as string;
    if (!idempotencyKey) return;

    if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid idempotency key format. Must be 16-128 characters.',
      });
    }

    const userId = (request as any).user?.userId || 'anonymous';
    const compositeKey = crypto
      .createHash('sha256')
      .update(`${userId}:${request.url}:${idempotencyKey}`)
      .digest('hex');

    const redis = await getRedisClient();

    const isProcessing = await redis.exists(processingKey(compositeKey));
    if (isProcessing) {
      return reply.status(409).send({
        success: false,
        message: 'Request is already being processed. Please wait.',
      });
    }

    const raw = await redis.get(idempKey(compositeKey));
    if (raw) {
      const cached: IdempotencyRecord = JSON.parse(raw);
      const currentBodyHash = hashRequestBody(request.body);

      if (cached.requestBodyHash !== currentBodyHash) {
        return reply.status(409).send({
          success: false,
          message: 'Idempotency key reused with different request body',
          code: 'IDEMPOTENCY_KEY_MISMATCH',
        });
      }

      return reply.status(cached.statusCode).headers(cached.headers).send(cached.body);
    }

    await redis.set(processingKey(compositeKey), '1', { EX: PROCESSING_TTL_SECONDS });
    (request as any).idempotencyKey = compositeKey;
  });

  fastify.addHook('preSerialization', async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
    const compositeKey = (request as any).idempotencyKey;
    if (!compositeKey) return payload;

    const redis = await getRedisClient();
    const statusCode = reply.statusCode;

    if (statusCode >= 200 && statusCode < 500) {
      const record: IdempotencyRecord = {
        statusCode,
        headers: reply.getHeaders() as Record<string, string>,
        body: payload,
        requestBodyHash: hashRequestBody(request.body),
      };
      await redis.set(idempKey(compositeKey), JSON.stringify(record), { EX: TTL_SECONDS });
    }

    await redis.del(processingKey(compositeKey));
    return payload;
  });

  fastify.get('/api/idempotency/stats', async () => {
    const redis = await getRedisClient();
    const keys = await redis.keys('idempotency:*');
    const total = keys.filter((k) => !k.includes(':processing:')).length;
    const processing = keys.filter((k) => k.includes(':processing:')).length;
    return { success: true, data: { totalKeys: total, processingKeys: processing } };
  });
}

export default fp(idempotencyPlugin, {
  name: 'idempotency',
  fastify: '5.x',
});
