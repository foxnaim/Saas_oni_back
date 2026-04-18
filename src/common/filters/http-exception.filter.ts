import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** Shape of every error response returned by this API. */
export interface ErrorResponse {
  success: false;
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
}

/**
 * Global HTTP exception filter.
 *
 * Catches every exception thrown inside a request lifecycle and serialises it
 * into a consistent `ErrorResponse` envelope.  Special handling is provided for:
 *
 * - NestJS `HttpException` (and subclasses such as `BadRequestException`)
 * - Prisma unique constraint violation  → 409 Conflict
 * - Prisma record not found             → 404 Not Found
 * - All other errors                    → 500 Internal Server Error
 *
 * Stack traces are omitted in production (`NODE_ENV === 'production'`).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx      = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request  = ctx.getRequest<Request>();

    const isProduction = process.env.NODE_ENV === 'production';

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    // ── NestJS HTTP exceptions ─────────────────────────────────────────────
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const responseBody = exception.getResponse();

      if (typeof responseBody === 'string') {
        message = responseBody;
      } else if (typeof responseBody === 'object' && responseBody !== null) {
        const body = responseBody as Record<string, unknown>;
        message = (body.message as string | string[]) ?? exception.message;
        error   = (body.error as string) ?? exception.name;
      }

      error = error || HttpStatus[statusCode] || exception.name;
    }

    // ── Prisma unique constraint violation (P2002) ─────────────────────────
    else if (this.isPrismaUniqueConstraintError(exception)) {
      statusCode = HttpStatus.CONFLICT;
      error      = 'Conflict';
      const field = this.extractPrismaUniqueField(exception as PrismaClientKnownRequestError);
      message = field
        ? `A record with this ${field} already exists`
        : 'Duplicate key error — a record with one of these values already exists';
    }

    // ── Prisma record not found (P2025) ────────────────────────────────────
    else if (this.isPrismaNotFoundError(exception)) {
      statusCode = HttpStatus.NOT_FOUND;
      error      = 'Not Found';
      message    = 'Record not found';
    }

    // ── Generic / unexpected errors ────────────────────────────────────────
    else if (exception instanceof Error) {
      message = isProduction ? 'Internal server error' : exception.message;
    }

    // ── Logging ────────────────────────────────────────────────────────────
    const logMessage =
      `${request.method} ${request.url} → ${statusCode} ${error}` +
      (typeof message === 'string' ? ` | ${message}` : '');

    if (statusCode >= 500) {
      this.logger.error(
        logMessage,
        !isProduction && exception instanceof Error ? exception.stack : undefined,
        HttpExceptionFilter.name,
      );
    } else {
      this.logger.warn(logMessage, HttpExceptionFilter.name);
    }

    // ── Response ───────────────────────────────────────────────────────────
    const body: ErrorResponse = {
      success:    false,
      statusCode,
      message,
      error,
      timestamp:  new Date().toISOString(),
      path:       request.url,
    };

    response.status(statusCode).json(body);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private isPrismaUniqueConstraintError(exception: unknown): boolean {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      (exception as PrismaClientKnownRequestError).code === 'P2002'
    );
  }

  private isPrismaNotFoundError(exception: unknown): boolean {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      (exception as PrismaClientKnownRequestError).code === 'P2025'
    );
  }

  private extractPrismaUniqueField(error: PrismaClientKnownRequestError): string | null {
    const meta = error.meta as { target?: string[] } | undefined;
    if (meta?.target && Array.isArray(meta.target) && meta.target.length > 0) {
      return meta.target[0];
    }
    return null;
  }
}

/** Minimal type for Prisma known request errors. */
interface PrismaClientKnownRequestError {
  code: string;
  meta?: Record<string, unknown>;
}
