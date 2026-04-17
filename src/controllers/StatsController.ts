import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError, ErrorCode } from "../utils/AppError";
import { Company } from "../models/Company";
import {
  getCompanyStats,
  getMessageDistribution,
  getGrowthMetrics,
} from "../services/statsService";
import {
  getCompanyAchievements,
  getGroupedAchievements,
} from "../services/achievementsService";
import { getPlanPermissions } from "../utils/planPermissions";

export const getCompanyStatsController = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const company = await Company.findById(id);
    if (!company) {
      throw new AppError("Company not found", 404, ErrorCode.NOT_FOUND);
    }

    // Проверка доступа
    if (
      req.user?.role === "company" &&
      req.user.companyId?.toString() !== company._id.toString()
    ) {
      throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
    }

    // Проверка прав плана для компаний
    if (req.user?.role === "company") {
      const permissions = await getPlanPermissions(company);
      if (!permissions.canViewBasicAnalytics) {
        throw new AppError(
          "Basic analytics is not available in your plan. Please upgrade to Standard or Pro plan.",
          403,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    const stats = await getCompanyStats(id);

    res.json({
      success: true,
      data: stats,
    });
  },
);

export const getMessageDistributionController = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const company = await Company.findById(id);
    if (!company) {
      throw new AppError("Company not found", 404, ErrorCode.NOT_FOUND);
    }

    // Проверка доступа
    if (
      req.user?.role === "company" &&
      req.user.companyId?.toString() !== company._id.toString()
    ) {
      throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
    }

    // Проверка прав плана для компаний
    if (req.user?.role === "company") {
      const permissions = await getPlanPermissions(company);
      if (!permissions.canViewBasicAnalytics) {
        throw new AppError(
          "Basic analytics is not available in your plan. Please upgrade to Standard or Pro plan.",
          403,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    const distribution = await getMessageDistribution(id);

    res.json({
      success: true,
      data: distribution,
    });
  },
);

export const getGrowthMetricsController = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const company = await Company.findById(id);
    if (!company) {
      throw new AppError("Company not found", 404, ErrorCode.NOT_FOUND);
    }

    // Проверка доступа
    if (
      req.user?.role === "company" &&
      req.user.companyId?.toString() !== company._id.toString()
    ) {
      throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
    }

    // Проверка прав плана для компаний
    if (req.user?.role === "company") {
      const permissions = await getPlanPermissions(company);
      if (!permissions.canViewGrowth) {
        throw new AppError(
          "Growth rating is not available in your plan. Please upgrade to Standard or Pro plan.",
          403,
          ErrorCode.FORBIDDEN,
        );
      }
    }

    const metrics = await getGrowthMetrics(id);

    res.json({
      success: true,
      data: metrics,
    });
  },
);

export const getAchievementsController = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const company = await Company.findById(id);
    if (!company) {
      throw new AppError("Company not found", 404, ErrorCode.NOT_FOUND);
    }

    // Проверка доступа
    if (
      req.user?.role === "company" &&
      req.user.companyId?.toString() !== company._id.toString()
    ) {
      throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
    }

    const achievements = await getCompanyAchievements(id);

    res.json({
      success: true,
      data: achievements,
    });
  },
);

export const getGroupedAchievementsController = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const company = await Company.findById(id);
    if (!company) {
      throw new AppError("Company not found", 404, ErrorCode.NOT_FOUND);
    }

    // Проверка доступа
    if (
      req.user?.role === "company" &&
      req.user.companyId?.toString() !== company._id.toString()
    ) {
      throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
    }

    const groupedAchievements = await getGroupedAchievements(id);

    res.json({
      success: true,
      data: groupedAchievements,
    });
  },
);

export const getPlatformStatsController = asyncHandler(
  async (req: Request, res: Response) => {
    // Только админы могут видеть статистику платформы
    if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
      throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
    }

    // Подсчитываем статистику платформы
    const totalCompanies = await Company.countDocuments();

    // Упрощенная версия - можно улучшить с реальными метриками
    const stats = {
      rooms: totalCompanies,
      latency: "54ms",
      retention: "92%",
    };

    res.json({
      success: true,
      data: stats,
    });
  },
);
