import { Router } from "express";
import {
  getAdminSettings,
  updateAdminSettings,
} from "../controllers/AdminSettingsController";
import { validate } from "../middleware/validation";
import { updateAdminSettingsSchema } from "../validators/adminValidator";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// Все роуты требуют аутентификации и прав админа
router.use((req, res, next) => {
  authenticate(req, res, next);
});
router.use(authorize("admin", "super_admin"));

/**
 * @swagger
 * /api/admin-settings:
 *   get:
 *     summary: Получить настройки администратора
 *     tags: [Настройки администратора]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Настройки администратора
 *       403:
 *         description: Запрещено
 */
router.get("/", getAdminSettings);

/**
 * @swagger
 * /api/admin-settings:
 *   put:
 *     summary: Обновить настройки администратора
 *     tags: [Настройки администратора]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullscreenMode:
 *                 type: boolean
 *               language:
 *                 type: string
 *                 enum: [ru, en, kk]
 *               theme:
 *                 type: string
 *                 enum: [light, dark, system]
 *               itemsPerPage:
 *                 type: integer
 *                 minimum: 5
 *                 maximum: 100
 *               notificationsEnabled:
 *                 type: boolean
 *               emailNotifications:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Настройки администратора обновлены
 *       403:
 *         description: Запрещено
 */
router.put("/", validate(updateAdminSettingsSchema), updateAdminSettings);

export default router;
