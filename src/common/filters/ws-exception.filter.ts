import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * Global WebSocket exception filter.
 *
 * Extends NestJS's BaseWsExceptionFilter so all existing WsException handling
 * continues to work while adding:
 *  - Consistent error envelope emitted to the client via the `exception` event
 *  - Server-side logging
 *  - Graceful handling of plain HttpExceptions thrown inside gateway handlers
 */
@Catch()
export class WsExceptionFilter extends BaseWsExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  override catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();

    let statusCode = 500;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    // ── WsException ──────────────────────────────────────────────────────
    if (exception instanceof WsException) {
      const wsError = exception.getError();
      statusCode = 400;
      error      = 'WebSocket Error';

      if (typeof wsError === 'string') {
        message = wsError;
      } else if (typeof wsError === 'object' && wsError !== null) {
        const errObj = wsError as Record<string, unknown>;
        message = (errObj.message as string | string[]) ?? 'WebSocket error';
        error   = (errObj.error as string) ?? error;
        statusCode = (errObj.statusCode as number) ?? statusCode;
      }
    }

    // ── HttpException thrown inside a gateway handler ────────────────────
    else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) ?? exception.message;
        error   = (b.error as string) ?? exception.name;
      }
    }

    // ── Unexpected errors ─────────────────────────────────────────────────
    else if (exception instanceof Error) {
      message = exception.message;
    }

    // ── Log ───────────────────────────────────────────────────────────────
    const logLine = `[WS] client=${client.id} → ${statusCode} ${error} | ${
      Array.isArray(message) ? message.join(', ') : message
    }`;

    statusCode >= 500
      ? this.logger.error(logLine, exception instanceof Error ? exception.stack : undefined)
      : this.logger.warn(logLine);

    // ── Emit error event back to the offending client ─────────────────────
    client.emit('exception', {
      success:   false,
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
    });
  }
}
