import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * ThrottleBehindProxyGuard
 *
 * Extends NestJS's built-in ThrottlerGuard to correctly resolve the client's
 * real IP address when the application is deployed behind a reverse proxy
 * (e.g. Nginx, AWS ALB, Railway, Render, Heroku).
 *
 * Resolution order:
 *  1. `X-Forwarded-For` header (first IP in the comma-separated list)
 *  2. `X-Real-IP` header
 *  3. `request.ip` (Express default — socket remote address)
 *
 * Register globally or per-controller as a drop-in replacement for the
 * default ThrottlerGuard:
 *
 * ```ts
 * // app.module.ts
 * {
 *   provide:  APP_GUARD,
 *   useClass: ThrottleBehindProxyGuard,
 * }
 * ```
 */
@Injectable()
export class ThrottleBehindProxyGuard extends ThrottlerGuard {
  protected override async getTracker(request: Record<string, unknown>): Promise<string> {
    const req = request as unknown as Request;

    // X-Forwarded-For may be a comma-separated list: "client, proxy1, proxy2"
    const xForwardedFor = req.headers['x-forwarded-for'];
    if (xForwardedFor) {
      const firstIp = Array.isArray(xForwardedFor)
        ? xForwardedFor[0]
        : xForwardedFor.split(',')[0];
      const trimmed = firstIp.trim();
      if (trimmed) return trimmed;
    }

    const xRealIp = req.headers['x-real-ip'];
    if (xRealIp) {
      const ip = Array.isArray(xRealIp) ? xRealIp[0] : xRealIp;
      const trimmed = ip.trim();
      if (trimmed) return trimmed;
    }

    // Fall back to Express-resolved IP (may still be the proxy's address if
    // `app.set('trust proxy', ...)` is not configured).
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }

  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    // Delegate to the parent implementation which respects @SkipThrottle().
    return super.shouldSkip(context);
  }
}
