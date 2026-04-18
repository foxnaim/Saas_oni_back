import { IoAdapter } from '@nestjs/platform-socket.io';
import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServerOptions } from 'socket.io';

export class WebsocketAdapter extends IoAdapter {
  private readonly corsOrigin: string;

  constructor(app: INestApplicationContext) {
    super(app);
    const configService = app.get(ConfigService);
    this.corsOrigin = configService.get<string>('FRONTEND_URL', '*');
  }

  createIOServer(port: number, options?: Partial<ServerOptions>) {
    const serverOptions: Partial<ServerOptions> = {
      ...options,
      cors: {
        origin: this.corsOrigin,
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    };

    return super.createIOServer(port, serverOptions);
  }
}
