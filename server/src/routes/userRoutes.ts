import type { FastifyInstance } from 'fastify';
import { getProfile, changePassword } from '../controllers/userController';
import { changePasswordValidation } from '../middleware/validators/userValidators';
import { authenticate } from '../middleware/auth';
import { runHandlers } from '../utils/routeRunner';

const STRICT  = { max: 5,  timeWindow: '15 minutes' };
const RELAXED = { max: 60, timeWindow: '1 minute'   };

export default async function userRoutes(app: FastifyInstance) {
  app.get('/profile',  { config: { rateLimit: RELAXED } }, async (request, reply) => runHandlers([authenticate, getProfile], request, reply));
  app.put('/password', { config: { rateLimit: STRICT  } }, async (request, reply) => runHandlers([authenticate, ...changePasswordValidation, changePassword], request, reply));
}
