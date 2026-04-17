import { Router } from "express";
import {
  getAdmins,
  createAdmin,
  updateAdmin,
  deleteAdmin,
} from "../controllers/AdminController";
import { validate } from "../middleware/validation";
import {
  createAdminSchema,
  updateAdminSchema,
} from "../validators/adminValidator";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

// Все роуты требуют аутентификации и прав суперадмина
router.use((req, res, next) => {
  authenticate(req, res, next);
});
router.use(authorize("super_admin"));

/**
 * @swagger
 * /api/admins:
 *   get:
 *     summary: Получить всех админов (только для суперадминов, с пагинацией)
 *     tags: [Администраторы]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Номер страницы для пагинации
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Количество элементов на странице
 *     responses:
 *       200:
 *         description: Список администраторов с пагинацией
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       403:
 *         description: Запрещено
 */
router.get("/", getAdmins);

/**
 * @swagger
 * /api/admins:
 *   post:
 *     summary: Создать нового администратора (только для суперадминов)
 *     tags: [Администраторы]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, super_admin]
 *     responses:
 *       201:
 *         description: Администратор успешно создан
 *       403:
 *         description: Запрещено
 */
router.post("/", validate(createAdminSchema), createAdmin);

/**
 * @swagger
 * /api/admins/{id}:
 *   put:
 *     summary: Обновить администратора (только для суперадминов)
 *     tags: [Администраторы]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID администратора
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [admin, super_admin]
 *     responses:
 *       200:
 *         description: Администратор обновлен
 *       403:
 *         description: Запрещено
 *       404:
 *         description: Администратор не найден
 */
router.put("/:id", validate(updateAdminSchema), updateAdmin);

/**
 * @swagger
 * /api/admins/{id}:
 *   delete:
 *     summary: Удалить администратора (только для суперадминов)
 *     tags: [Администраторы]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin ID
 *     responses:
 *       200:
 *         description: Администратор успешно удален
 *       403:
 *         description: Запрещено (нельзя удалить суперадмина или себя)
 *       404:
 *         description: Администратор не найден
 */
router.delete("/:id", deleteAdmin);

export default router;
