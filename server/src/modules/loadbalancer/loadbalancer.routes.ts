import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth';
import { runHandlers } from '../../utils/routeRunner';
import { createLoadBalancerValidator } from '../../middleware/validators/loadBalancerValidators';

import { listLoadBalancers } from './controllers/list.controller';
import { getLoadBalancer } from './controllers/get.controller';
import { createLoadBalancer } from './controllers/create.controller';
import { updateLoadBalancer } from './controllers/update.controller';
import { deleteLoadBalancer } from './controllers/delete.controller';
import { validateLoadBalancerHostname } from './controllers/validate.controller';
import { cancelLoadBalancerDeployment } from './controllers/cancel.controller';
import { pauseLoadBalancerController } from './controllers/pause.controller';
import { resumeLoadBalancerController } from './controllers/resume.controller';
import { getLoadBalancerAnalytics } from './controllers/analytics.controller';
import { getBatchLoadBalancerAnalytics } from './controllers/batch-analytics.controller';

const TEST = process.env.NODE_ENV === 'test';
const STRICT   = TEST ? { max: 10000, timeWindow: '1 minute' } : { max: 5,  timeWindow: '15 minutes' };
const MODERATE = TEST ? { max: 10000, timeWindow: '1 minute' } : { max: 20, timeWindow: '1 minute'   };
const RELAXED  = TEST ? { max: 10000, timeWindow: '1 minute' } : { max: 60, timeWindow: '1 minute'   };

export default async function loadBalancerRoutes(app: FastifyInstance) {
  app.get('/',          { config: { rateLimit: RELAXED  } }, async (request, reply) => runHandlers([authenticate, listLoadBalancers], request, reply));
  app.get('/analytics', { config: { rateLimit: MODERATE } }, async (request, reply) => runHandlers([authenticate, getBatchLoadBalancerAnalytics], request, reply));
  app.get('/:id',       { config: { rateLimit: RELAXED  } }, async (request, reply) => runHandlers([authenticate, getLoadBalancer], request, reply));

  app.post('/',                          { config: { rateLimit: STRICT   } }, async (request, reply) => runHandlers([authenticate, ...createLoadBalancerValidator, createLoadBalancer], request, reply));
  app.put('/:id',                        { config: { rateLimit: STRICT   } }, async (request, reply) => runHandlers([authenticate, updateLoadBalancer], request, reply));
  app.delete('/:id',                     { config: { rateLimit: STRICT   } }, async (request, reply) => runHandlers([authenticate, deleteLoadBalancer], request, reply));

  app.post('/validate-hostname',         { config: { rateLimit: MODERATE } }, async (request, reply) => runHandlers([authenticate, validateLoadBalancerHostname], request, reply));
  app.post('/operations/:operationId/cancel', { config: { rateLimit: RELAXED } }, async (request, reply) => runHandlers([authenticate, cancelLoadBalancerDeployment], request, reply));

  app.post('/:id/pause',                 { config: { rateLimit: STRICT   } }, async (request, reply) => runHandlers([authenticate, pauseLoadBalancerController], request, reply));
  app.post('/:id/resume',                { config: { rateLimit: MODERATE } }, async (request, reply) => runHandlers([authenticate, resumeLoadBalancerController], request, reply));

  app.get('/:id/analytics',             { config: { rateLimit: MODERATE } }, async (request, reply) => runHandlers([authenticate, getLoadBalancerAnalytics], request, reply));
}
