/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Application } from "express";
import { config } from "./env";
import { logger } from "../utils/logger";

export const initializeSentry = (app: Application): void => {
  if (!config.sentryDsn) {
    return;
  }

  try {
    const Sentry = require("@sentry/node");
    const Tracing = require("@sentry/tracing");

    Sentry.init({
      dsn: config.sentryDsn,
      environment: config.sentryEnvironment,
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Tracing.Integrations.Express({ app }),
      ],
      tracesSampleRate: config.nodeEnv === "production" ? 0.1 : 1.0,
    });

    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());

    logger.info("Sentry initialized successfully");
  } catch (error) {
    logger.warn("Sentry initialization failed:", error);
  }
};

export const setupSentryErrorHandler = (app: Application): void => {
  if (!config.sentryDsn) {
    return;
  }

  try {
    const Sentry = require("@sentry/node");
    app.use(Sentry.Handlers.errorHandler());
  } catch (error) {
    logger.warn("Sentry error handler setup failed:", error);
  }
};
