import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * LoggingInterceptor
 *
 * Logs every inbound HTTP request and the time taken to handle it.
 *
 * Output format (INFO level):
 *   → GET /api/users
 *   ← GET /api/users  42ms
 *
 * Slow requests (> 1 000 ms) are additionally logged at WARN level so they
 * are easy to spot in production logs.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  /** Requests slower than this threshold (ms) are flagged as slow. */
  private static readonly SLOW_REQUEST_THRESHOLD_MS = 1_000;

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request  = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const start    = Date.now();

    this.logger.log(`→ ${method} ${url}`);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const logLine  = `← ${method} ${url}  ${duration}ms`;

          if (duration >= LoggingInterceptor.SLOW_REQUEST_THRESHOLD_MS) {
            this.logger.warn(`[SLOW] ${logLine}`);
          } else {
            this.logger.log(logLine);
          }
        },
        error: () => {
          // Error path: the HttpExceptionFilter will log the details; we only
          // record the duration here so the timing is always captured.
          const duration = Date.now() - start;
          this.logger.log(`← ${method} ${url}  ${duration}ms [error]`);
        },
      }),
    );
  }
}
