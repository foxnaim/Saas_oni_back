import winston from "winston";
import { config } from "../config/env";

const { combine, timestamp, errors, json, colorize, printf } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${String(timestamp)} [${String(level)}]: ${String(stack || message)}`;
});

export const logger = winston.createLogger({
  level: config.logLevel,
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    json(),
  ),
  defaultMeta: { service: "anonymous-chat-backend" },
  transports: [
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

if (config.nodeEnv !== "production") {
  logger.add(
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
  );
} else {
  logger.add(
    new winston.transports.Console({
      format: combine(json()),
    }),
  );
}
