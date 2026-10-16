import Fastify from 'fastify';
import mongoose from 'mongoose';
import { registerHelmet } from './middleware/config/helmet';
import { registerCors } from './middleware/config/cors';
import { registerRateLimit } from './middleware/config/rateLimit';
import { registerErrorHandler } from './middleware/config/errorHandler';
import idempotencyPlugin from './middleware/config/fastifyIdempotency';
import { registerContentTypeParser } from './middleware/config/contentTypeParser';
import authRoutes from './routes/authRoutes';
import cloudflareRoutes from './routes/cloudflareRoutes';
import userRoutes from './routes/userRoutes';
import aiRoutes from './routes/aiRoutes';
import loadBalancerRoutes from './modules/loadbalancer/loadbalancer.routes';
import healthCheckRoutes from './modules/healthcheck/healthcheck.routes';
import sessionRoutes from './modules/session/session.routes';
import paymentRoutes from './modules/payment/payment.routes';
import gatewayRoutes from './modules/gateway/gateway.routes';
import statsRoutes from './modules/stats/stats.routes';
import mcpPlugin from './mcp';

export const buildServer = async () => {
  const app = Fastify({
    logger: process.env.NODE_ENV === 'test' ? false : {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      } : undefined,
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
    routerOptions: { ignoreTrailingSlash: true },
    // Private ranges only: request.ip resolves past Traefik to the real client,
    // and a client-injected X-Forwarded-For entry is never trusted.
    trustProxy: 'loopback, linklocal, uniquelocal',
    disableRequestLogging: false,
    bodyLimit: 1048576, // 1MB
  });

  // Register plugins — security first, then CORS
  await registerHelmet(app);
  await registerCors(app);
  await registerRateLimit(app);
  await app.register(idempotencyPlugin);
  registerErrorHandler(app);
  registerContentTypeParser(app);

  // Kubelet probes: never rate limited, never logged.
  const probeOpts = { logLevel: 'silent' as const, config: { rateLimit: false } };

  // Readiness — drops the pod from the Service while Mongo is down.
  app.get('/health', probeOpts, async (_, reply) => {
    const dbReady = mongoose.connection.readyState === 1;
    if (!dbReady) {
      return reply.code(503).send({ status: 'degraded', db: 'disconnected' });
    }
    return reply.send({ status: 'ok' });
  });

  // Liveness — no dependency checks: failing this restarts the pod.
  app.get('/live', probeOpts, async () => ({ status: 'alive' }));

  // Register routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(cloudflareRoutes, { prefix: '/api/cloudflare' });
  await app.register(userRoutes, { prefix: '/api/user' });
  await app.register(loadBalancerRoutes, { prefix: '/api/loadbalancers' });
  await app.register(healthCheckRoutes, { prefix: '/api/loadbalancers' });
  await app.register(sessionRoutes, { prefix: '/api/sessions' });
  await app.register(aiRoutes, { prefix: '/api/ai' });
  await app.register(paymentRoutes, { prefix: '/api/payments' });
  await app.register(gatewayRoutes, { prefix: '/api/gateways' });
  await app.register(statsRoutes, { prefix: '/api/stats' });
  await app.register(mcpPlugin);

  return app;
};
