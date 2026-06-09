import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth';
import { runHandlers } from '../../utils/routeRunner';
import { listSessions } from './controllers/list.controller';
import { downloadScript } from './controllers/script.controller';

export default async function sessionRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) =>
    runHandlers([authenticate, listSessions], request, reply)
  );

  app.get('/:id/script', async (request, reply) =>
    runHandlers([authenticate, downloadScript], request, reply)
  );
}
