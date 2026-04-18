import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './env.validation';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load .env.<NODE_ENV>.local → .env.<NODE_ENV> → .env.local → .env
      envFilePath: [
        `.env.${process.env.NODE_ENV ?? 'development'}.local`,
        `.env.${process.env.NODE_ENV ?? 'development'}`,
        '.env.local',
        '.env',
      ],
      validationSchema: envValidationSchema,
      validationOptions: {
        // Abort early so the first missing var is surfaced immediately
        abortEarly: false,
        // Strip unknown keys so process.env is not polluted
        allowUnknown: false,
      },
      // Expand variables that reference other variables (e.g. ${BASE_URL})
      expandVariables: true,
    }),
  ],
})
export class AppConfigModule {}
