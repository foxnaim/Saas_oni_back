import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { CacheModule } from '@nestjs/cache-manager';

import { PrismaModule } from './prisma/prisma.module';
import { LoggerMiddleware } from './middleware/logger.middleware';
import { FingerprintMiddleware } from './middleware/fingerprint.middleware';
import { AntispamMiddleware } from './middleware/antispam.middleware';

// --- Feature modules (created separately) ---
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CompaniesModule } from './companies/companies.module';
import { MessagesModule } from './messages/messages.module';
import { PlansModule } from './plans/plans.module';
import { StatsModule } from './stats/stats.module';
import { AdminModule } from './admin/admin.module';
import { AdminSettingsModule } from './admin-settings/admin-settings.module';
import { SupportModule } from './support/support.module';
import { TelegramModule } from './telegram/telegram.module';
import { WebsocketModule } from './websocket/websocket.module';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // --- Configuration (global, available everywhere) ---
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // --- Database connection (Prisma / PostgreSQL) ---
    PrismaModule,

    // --- Rate limiting (ttl in ms, 100 requests per 60 seconds) ---
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // --- Task scheduling ---
    ScheduleModule.forRoot(),

    // --- In-memory cache (global, available everywhere) ---
    CacheModule.register({ isGlobal: true }),

    // --- Feature modules (each module will be created separately) ---
    AuthModule,           // Authentication & JWT strategy
    UsersModule,          // User management
    CompaniesModule,      // Company/organization management
    MessagesModule,       // Anonymous message handling
    PlansModule,          // Subscription plans
    StatsModule,          // Analytics & statistics
    AdminModule,          // Admin panel functionality
    AdminSettingsModule,  // Admin-level settings
    SupportModule,        // Support ticket system
    TelegramModule.forRoot(), // Telegram bot integration (no-op when token absent)
    WebsocketModule,      // Real-time WebSocket gateway
    EmailModule,          // Email sending service
    HealthModule,         // Health check endpoint
  ],
  providers: [
    // --- Apply ThrottlerGuard globally across all routes ---
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(LoggerMiddleware)
      .forRoutes('*');
    consumer
      .apply(FingerprintMiddleware)
      .forRoutes('messages');
    consumer
      .apply(AntispamMiddleware)
      .forRoutes({ path: 'messages', method: RequestMethod.POST });
  }
}
