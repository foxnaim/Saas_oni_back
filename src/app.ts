import express, { Application, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import swaggerUi from "swagger-ui-express";
import { config } from "./config/env";
import { swaggerSpec } from "./config/swagger";
import { morganMiddleware } from "./middleware/morgan";
import { apiLimiter } from "./middleware/rateLimiter";
import { cacheHeaders } from "./middleware/cacheHeaders";
import { errorHandler } from "./middleware/errorHandler";
import { initializeSentry, setupSentryErrorHandler } from "./config/sentry";
import routes from "./routes";

const app: Application = express();

// Trust proxy - необходимо для Railway и других прокси-серверов
// Устанавливаем trust proxy: 1 для одного прокси (Railway использует один прокси)
// Это позволяет Express правильно обрабатывать X-Forwarded-For и другие заголовки
app.set("trust proxy", 1);

// Initialize Sentry if DSN is provided
initializeSentry(app);

// Compression middleware (должен быть одним из первых для максимальной эффективности)
// Используем максимальный уровень сжатия для лучшей производительности
// compression types conflict with express types due to nested dependencies
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const compressionConfig: any = {
  level: 9, // Максимальное сжатие (было 6) - лучше для production
  threshold: 1024, // Сжимать только файлы больше 1KB
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: (req: any, res: any): boolean => {
    // Не сжимаем если клиент не поддерживает или уже сжато
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (req.headers["x-no-compression"]) {
      return false;
    }
    // Сжимаем только текстовые типы контента
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const contentType = res.getHeader("content-type") || "";
    return /text|json|javascript|css|xml|html|svg/i.test(String(contentType));
  },
};
// Workaround for compression types conflict with express types
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
const compressionMiddleware = compression(compressionConfig);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
app.use(compressionMiddleware as any);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Управляется через next.config.mjs
  }),
);

app.use(
  cors({
    origin: config.frontendUrl,
    credentials: true,
  }),
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging
app.use(morganMiddleware);

// Cache headers (до rate limiting для оптимизации)
app.use(cacheHeaders);

// Rate limiting
app.use("/api", apiLimiter);

// Swagger documentation (ленивая инициализация)
app.use("/api-docs", swaggerUi.serve as unknown as express.RequestHandler[]);
app.use(
  "/api-docs",
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Anonymous Chat API",
  }) as unknown as express.RequestHandler,
);

// Routes
app.use("/api", routes);

// Root endpoint
app.get("/", (_req: Request, res: Response): void => {
  res.json({
    success: true,
    message: "Anonymous Chat API",
    version: "1.0.0",
    documentation: "/api-docs",
  });
});

// 404 handler
app.use((_req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({
    success: false,
    error: {
      message: "Route not found",
      code: "NOT_FOUND",
    },
  });
});

// Sentry error handler (must be before errorHandler)
setupSentryErrorHandler(app);

// Error handler (must be last)
app.use(errorHandler);

export default app;
