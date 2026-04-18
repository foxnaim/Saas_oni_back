import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/** URL patterns that should never be logged (e.g. Kubernetes / load-balancer probes). */
const SKIP_PATTERNS: RegExp[] = [
  /^\/health(\/.*)?$/i,
  /^\/healthz$/i,
  /^\/ping$/i,
  /^\/favicon\.ico$/i,
];

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;

    // Skip health-check and similar noise endpoints
    if (SKIP_PATTERNS.some((pattern) => pattern.test(originalUrl))) {
      return next();
    }

    const start = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const elapsed = Date.now() - start;
      const ip = this.extractIp(req);

      const message = `${method} ${originalUrl} ${statusCode} – ${elapsed}ms [${ip}]`;

      if (statusCode >= 500) {
        this.logger.error(message);
      } else if (statusCode >= 400) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }
    });

    next();
  }

  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return first.trim();
    }
    return req.socket?.remoteAddress ?? 'unknown';
  }
}
