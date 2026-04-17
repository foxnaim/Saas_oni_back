import { z } from "zod";

export const getCompanyStatsSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Company ID is required"),
  }),
});

export const getMessageDistributionSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Company ID is required"),
  }),
});

export const getGrowthMetricsSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Company ID is required"),
  }),
});

export const getAchievementsSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Company ID is required"),
  }),
});
