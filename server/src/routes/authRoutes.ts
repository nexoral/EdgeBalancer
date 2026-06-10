import type { FastifyInstance } from 'fastify';
import { register, login, logout, getCurrentUser, googleAuth } from '../controllers/authController';
import { registerValidation, loginValidation, googleAuthValidation } from '../middleware/validators/authValidators';
import { authenticate } from '../middleware/auth';
import { runHandlers } from '../utils/routeRunner';

const STRICT   = { max: 5,  timeWindow: '15 minutes' };
const RELAXED  = { max: 60, timeWindow: '1 minute'   };

export default async function authRoutes(app: FastifyInstance) {
  app.post('/register', { config: { rateLimit: STRICT  } }, async (request, reply) => runHandlers([...registerValidation, register], request, reply));
  app.post('/login',    { config: { rateLimit: STRICT  } }, async (request: any, reply: any) => runHandlers([...loginValidation, login], request, reply));
  app.post('/google',   { config: { rateLimit: STRICT  } }, async (request, reply) => runHandlers([...googleAuthValidation, googleAuth], request, reply));
  app.post('/logout',   { config: { rateLimit: RELAXED } }, async (request, reply) => runHandlers([logout], request, reply));
  app.get('/me',        { config: { rateLimit: RELAXED } }, async (request, reply) => runHandlers([authenticate, getCurrentUser], request, reply));
}
