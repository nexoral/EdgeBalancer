import type { FastifyReply, FastifyRequest } from 'fastify';
import type { JwtPayload } from '../utils/jwt';

export interface AppRequest extends FastifyRequest {
  user?: JwtPayload;
  cookies: Record<string, string>;
  body: any;
  params: any;
  query: any;
  header(name: string): string | undefined;
  on(event: string, listener: (...args: any[]) => void): this;
  destroyed: boolean;
}

export type NextFunction = (error?: Error) => void;

export type AppHandler = (
  req: AppRequest,
  res: AppResponse,
  next: NextFunction
) => void | Promise<void>;

interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
  maxAge?: number;
  expires?: Date;
  path?: string;
}

const parseCookies = (cookieHeader?: string): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, cookie) => {
      const [rawName, ...rawValue] = cookie.split('=');

      if (!rawName) {
        return accumulator;
      }

      accumulator[decodeURIComponent(rawName)] = decodeURIComponent(rawValue.join('=') || '');
      return accumulator;
    }, {});
};

const serializeCookie = (name: string, value: string, options: CookieOptions = {}) => {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  }

  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  parts.push(`Path=${options.path || '/'}`);

  if (options.httpOnly) {
    parts.push('HttpOnly');
  }

  if (options.secure) {
    parts.push('Secure');
  }

  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`);
  }

  return parts.join('; ');
};

export class AppResponse {
  constructor(private readonly reply: FastifyReply) {}

  status(code: number) {
    this.reply.code(code);
    return this;
  }

  json(payload: unknown) {
    if (!this.reply.sent) {
      this.reply.send(payload);
    }

    return this;
  }

  cookie(name: string, value: string, options: CookieOptions = {}) {
    const serialized = serializeCookie(name, value, options);
    const existing = this.reply.getHeader('set-cookie');

    if (!existing) {
      this.reply.header('set-cookie', serialized);
      return this;
    }

    if (Array.isArray(existing)) {
      this.reply.header('set-cookie', [...existing, serialized]);
      return this;
    }

    this.reply.header('set-cookie', [String(existing), serialized]);
    return this;
  }

  clearCookie(name: string) {
    return this.cookie(name, '', {
      expires: new Date(0),
      maxAge: 0,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });
  }

  get headersSent() {
    return this.reply.sent || this.reply.raw.headersSent;
  }

  get writableEnded() {
    return this.reply.raw.writableEnded;
  }
}

export const createRequestAdapter = (request: FastifyRequest): AppRequest => {
  const adaptedRequest = request as AppRequest;

  adaptedRequest.cookies = parseCookies(request.headers.cookie);
  adaptedRequest.header = (name: string) => {
    const value = request.headers[name.toLowerCase()];

    if (Array.isArray(value)) {
      return value[0];
    }

    return typeof value === 'string' ? value : undefined;
  };

  adaptedRequest.on = ((event: string, listener: (...args: any[]) => void) => {
    request.raw.on(event, listener);
    return adaptedRequest;
  }) as AppRequest['on'];

  Object.defineProperty(adaptedRequest, 'destroyed', {
    get: () => request.raw.destroyed,
    configurable: true,
  });

  return adaptedRequest;
};
