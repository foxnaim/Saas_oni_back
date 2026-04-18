import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { UserRole } from '@prisma/client';

const ADMIN_ROOM = 'room:admins';
const companyRoom = (code: string) => `room:company:${code}`;

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    email: string;
    role: string;
    companyCode?: string;
  };
}

@WebSocketGateway({
  cors: {
    // Resolved at runtime via WebsocketAdapter; this is a fallback
    origin: '*',
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WebsocketGateway.name);

  constructor(private readonly configService: ConfigService) {}

  afterInit(_server: Server): void {
    this.logger.log('WebSocket gateway initialised');
  }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const user = this.authenticateClient(client);
      client.data = user;

      const isAdmin =
        user.role === UserRole.admin || user.role === UserRole.super_admin;

      if (isAdmin) {
        await client.join(ADMIN_ROOM);
        this.logger.debug(`Admin ${user.email} joined ${ADMIN_ROOM}`);
      }

      if (user.companyCode) {
        await client.join(companyRoom(user.companyCode));
        this.logger.debug(
          `User ${user.email} joined ${companyRoom(user.companyCode)}`,
        );
      }

      this.logger.log(
        `Client connected: ${client.id} | user=${user.email} role=${user.role}`,
      );
    } catch (err) {
      this.logger.warn(
        `Connection rejected for ${client.id}: ${(err as Error).message}`,
      );
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    const user = client.data;
    if (user?.email) {
      this.logger.log(
        `Client disconnected: ${client.id} | user=${user.email}`,
      );
    } else {
      this.logger.log(`Client disconnected: ${client.id}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Subscribed messages
  // ---------------------------------------------------------------------------

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { companyCode: string },
  ): Promise<void> {
    const { companyCode } = payload ?? {};

    if (!companyCode) {
      throw new WsException('companyCode is required');
    }

    const room = companyRoom(companyCode);
    await client.join(room);
    this.logger.debug(`${client.data?.email ?? client.id} joined ${room}`);
    client.emit('joined', { room });
  }

  @SubscribeMessage('leave')
  async handleLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { companyCode: string },
  ): Promise<void> {
    const { companyCode } = payload ?? {};

    if (!companyCode) {
      throw new WsException('companyCode is required');
    }

    const room = companyRoom(companyCode);
    await client.leave(room);
    this.logger.debug(`${client.data?.email ?? client.id} left ${room}`);
    client.emit('left', { room });
  }

  // ---------------------------------------------------------------------------
  // Emit helpers (called by other services/controllers)
  // ---------------------------------------------------------------------------

  emitToCompany(companyCode: string, event: string, data: unknown): void {
    this.server.to(companyRoom(companyCode)).emit(event, data);
  }

  emitToAdmins(event: string, data: unknown): void {
    this.server.to(ADMIN_ROOM).emit(event, data);
  }

  emitToAll(event: string, data: unknown): void {
    this.server.emit(event, data);
  }

  // ---------------------------------------------------------------------------
  // Typed event helpers
  // ---------------------------------------------------------------------------

  notifyNewMessage(companyCode: string, message: unknown): void {
    this.emitToCompany(companyCode, 'message:new', message);
    this.emitToAdmins('message:new', message);
  }

  notifyMessageUpdated(companyCode: string, message: unknown): void {
    this.emitToCompany(companyCode, 'message:updated', message);
    this.emitToAdmins('message:updated', message);
  }

  notifyMessageDeleted(companyCode: string, messageId: string): void {
    this.emitToCompany(companyCode, 'message:deleted', { id: messageId });
    this.emitToAdmins('message:deleted', { id: messageId });
  }

  notifyCompanyUpdated(companyCode: string, company: unknown): void {
    this.emitToCompany(companyCode, 'company:updated', company);
    this.emitToAdmins('company:updated', company);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private authenticateClient(client: AuthenticatedSocket): {
    userId: string;
    email: string;
    role: string;
    companyCode?: string;
  } {
    // Token can arrive via handshake auth or as a query param
    const token: string | undefined =
      client.handshake.auth?.token ??
      (client.handshake.query?.token as string | undefined);

    if (!token) {
      throw new Error('No token provided');
    }

    const secret = this.configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, secret) as JwtPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      }
      throw new Error('Invalid token');
    }

    if (!payload?.sub || !payload?.email) {
      throw new Error('Invalid token payload');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role ?? UserRole.user,
      companyCode: (payload as JwtPayload & { companyCode?: string }).companyCode,
    };
  }
}
