import { Router } from "express";
import {
  getAllCompanies,
  getCompanyById,
  getCompanyByCode,
  getPublicCompanies,
  createCompany,
  updateCompany,
  updateCompanyStatus,
  updateCompanyPlan,
  updateCompanyPassword,
  verifyPaymentAndUpgrade,
  expireTrial,
  deleteCompany,
} from "../controllers/CompanyController";
import { validate } from "../middleware/validation";
import {
  createCompanySchema,
  updateCompanySchema,
  getCompanyByIdSchema,
  getCompanyByCodeSchema,
  updateCompanyStatusSchema,
  updateCompanyPlanSchema,
  updateCompanyPasswordSchema,
} from "../validators/companyValidator";
import { authenticate, authorize, checkCompanyNotBlocked } from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * /api/companies/code/{code}:
 *   get:
 *     summary: Получить компанию по коду (публичный)
 *     tags: [Компании]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *           length: 8
 *         description: Код компании
 *     responses:
 *       200:
 *         description: Детали компании
 *       404:
 *         description: Компания не найдена
 */
router.get("/code/:code", validate(getCompanyByCodeSchema), getCompanyByCode);

/**
 * @swagger
 * /api/companies/public:
 *   get:
 *     summary: Получить список публичных компаний (для sitemap и SEO)
 *     tags: [Компании]
 *     description: Возвращает только публичные поля (code, name, status) активных компаний
 *     responses:
 *       200:
 *         description: Список публичных компаний
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
 *                     properties:
 *                       id:
 *                         type: string
 *                       code:
 *                         type: string
 *                       name:
 *                         type: string
 *                       status:
 *                         type: string
 *                       updatedAt:
 *                         type: string
 *                       createdAt:
 *                         type: string
 */
router.get("/public", getPublicCompanies);

// Остальные роуты требуют аутентификации
router.use((req, res, next) => {
  authenticate(req, res, next);
});

/**
 * @swagger
 * /api/companies:
 *   get:
 *     summary: Получить все компании (только для админов, с пагинацией)
 *     tags: [Компании]
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
 *           default: 20
 *         description: Количество элементов на странице
 *     responses:
 *       200:
 *         description: Список компаний с пагинацией
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
router.get("/", authorize("admin", "super_admin"), getAllCompanies);

/**
 * @swagger
 * /api/companies/{id}:
 *   get:
 *     summary: Получить компанию по ID
 *     tags: [Компании]
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
 *         description: Детали компании
 *       404:
 *         description: Компания не найдена
 */
router.get("/:id", validate(getCompanyByIdSchema), getCompanyById);

/**
 * @swagger
 * /api/companies:
 *   post:
 *     summary: Создать новую компанию (только для админов)
 *     tags: [Компании]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Компания успешно создана
 *       403:
 *         description: Запрещено
 */
router.post(
  "/",
  authorize("admin", "super_admin"),
  validate(createCompanySchema),
  createCompany,
);

/**
 * @swagger
 * /api/companies/{id}:
 *   put:
 *     summary: Обновить компанию
 *     tags: [Компании]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Компания обновлена
 *       404:
 *         description: Компания не найдена
 */
router.put("/:id", checkCompanyNotBlocked, validate(updateCompanySchema), updateCompany);

/**
 * @swagger
 * /api/companies/{id}/status:
 *   put:
 *     summary: Обновить статус компании (только для админов)
 *     tags: [Компании]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Статус компании обновлен
 *       403:
 *         description: Запрещено
 */
router.put(
  "/:id/status",
  authorize("admin", "super_admin"),
  validate(updateCompanyStatusSchema),
  updateCompanyStatus,
);

/**
 * @swagger
 * /api/companies/{id}/plan:
 *   put:
 *     summary: Обновить план компании (только для админов)
 *     tags: [Компании]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               planId:
 *                 type: string
 *     responses:
 *       200:
 *         description: План компании обновлен
 *       403:
 *         description: Запрещено
 */
router.put(
  "/:id/plan",
  authorize("admin", "super_admin"),
  validate(updateCompanyPlanSchema),
  updateCompanyPlan,
);

/**
 * @swagger
 * /api/companies/{id}/verify-payment:
 *   post:
 *     summary: Verify PayPal payment and upgrade company plan
 *     tags: [Компании]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               orderId:
 *                 type: string
 *                 description: PayPal order ID
 *               planId:
 *                 type: string
 *                 description: Subscription plan ID
 *     responses:
 *       200:
 *         description: Plan upgraded successfully
 *       400:
 *         description: Payment not completed or invalid plan
 *       404:
 *         description: Company not found
 */
router.post(
  "/:id/verify-payment",
  authorize("admin", "super_admin", "company"),
  verifyPaymentAndUpgrade,
);

/**
 * @swagger
 * /api/companies/{id}/password:
 *   put:
 *     summary: Сменить пароль компании (только суперадмин, без подтверждения старого)
 *     tags: [Компании]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 description: New company password
 *     responses:
 *       200:
 *         description: Company password updated
 *       403:
 *         description: Access denied (super_admin only)
 */
router.put(
  "/:id/password",
  authorize("super_admin"),
  validate(updateCompanyPasswordSchema),
  updateCompanyPassword,
);

// Принудительное завершение пробного периода (только super_admin)
router.post(
  "/:id/expire-trial",
  authorize("super_admin"),
  expireTrial,
);

/**
 * @swagger
 * /api/companies/{id}:
 *   delete:
 *     summary: Удалить компанию (для админов и администраторов компании)
 *     tags: [Компании]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 description: Password required for company admins
 *     responses:
 *       200:
 *         description: Компания успешно удалена
 *       400:
 *         description: Пароль обязателен для администраторов компании
 *       401:
 *         description: Неверный пароль
 *       403:
 *         description: Запрещено
 *       404:
 *         description: Компания не найдена
 */
router.delete("/:id", authenticate, deleteCompany);

export default router;
