import { Router } from "express";
import {
  getAllMessages,
  getMessageById,
  createMessage,
  updateMessageStatus,
  moderateMessage,
  deleteMessage,
} from "../controllers/MessageController";
import { validate } from "../middleware/validation";
import {
  createMessageSchema,
  updateMessageStatusSchema,
  getMessagesSchema,
  getMessageByIdSchema,
  moderateMessageSchema,
} from "../validators/messageValidator";
import { authenticate, optionalAuthenticate, checkCompanyNotBlocked } from "../middleware/auth";
import { messageCreateLimiter } from "../middleware/rateLimiter";
import { antispamCheck } from "../middleware/antispam";

const router = Router();

/**
 * @swagger
 * /api/messages:
 *   post:
 *     summary: Создать новое анонимное сообщение (публичный)
 *     tags: [Сообщения]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - companyCode
 *               - type
 *               - content
 *             properties:
 *               companyCode:
 *                 type: string
 *                 length: 8
 *               type:
 *                 type: string
 *                 enum: [complaint, praise, suggestion]
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *     responses:
 *       201:
 *         description: Сообщение успешно создано
 *       400:
 *         description: Неверный запрос
 *       404:
 *         description: Компания не найдена
 */
// Создание сообщения - публичный endpoint (анонимные сообщения)
// antispamCheck: burst-защита + fingerprint-лимиты (IP + browser fingerprint)
// messageCreateLimiter: fallback IP-only rate limit (express-rate-limit)
router.post("/", antispamCheck, messageCreateLimiter, validate(createMessageSchema), createMessage);

/**
 * @swagger
 * /api/messages/{id}:
 *   get:
 *     summary: Get message by ID (публичный эндпоинт для пользователей)
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID сообщения
 *     responses:
 *       200:
 *         description: Детали сообщения
 *       404:
 *         description: Сообщение не найдено
 */
// Получение сообщения по ID - публичный endpoint (пользователи могут просматривать свои сообщения)
// Используем опциональную аутентификацию: если токен есть, проверяем его (для компаний), если нет - работаем без токена
router.get(
  "/:id",
  optionalAuthenticate,
  validate(getMessageByIdSchema),
  getMessageById,
);

// Остальные роуты требуют аутентификации и проверки блокировки компании
router.use((req, res, next) => {
  authenticate(req, res, next);
});
router.use((req, res, next) => {
  checkCompanyNotBlocked(req, res, next);
});

/**
 * @swagger
 * /api/messages:
 *   get:
 *     summary: Получить все сообщения (с пагинацией)
 *     tags: [Сообщения]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: companyCode
 *         schema:
 *           type: string
 *           length: 8
 *         description: Код компании для фильтрации сообщений
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
 *         description: Список сообщений с пагинацией
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
 */
router.get("/", validate(getMessagesSchema), getAllMessages);

/**
 * @swagger
 * /api/messages/{id}/status:
 *   put:
 *     summary: Обновить статус сообщения
 *     tags: [Сообщения]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [Новое, В работе, Решено, Отклонено, Спам]
 *               response:
 *                 type: string
 *                 maxLength: 2000
 *     responses:
 *       200:
 *         description: Статус сообщения обновлен
 *       404:
 *         description: Сообщение не найдено
 */
router.put(
  "/:id/status",
  validate(updateMessageStatusSchema),
  updateMessageStatus,
);

/**
 * @swagger
 * /api/messages/{id}/moderate:
 *   post:
 *     summary: Модерировать сообщение (одобрить/отклонить) - только для админов
 *     tags: [Сообщения]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *                 description: Действие для выполнения над сообщением
 *     responses:
 *       200:
 *         description: Сообщение успешно отмодерировано
 *       403:
 *         description: Запрещено (только для админов)
 *       404:
 *         description: Сообщение не найдено
 */
router.post("/:id/moderate", validate(moderateMessageSchema), moderateMessage);

/**
 * @swagger
 * /api/messages/{id}:
 *   delete:
 *     summary: Удалить сообщение - только для админов
 *     tags: [Сообщения]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Message ID
 *     responses:
 *       200:
 *         description: Сообщение успешно удалено
 *       403:
 *         description: Запрещено (только для админов)
 *       404:
 *         description: Сообщение не найдено
 */
router.delete("/:id", validate(getMessageByIdSchema), deleteMessage);

export default router;
