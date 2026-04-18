import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Shape of every successful response returned by this API. */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * TransformInterceptor
 *
 * Wraps the return value of every route handler in a consistent envelope:
 *
 * ```json
 * {
 *   "success": true,
 *   "data": <original handler return value>,
 *   "timestamp": "2024-01-01T00:00:00.000Z"
 * }
 * ```
 *
 * Apply globally in `main.ts`:
 * ```ts
 * app.useGlobalInterceptors(new TransformInterceptor());
 * ```
 * or via the AppModule providers array with DI support.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, SuccessResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success:   true as const,
        data,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
