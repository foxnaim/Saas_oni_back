import { Server as HttpServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { config } from "./env";
import { logger } from "../utils/logger";
import type { IMessage } from "../models/Message";

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: "admin" | "super_admin" | "company";
  companyId?: string;
  companyCode?: string;
  authToken?: string;
  tokenCheckInterval?: ReturnType<typeof setInterval>;
}

interface SocketHandshakeAuth {
  token?: string;
}

interface SocketHandshakeHeaders {
  authorization?: string;
}

export let io: SocketIOServer | null = null;

export const initializeSocket = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.frontendUrl,
      credentials: true,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // Middleware для аутентификации
  io.use((socket: AuthenticatedSocket, next) => {
    void (async (): Promise<void> => {
      const auth = socket.handshake.auth as SocketHandshakeAuth | undefined;
      const headers = socket.handshake.headers as
        | SocketHandshakeHeaders
        | undefined;
      const token =
        auth?.token || headers?.authorization?.replace("Bearer ", "") || "";

      if (!token) {
        // Разрешаем подключение без токена (для публичных событий)
        // Но пользователь не будет иметь доступа к защищенным комнатам
        logger.info(`Socket connecting without token: ${socket.id}`);
        next();
        return;
      }

      try {
        const { verifyToken } = await import("../utils/jwt");
        const decoded = verifyToken(token);

        socket.userId = decoded.userId;
        socket.userRole = decoded.role as "admin" | "super_admin" | "company";
        socket.companyId = decoded.companyId;
        socket.authToken = token;

        // Если пользователь - компания, получаем код компании из БД
        if (decoded.role === "company" && decoded.companyId) {
          const CompanyModel = (await import("../models/Company")).Company;
          const company = await CompanyModel.findById(decoded.companyId);
          if (company) {
            socket.companyCode = company.code;
            logger.info(
              `Socket authenticated as company: ${company.code} (userId: ${decoded.userId}, socketId: ${socket.id})`,
            );
          } else {
            logger.warn(
              `Company not found for companyId: ${decoded.companyId} (socketId: ${socket.id})`,
            );
          }
        } else {
          logger.info(
            `Socket authenticated: role=${decoded.role}, userId=${decoded.userId}, socketId=${socket.id}`,
          );
        }

        next();
      } catch (error) {
        // Логируем только некритичные ошибки (expired/invalid токены - норма для публичных подключений)
        if (error instanceof Error && error.name !== "TokenError") {
          logger.warn("Socket authentication error:", error);
        } else {
          logger.info(
            `Socket authentication failed (invalid/expired token): ${socket.id}`,
          );
        }
        // Разрешаем подключение, но без аутентификации
        next();
      }
    })();
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    logger.info(`Socket connected: ${socket.id}`, {
      userId: socket.userId,
      role: socket.userRole,
      companyCode: socket.companyCode,
      hasToken:
        !!socket.handshake.auth?.token ||
        !!socket.handshake.headers?.authorization,
    });

    // Подключаем пользователя к соответствующим комнатам
    if (socket.userRole === "admin" || socket.userRole === "super_admin") {
      // Админы подключаются к комнате всех сообщений
      void (async (): Promise<void> => {
        try {
          await socket.join("admin:messages");
          logger.info(`Admin ${socket.userId} joined admin:messages room`);
        } catch (error: unknown) {
          logger.error("Failed to join admin:messages room:", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })();
    } else if (socket.userRole === "company" && socket.companyCode) {
      // Компании подключаются к комнате своих сообщений
      // Нормализуем companyCode в верхний регистр для совместимости
      void (async (): Promise<void> => {
        try {
          const companyCode = socket.companyCode;
          if (!companyCode) {
            logger.warn(`Company socket ${socket.id} has no companyCode`);
            return;
          }

          const normalizedCode = companyCode.toUpperCase();
          await socket.join(`company:${normalizedCode}`);
          logger.info(
            `Company ${companyCode} (socket ${socket.id}) joined company:${normalizedCode} room`,
          );
        } catch (error: unknown) {
          logger.error(`Failed to join company:${socket.companyCode} room:`, {
            error: error instanceof Error ? error.message : String(error),
            socketId: socket.id,
          });
        }
      })();
    } else {
      logger.warn(
        `Socket ${socket.id} connected without valid role or companyCode`,
        {
          role: socket.userRole,
          companyCode: socket.companyCode,
          userId: socket.userId,
        },
      );
    }

    // Обработчик для динамического подключения к комнатам
    socket.on("join", (room: string) => {
      if (!room) return;

      // Нормализуем код комнаты (верхний регистр для companyCode)
      const normalizedRoom = room.toUpperCase().trim();

      // Если это код компании (8 символов), подключаем к комнате компании
      if (normalizedRoom.length === 8) {
        const roomCompanyCode = normalizedRoom;
        let joined = false;

        // Если пользователь - компания, проверяем, что это его комната
        if (socket.userRole === "company" && socket.companyCode) {
          if (socket.companyCode.toUpperCase() === roomCompanyCode) {
            void socket.join(`company:${roomCompanyCode}`);
            logger.info(
              `Company ${socket.companyCode} joined room company:${roomCompanyCode}`,
            );
            joined = true;
            // Отправляем подтверждение подключения к комнате
            socket.emit("room:joined", { room: `company:${roomCompanyCode}` });
          } else {
            logger.warn(
              `Company ${socket.companyCode} tried to join wrong room: ${roomCompanyCode}`,
            );
          }
        } else if (
          socket.userRole === "admin" ||
          socket.userRole === "super_admin"
        ) {
          // Админы могут подключаться к любым комнатам компаний
          void socket.join(`company:${roomCompanyCode}`);
          logger.info(
            `Admin ${socket.userId} joined room company:${roomCompanyCode}`,
          );
          joined = true;
          // Отправляем подтверждение подключения к комнате
          socket.emit("room:joined", { room: `company:${roomCompanyCode}` });
        }

        if (!joined) {
          logger.warn(
            `Failed to join room company:${roomCompanyCode} - insufficient permissions`,
          );
          socket.emit("room:join:error", {
            room: `company:${roomCompanyCode}`,
            error: "Insufficient permissions",
          });
        }
      } else if (normalizedRoom === "ADMIN:MESSAGES") {
        // Админы могут подключаться к комнате админов
        if (socket.userRole === "admin" || socket.userRole === "super_admin") {
          void socket.join("admin:messages");
          logger.info(`Admin ${socket.userId} joined admin:messages room`);
          socket.emit("room:joined", { room: "admin:messages" });
        }
      }
    });

    socket.on("leave", (room: string) => {
      if (room) {
        void socket.leave(room);
        logger.info(`Socket ${socket.id} left room ${room}`);
      }
    });

    // Периодическая проверка токена каждые 5 минут
    if (socket.authToken) {
      socket.tokenCheckInterval = setInterval(
        () => {
          void (async (): Promise<void> => {
            if (!socket.authToken) {
              return;
            }
            try {
              const { verifyToken } = await import("../utils/jwt");
              verifyToken(socket.authToken);
            } catch {
              logger.info(
                `Token expired for socket ${socket.id}, disconnecting...`,
              );
              socket.emit("auth:expired", { message: "Token expired" });
              socket.disconnect(true);
            }
          })();
        },
        5 * 60 * 1000,
      ); // Проверка каждые 5 минут
    }

    socket.on("disconnect", () => {
      // Очищаем интервал проверки токена
      if (socket.tokenCheckInterval) {
        clearInterval(socket.tokenCheckInterval);
      }
      logger.info(`Socket disconnected: ${socket.id}`);
    });

    socket.on("error", (error: Error) => {
      logger.error("Socket error:", error);
    });
  });

  logger.info("Socket.IO server initialized");
  return io;
};

/**
 * Отправить событие о новом сообщении
 */
export const emitNewMessage = (message: IMessage): void => {
  if (!io) {
    logger.warn("Cannot emit message:new - Socket.IO server not initialized");
    return;
  }

  // Отправляем всем админам
  const adminRoom = io.sockets.adapter.rooms.get("admin:messages");
  const adminCount = adminRoom ? adminRoom.size : 0;
  io.to("admin:messages").emit("message:new", message);

  // Отправляем компании, которой принадлежит сообщение
  // Нормализуем companyCode в верхний регистр для совместимости
  if (message.companyCode) {
    const normalizedCode = message.companyCode.toUpperCase();
    const companyRoom = io.sockets.adapter.rooms.get(
      `company:${normalizedCode}`,
    );
    const companyCount = companyRoom ? companyRoom.size : 0;

    io.to(`company:${normalizedCode}`).emit("message:new", message);
    logger.info(
      `Emitted message:new event for message ${message.id} to company:${normalizedCode} (${companyCount} sockets in room)`,
    );

    if (companyCount === 0) {
      logger.warn(
        `No sockets in room company:${normalizedCode} - message may not be delivered`,
      );
    }
  }

  logger.info(
    `Emitted message:new event for message ${message.id} (admin room: ${adminCount} sockets)`,
  );
};

/**
 * Отправить событие об обновлении сообщения
 */
export const emitMessageUpdate = (message: IMessage): void => {
  if (!io) return;

  // Отправляем всем админам
  io.to("admin:messages").emit("message:updated", message);

  // Отправляем компании, которой принадлежит сообщение
  if (message.companyCode) {
    io.to(`company:${message.companyCode}`).emit("message:updated", message);
  }

  logger.info(`Emitted message:updated event for message ${message.id}`);
};

/**
 * Отправить событие об удалении сообщения
 */
export const emitMessageDelete = (
  messageId: string,
  companyCode: string,
): void => {
  if (!io) return;

  // Отправляем всем админам
  io.to("admin:messages").emit("message:deleted", {
    id: messageId,
    companyCode,
  });

  // Отправляем компании
  if (companyCode) {
    io.to(`company:${companyCode}`).emit("message:deleted", {
      id: messageId,
      companyCode,
    });
  }

  logger.info(`Emitted message:deleted event for message ${messageId}`);
};
