import { Router, Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import mongoose, { ConnectionStates } from "mongoose";

const router = Router();

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Проверка работоспособности сервиса
 *     tags: [Здоровье]
 *     responses:
 *       200:
 *         description: Сервис работает нормально
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     uptime:
 *                       type: number
 *                     message:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                     environment:
 *                       type: string
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *       503:
 *         description: Сервис не работает
 */
router.get(
  "/",
  // eslint-disable-next-line @typescript-eslint/require-await
  asyncHandler(async (_req: Request, res: Response) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    const isDbConnected =
      mongoose.connection.readyState === ConnectionStates.connected;
    const healthCheck = {
      uptime: process.uptime(),
      message: "OK",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      database: {
        status: isDbConnected ? "connected" : "disconnected",
      },
    };

    const statusCode: number = isDbConnected ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      data: healthCheck,
    });
  }),
);

export default router;
