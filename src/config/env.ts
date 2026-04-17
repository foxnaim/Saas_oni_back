import dotenv from "dotenv";

dotenv.config();

interface EnvConfig {
  nodeEnv: string;
  port: number;
  mongodbUri: string;
  frontendUrl: string; // Используется для CORS и генерации ссылок
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  sentryDsn: string | undefined;
  sentryEnvironment: string;
  logLevel: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  // Email/SMTP настройки
  smtpHost: string | undefined;
  smtpPort: number;
  smtpUser: string | undefined;
  smtpPassword: string | undefined;
  smtpFrom: string | undefined;
  smtpSecure: boolean;
  // Resend API (альтернатива SMTP, работает через HTTP, не блокируется Railway)
  resendApiKey: string | undefined;
  // Redis настройки
  redisHost: string;
  redisPort: number;
  redisPassword: string | undefined;
  redisEnabled: boolean;
}

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value || defaultValue || "";
};

// Проверка критичных переменных окружения в production
const nodeEnv = getEnvVar("NODE_ENV", "development");
if (nodeEnv === "production") {
  const jwtSecret = process.env.JWT_SECRET;
  if (
    !jwtSecret ||
    jwtSecret === "your-secret-key-change-in-production" ||
    jwtSecret.length < 32
  ) {
    throw new Error(
      "❌ КРИТИЧЕСКАЯ ОШИБКА БЕЗОПАСНОСТИ: JWT_SECRET должен быть установлен и содержать минимум 32 символа в production режиме!\n" +
        "Сгенерируйте безопасный секрет: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
    );
  }
}

export const config: EnvConfig = {
  nodeEnv,
  port: parseInt(getEnvVar("PORT", "3001"), 10),
  mongodbUri: getEnvVar(
    "MONGODB_URI",
    "mongodb://localhost:27017/anonymous-chat",
  ),
  frontendUrl: getEnvVar("FRONTEND_URL", "http://localhost:3000"),
  rateLimitWindowMs: parseInt(getEnvVar("RATE_LIMIT_WINDOW_MS", "900000"), 10),
  rateLimitMaxRequests: parseInt(
    getEnvVar("RATE_LIMIT_MAX_REQUESTS", "100"),
    10,
  ),
  sentryDsn: process.env.SENTRY_DSN,
  sentryEnvironment: getEnvVar("SENTRY_ENVIRONMENT", "development"),
  logLevel: getEnvVar("LOG_LEVEL", "info"),
  jwtSecret: getEnvVar("JWT_SECRET", "your-secret-key-change-in-production"),
  jwtExpiresIn: getEnvVar("JWT_EXPIRES_IN", "7d"),
  // Email/SMTP настройки
  smtpHost: process.env.SMTP_HOST,
  smtpPort: parseInt(getEnvVar("SMTP_PORT", "587"), 10),
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
  smtpFrom: process.env.SMTP_FROM,
  smtpSecure: getEnvVar("SMTP_SECURE", "false") === "true",
  // Resend API (альтернатива SMTP, работает через HTTP, не блокируется Railway)
  resendApiKey: process.env.RESEND_API_KEY,
  // Redis настройки
  redisHost: getEnvVar("REDIS_HOST", "localhost"),
  redisPort: parseInt(getEnvVar("REDIS_PORT", "6379"), 10),
  redisPassword: process.env.REDIS_PASSWORD,
  redisEnabled: getEnvVar("REDIS_ENABLED", "false") === "true",
};
