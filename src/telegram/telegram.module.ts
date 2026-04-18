import { DynamicModule, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { session } from 'telegraf';

import { UsersModule } from '../users/users.module';
import { TelegramService } from './telegram.service';
import { TelegramUpdate } from './telegram.update';

// ─────────────────────────────────────────────────────────────────────────────
//  TelegramModule
//
//  • Registers TelegrafModule.forRootAsync only when TELEGRAM_BOT_TOKEN is set.
//  • Exports TelegramService so Messages / Companies modules can inject it.
//  • Uses in-memory session middleware (swap for Redis session in production).
// ─────────────────────────────────────────────────────────────────────────────

@Module({})
export class TelegramModule {
  private static readonly logger = new Logger(TelegramModule.name);

  static forRoot(): DynamicModule {
    return {
      module: TelegramModule,
      imports: [
        ConfigModule,

        // ── Conditionally initialise the Telegraf bot ──────────────────────
        TelegrafModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => {
            const token = configService.get<string>('TELEGRAM_BOT_TOKEN');

            if (!token) {
              TelegramModule.logger.warn(
                'TELEGRAM_BOT_TOKEN is not set – Telegram bot will not start.',
              );
              // Return a minimal config so the module loads without crashing.
              // The bot simply won't connect to the Telegram API.
              return {
                token: 'DISABLED',
                launchOptions: false, // prevents auto-launch
                middlewares: [],
              } as never;
            }

            TelegramModule.logger.log('Telegram bot initialising…');

            return {
              token,
              middlewares: [session()],
            };
          },
          inject: [ConfigService],
        }),

        // ── Domain modules ─────────────────────────────────────────────────
        UsersModule,
        // CompaniesModule and MessagesModule are imported lazily via forwardRef
        // in their own module files to avoid circular dependencies.
        // Uncomment the lines below once those modules are fully created:
        // CompaniesModule,
        // MessagesModule,
      ],
      providers: [TelegramService, TelegramUpdate],
      exports: [TelegramService],
    };
  }
}
