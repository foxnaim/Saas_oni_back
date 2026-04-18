import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

/**
 * Augment the Express Request type so downstream code can read `req.fingerprint`
 * without TypeScript complaints.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Stable browser/client fingerprint derived from request headers. */
      fingerprint?: string;
    }
  }
}

/**
 * FingerprintMiddleware
 *
 * Builds a deterministic, privacy-safe fingerprint from a combination of
 * request headers that remain stable across sessions for the same browser /
 * client but differ between distinct clients.
 *
 * The fingerprint is attached to `req.fingerprint` so that downstream
 * middleware (e.g. AntispamMiddleware) and route handlers can reference it.
 */
@Injectable()
export class FingerprintMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    req.fingerprint = this.buildFingerprint(req);
    next();
  }

  private buildFingerprint(req: Request): string {
    const h = (key: string): string => {
      const val = req.headers[key];
      if (!val) return '';
      return Array.isArray(val) ? val[0] : val;
    };

    const components: string[] = [
      h('user-agent'),
      h('accept-language'),
      h('accept-encoding'),
      h('accept'),
      // sec-ch-ua headers sent by Chromium-based browsers
      h('sec-ch-ua'),
      h('sec-ch-ua-platform'),
      h('sec-ch-ua-mobile'),
      // Hint from the client about its time-zone (non-standard but sometimes present)
      h('x-timezone'),
    ];

    const raw = components.join('|');
    return createHash('sha256').update(raw).digest('hex');
  }
}
