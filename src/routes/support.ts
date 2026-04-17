import { Router } from "express";
import { getSupportInfo } from "../controllers/SupportController";

const router = Router();

/**
 * @swagger
 * /api/support:
 *   get:
 *     summary: Получить публичную информацию о поддержке
 *     tags: [Поддержка]
 *     description: Возвращает глобальный номер WhatsApp для поддержки (публичный endpoint)
 *     responses:
 *       200:
 *         description: Информация о поддержке
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
 *                     supportWhatsAppNumber:
 *                       type: string
 *                       nullable: true
 */
router.get("/", getSupportInfo);

export default router;
