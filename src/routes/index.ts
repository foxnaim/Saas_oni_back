import { Router } from "express";
import v1Routes from "./v1";

const router = Router();

// API версионирование
// Все маршруты теперь доступны через /api/v1/...
router.use("/v1", v1Routes);

// Обратная совместимость: старые маршруты без версии перенаправляются на v1
// Это можно удалить после миграции всех клиентов на v1
router.use("/", v1Routes);

export default router;
