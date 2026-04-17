import { createServer } from "http";
import app from "./app";
import { config } from "./config/env";
import { connectDatabase } from "./config/database";
import { logger } from "./utils/logger";
import { initializeSocket } from "./config/socket";

const startServer = async (): Promise<void> => {
  const startTime = Date.now();
  try {
    logger.info("Starting server...");
    const dbStartTime = Date.now();
    await connectDatabase();
    const dbTime = Date.now() - dbStartTime;
    logger.info(`Database connected in ${dbTime}ms`);

    const httpServer = createServer(app);

    // Инициализируем Socket.IO
    initializeSocket(httpServer);

    httpServer.listen(config.port, () => {
      const totalTime = Date.now() - startTime;
      logger.info(
        `Server running on port ${config.port} in ${config.nodeEnv} mode`,
      );
      logger.info(
        `API Documentation: http://localhost:${config.port}/api-docs`,
      );
      logger.info(`Server started in ${totalTime}ms (DB: ${dbTime}ms)`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (err: Error) => {
  logger.error("Unhandled Rejection:", err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err: Error) => {
  logger.error("Uncaught Exception:", err);
  process.exit(1);
});

void startServer();
