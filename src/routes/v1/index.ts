import { Router } from "express";
import healthRoutes from "../health";
import authRoutes from "../auth";
import messageRoutes from "../messages";
import companyRoutes from "../companies";
import statsRoutes from "../stats";
import planRoutes from "../plans";
import adminRoutes from "../admins";
import adminSettingsRoutes from "../adminSettings";
import supportRoutes from "../support";

const router = Router();

// V1 API routes
router.use("/health", healthRoutes);
router.use("/auth", authRoutes);
router.use("/messages", messageRoutes);
router.use("/companies", companyRoutes);
router.use("/stats", statsRoutes);
router.use("/plans", planRoutes);
router.use("/admins", adminRoutes);
router.use("/admin-settings", adminSettingsRoutes);
router.use("/support", supportRoutes);

export default router;
