import { Router } from "express";
import {
  login,
  register,
  verifyPassword,
  verifyEmail,
  getMe,
  forgotPassword,
  resetPassword,
  changeEmail,
  changePassword,
  oauthSync,
  promoteToSuperAdmin,
} from "../controllers/AuthController";
import { validate } from "../middleware/validation";
import {
  loginSchema,
  registerSchema,
  verifyPasswordSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changeEmailSchema,
  changePasswordSchema,
} from "../validators/authValidator";
import { authenticate } from "../middleware/auth";
import { authLimiter, passwordResetLimiter } from "../middleware/rateLimiter";

const router = Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход пользователя
 *     tags: [Аутентификация]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Успешный вход
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
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *                         companyId:
 *                           type: string
 *                         name:
 *                           type: string
 *                     token:
 *                       type: string
 *       401:
 *         description: Invalid credentials
 */
router.post("/login", authLimiter, validate(loginSchema), login);

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Регистрация пользователя
 *     tags: [Аутентификация]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               name:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [user, company, admin]
 *               companyName:
 *                 type: string
 *               companyCode:
 *                 type: string
 *     responses:
 *       201:
 *         description: Успешная регистрация
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
 *                     user:
 *                       type: object
 *                     token:
 *                       type: string
 *       400:
 *         description: Bad request
 */
router.post("/register", authLimiter, validate(registerSchema), register);

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Подтверждение email
 *     tags: [Аутентификация]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email успешно подтвержден
 *       400:
 *         description: Неверный токен
 */
router.post("/verify-email", validate(verifyEmailSchema), verifyEmail);

/**
 * @swagger
 * /api/auth/verify-password:
 *   post:
 *     summary: Проверка пароля по коду компании
 *     tags: [Аутентификация]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - password
 *             properties:
 *               code:
 *                 type: string
 *                 length: 8
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Пароль подтвержден
 *       401:
 *         description: Неверные учетные данные
 */
router.post("/verify-password", validate(verifyPasswordSchema), verifyPassword);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Запрос сброса пароля
 *     tags: [Аутентификация]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Письмо для сброса пароля отправлено
 *       404:
 *         description: Пользователь не найден
 */
router.post(
  "/forgot-password",
  passwordResetLimiter,
  validate(forgotPasswordSchema),
  forgotPassword,
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Сброс пароля по токену
 *     tags: [Аутентификация]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Пароль успешно сброшен
 *       400:
 *         description: Неверный или истекший токен
 */
router.post("/reset-password", validate(resetPasswordSchema), resetPassword);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Получить информацию о текущем пользователе
 *     tags: [Аутентификация]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information
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
 *                     user:
 *                       type: object
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/me",
  (req, res, next) => {
    authenticate(req, res, next);
  },
  getMe,
);

/**
 * @swagger
 * /api/auth/change-email:
 *   post:
 *     summary: Изменить email пользователя
 *     tags: [Аутентификация]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newEmail
 *               - password
 *             properties:
 *               newEmail:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email успешно изменен
 *       401:
 *         description: Неверный пароль или не авторизован
 *       400:
 *         description: Неверный запрос (email уже используется, неверный формат и т.д.)
 */
router.post(
  "/change-email",
  (req, res, next) => {
    authenticate(req, res, next);
  },
  validate(changeEmailSchema),
  changeEmail,
);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Изменить пароль пользователя
 *     tags: [Аутентификация]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Пароль успешно изменен
 *       401:
 *         description: Неверный текущий пароль или не авторизован
 *       400:
 *         description: Неверный запрос (новый пароль совпадает с текущим, слишком короткий и т.д.)
 */
router.post(
  "/change-password",
  (req, res, next) => {
    authenticate(req, res, next);
  },
  validate(changePasswordSchema),
  changePassword,
);

/**
 * @swagger
 * /api/auth/oauth-sync:
 *   post:
 *     summary: Синхронизация OAuth пользователя (создание/обновление в БД)
 *     tags: [Аутентификация]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               provider:
 *                 type: string
 *     responses:
 *       200:
 *         description: Пользователь синхронизирован
 */
router.post("/oauth-sync", oauthSync);

/**
 * Временный эндпоинт для обновления роли текущего пользователя на super_admin
 * ТОЛЬКО ДЛЯ РАЗРАБОТКИ! Отключен в production.
 */
if (process.env.NODE_ENV === "development") {
  router.post(
    "/promote-super-admin",
    (req, res, next) => {
      authenticate(req, res, next);
    },
    promoteToSuperAdmin,
  );
}

export default router;
