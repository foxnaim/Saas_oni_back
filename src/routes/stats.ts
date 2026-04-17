import { Router } from "express";
import {
  getCompanyStatsController,
  getMessageDistributionController,
  getGrowthMetricsController,
  getAchievementsController,
  getGroupedAchievementsController,
  getPlatformStatsController,
} from "../controllers/StatsController";
import { validate } from "../middleware/validation";
import {
  getCompanyStatsSchema,
  getMessageDistributionSchema,
  getGrowthMetricsSchema,
  getAchievementsSchema,
} from "../validators/statsValidator";
import { authenticate, checkCompanyNotBlocked } from "../middleware/auth";

const router = Router();

// Все роуты требуют аутентификации и проверки блокировки компании
router.use((req, res, next) => {
  authenticate(req, res, next);
});
router.use((req, res, next) => {
  checkCompanyNotBlocked(req, res, next);
});

/**
 * @swagger
 * /api/stats/company/{id}:
 *   get:
 *     summary: Получить статистику компании
 *     tags: [Статистика]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID компании
 *     responses:
 *       200:
 *         description: Статистика компании
 */
router.get(
  "/company/:id",
  validate(getCompanyStatsSchema),
  getCompanyStatsController,
);

/**
 * @swagger
 * /api/stats/distribution/{id}:
 *   get:
 *     summary: Получить распределение сообщений для компании
 *     tags: [Статистика]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     responses:
 *       200:
 *         description: Данные распределения сообщений
 */
router.get(
  "/distribution/:id",
  validate(getMessageDistributionSchema),
  getMessageDistributionController,
);

/**
 * @swagger
 * /api/stats/growth/{id}:
 *   get:
 *     summary: Получить метрики роста для компании
 *     tags: [Статистика]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     responses:
 *       200:
 *         description: Метрики роста
 */
router.get(
  "/growth/:id",
  validate(getGrowthMetricsSchema),
  getGrowthMetricsController,
);

/**
 * @swagger
 * /api/stats/achievements/{id}:
 *   get:
 *     summary: Получить достижения компании
 *     tags: [Статистика]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     responses:
 *       200:
 *         description: Данные достижений
 */
router.get(
  "/achievements/:id",
  validate(getAchievementsSchema),
  getAchievementsController,
);

/**
 * @swagger
 * /api/stats/achievements/{id}/grouped:
 *   get:
 *     summary: Получить сгруппированные достижения компании
 *     tags: [Статистика]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     responses:
 *       200:
 *         description: Данные сгруппированных достижений
 */
router.get(
  "/achievements/:id/grouped",
  validate(getAchievementsSchema),
  getGroupedAchievementsController,
);

/**
 * @swagger
 * /api/stats/platform:
 *   get:
 *     summary: Получить статистику платформы
 *     tags: [Статистика]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Статистика платформы
 */
router.get("/platform", getPlatformStatsController);

export default router;
