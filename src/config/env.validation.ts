import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  PORT: Joi.number().port().default(3001),

  // Database
  DATABASE_URL: Joi.string().uri().required(),

  // CORS / Frontend
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),

  // JWT
  JWT_SECRET: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().required(),
  }),

  JWT_EXPIRES_IN: Joi.string().default('7d'),

  // Redis (optional)
  REDIS_URL: Joi.string().uri().optional(),

  // Telegram (optional)
  TELEGRAM_BOT_TOKEN: Joi.string().optional(),

  // Sentry (optional)
  SENTRY_DSN: Joi.string().uri().optional(),

  // SMTP (all optional)
  SMTP_HOST: Joi.string().hostname().optional(),
  SMTP_PORT: Joi.number().port().optional(),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),

  // Resend (optional)
  RESEND_API_KEY: Joi.string().optional(),

  // PayPal (all optional)
  PAYPAL_CLIENT_ID: Joi.string().optional(),
  PAYPAL_SECRET: Joi.string().optional(),
  PAYPAL_MODE: Joi.string().valid('sandbox', 'live').optional(),

  // Rate limiting (optional with defaults)
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().positive().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().positive().default(100),
});
