import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth';
import { runHandlers } from '../../utils/routeRunner';
import { listSessions } from './controllers/list.controller';
import { downloadScript } from './controllers/script.controller';

const RELAXED = { max: 60, timeWindow: '1 minute' };

export default async function sessionRoutes(app: FastifyInstance) {
  app.get('/',          { config: { rateLimit: RELAXED } }, async (request, reply) => runHandlers([authenticate, listSessions], request, reply));
  app.get('/:id/script', { config: { rateLimit: RELAXED } }, async (request, reply) => runHandlers([authenticate, downloadScript], request, reply));
}
