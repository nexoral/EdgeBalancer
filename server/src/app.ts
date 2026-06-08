import Fastify from 'fastify';
import mongoose from 'mongoose';
import { registerCors } from './middleware/cors';
import { registerErrorHandler } from './middleware/errorHandler';
import idempotencyPlugin from './middleware/fastifyIdempotency';
import authRoutes from './routes/authRoutes';
import cloudflareRoutes from './routes/cloudflareRoutes';
import userRoutes from './routes/userRoutes';
import loadBalancerRoutes from './modules/loadbalancer/loadbalancer.routes';

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
    disableRequestLogging: false,
    bodyLimit: 1048576, // 1MB
  });

  // Register plugins
  registerCors(app);
  await app.register(idempotencyPlugin);
  registerErrorHandler(app);

  // Add content type parser for application/json that allows empty bodies
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      const json = body === '' ? {} : JSON.parse(body as string);
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // Health check — used by rolling deploy to verify instance is ready
  app.get('/health', async (_, reply) => {
    const dbReady = mongoose.connection.readyState === 1;
    if (!dbReady) {
      return reply.code(503).send({ status: 'degraded', db: 'disconnected' });
    }
    return reply.send({ status: 'ok' });
  });

  // Register routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(cloudflareRoutes, { prefix: '/api/cloudflare' });
  await app.register(userRoutes, { prefix: '/api/user' });
  await app.register(loadBalancerRoutes, { prefix: '/api/loadbalancers' });

  return app;
};
