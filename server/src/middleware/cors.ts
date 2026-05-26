import type { FastifyInstance } from 'fastify';

const getAllowedOrigins = () => (
  process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean) ||
  [process.env.CLIENT_URL || 'http://localhost:3000']
);

export const registerCors = (app: FastifyInstance) => {
  app.addHook('onRequest', async (request, reply) => {
    const origin = typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
    const allowedOrigins = getAllowedOrigins();

    if (origin && allowedOrigins.includes(origin)) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Vary', 'Origin');
    }

    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-operation-id');

    if (request.method === 'OPTIONS') {
      reply.code(204).send();
    }
  });
};

