import type { FastifyInstance } from 'fastify';
import { saveCredentials, updateCredentials, getCredentials, getZones } from '../controllers/cloudflareController';
import { credentialsValidation } from '../middleware/validators/cloudflareValidators';
import { authenticate } from '../middleware/auth';
import { runHandlers } from '../utils/routeRunner';

const TEST = process.env.NODE_ENV === 'test';
const STRICT   = TEST ? { max: 10000, timeWindow: '1 minute' } : { max: 5,  timeWindow: '15 minutes' };
const MODERATE = TEST ? { max: 10000, timeWindow: '1 minute' } : { max: 20, timeWindow: '1 minute'   };
const RELAXED  = TEST ? { max: 10000, timeWindow: '1 minute' } : { max: 60, timeWindow: '1 minute'   };

export default async function cloudflareRoutes(app: FastifyInstance) {
  app.post('/credentials', { config: { rateLimit: STRICT   } }, async (request, reply) => runHandlers([authenticate, ...credentialsValidation, saveCredentials], request, reply));
  app.put('/credentials',  { config: { rateLimit: STRICT   } }, async (request, reply) => runHandlers([authenticate, ...credentialsValidation, updateCredentials], request, reply));
  app.get('/credentials',  { config: { rateLimit: RELAXED  } }, async (request, reply) => runHandlers([authenticate, getCredentials], request, reply));
  app.get('/zones',        { config: { rateLimit: MODERATE } }, async (request, reply) => runHandlers([authenticate, getZones], request, reply));
}
