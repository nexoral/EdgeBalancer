import type { FastifyInstance } from 'fastify';

export const registerErrorHandler = (app: FastifyInstance) => {
  app.setErrorHandler((error, request, reply) => {
    const appError = error as Error & { statusCode?: number };

    const statusCode = appError.statusCode || (reply.statusCode !== 200 ? reply.statusCode : 500);
    const message = appError.message || 'Internal server error';

    // 4xx are client mistakes — logging them lets any client flood the log.
    if (statusCode >= 500) {
      request.log.error({ err: appError }, 'Request failed');
    }

    reply.code(statusCode).send({
      success: false,
      message,
      data: (appError as any).data ?? null,
    });
  });
};
