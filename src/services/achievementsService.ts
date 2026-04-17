import { Message } from "../models/Message";
import { Company } from "../models/Company";
import { IMessage } from "../models/Message";
import { ICompany } from "../models/Company";

// Типы для достижений (адаптированы из фронтенда)
export type AchievementCategory =
  | "reviews"
  | "resolved"
  | "response_speed"
  | "activity"
  | "quality"
  | "longevity";

export interface Achievement {
  id: string;
  category: AchievementCategory;
  titleKey: string;
  descriptionKey?: string;
  target: number;
  icon?: string;
  order: number;
  level: number;
}

export interface AchievementProgress {
  achievement: Achievement;
  current: number;
  progress: number;
  completed: boolean;
  completedAt?: string;
}

// Определение уровней для каждой категории
const REVIEWS_LEVELS = [
  { level: 1, target: 10 },
  { level: 2, target: 25 },
  { level: 3, target: 50 },
  { level: 4, target: 100 },
  { level: 5, target: 250 },
  { level: 6, target: 500 },
  { level: 7, target: 1000 },
  { level: 8, target: 2500 },
  { level: 9, target: 5000 },
  { level: 10, target: 10000 },
];

const RESOLVED_LEVELS = [
  { level: 1, target: 10 },
  { level: 2, target: 25 },
  { level: 3, target: 50 },
  { level: 4, target: 100 },
  { level: 5, target: 250 },
  { level: 6, target: 500 },
  { level: 7, target: 1000 },
  { level: 8, target: 2500 },
  { level: 9, target: 5000 },
  { level: 10, target: 10000 },
];

const RESPONSE_SPEED_LEVELS = [
  { level: 1, target: 10 },
  { level: 2, target: 25 },
  { level: 3, target: 50 },
  { level: 4, target: 100 },
  { level: 5, target: 250 },
  { level: 6, target: 500 },
];

const ACTIVITY_LEVELS = [
  { level: 1, target: 1 },
  { level: 2, target: 1 },
  { level: 3, target: 1 },
  { level: 4, target: 3 },
];

const QUALITY_LEVELS = [
  { level: 1, target: 20 },
  { level: 2, target: 50 },
  { level: 3, target: 100 },
  { level: 4, target: 50 },
  { level: 5, target: 70 },
  { level: 6, target: 80 },
  { level: 7, target: 90 },
];

const LONGEVITY_LEVELS = [
  { level: 1, target: 3 },
  { level: 2, target: 6 },
  { level: 3, target: 12 },
  { level: 4, target: 24 },
  { level: 5, target: 36 },
];

function createAchievementsFromLevels(
  category: AchievementCategory,
  levels: Array<{ level: number; target: number }>,
  baseOrder: number,
): Achievement[] {
  return levels.map((level, index) => ({
    id: `${category}_level_${level.level}`,
    category,
    titleKey: `company.achievement.${category}.level`,
    descriptionKey: `company.achievement.${category}.description`,
    target: level.target,
    order: baseOrder + index,
    level: level.level,
  }));
}

export const ACHIEVEMENTS: Achievement[] = [
  ...createAchievementsFromLevels("reviews", REVIEWS_LEVELS, 1),
  ...createAchievementsFromLevels("resolved", RESOLVED_LEVELS, 100),
  ...createAchievementsFromLevels("response_speed", RESPONSE_SPEED_LEVELS, 200),
  ...createAchievementsFromLevels("activity", ACTIVITY_LEVELS, 300),
  ...createAchievementsFromLevels("quality", QUALITY_LEVELS, 400),
  ...createAchievementsFromLevels("longevity", LONGEVITY_LEVELS, 500),
];

interface CompanyAchievementData {
  totalMessages: number;
  resolvedMessages: number;
  messages: IMessage[];
  company: ICompany;
  responseSpeedStats: {
    fast: number;
    medium: number;
    normal: number;
  };
  activityStats: {
    messagesThisMonth: number;
    messagesLastMonth: number;
    messagesTwoMonthsAgo: number;
    complaintsThisMonth: number;
    complaintsLastMonth: number;
  };
  qualityStats: {
    resolutionRate: number;
    praisesCount: number;
    positiveRatio: number;
  };
  longevityMonths: number;
}

function calculateCompanyStats(
  messages: IMessage[],
  company: ICompany,
): CompanyAchievementData {
  const now = new Date();
  const totalMessages = messages.length;
  const resolvedMessages = messages.filter((m) => m.status === "Решено").length;

  // Расчет скорости ответа
  let fast = 0;
  let medium = 0;
  let normal = 0;

  messages.forEach((msg) => {
    if (msg.companyResponse && msg.updatedAt) {
      const created = new Date(msg.createdAt);
      const updated = new Date(msg.updatedAt);
      const daysDiff = Math.floor(
        (updated.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysDiff <= 1) fast++;
      else if (daysDiff <= 3) medium++;
      else if (daysDiff <= 7) normal++;
    }
  });

  // Расчет активности
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

  const messagesThisMonth = messages.filter(
    (m) => new Date(m.createdAt) >= thisMonth,
  ).length;
  const messagesLastMonth = messages.filter(
    (m) =>
      new Date(m.createdAt) >= lastMonth && new Date(m.createdAt) < thisMonth,
  ).length;
  const messagesTwoMonthsAgo = messages.filter(
    (m) =>
      new Date(m.createdAt) >= twoMonthsAgo &&
      new Date(m.createdAt) < lastMonth,
  ).length;

  const complaintsThisMonth = messages.filter(
    (m) => m.type === "complaint" && new Date(m.createdAt) >= thisMonth,
  ).length;
  const complaintsLastMonth = messages.filter(
    (m) =>
      m.type === "complaint" &&
      new Date(m.createdAt) >= lastMonth &&
      new Date(m.createdAt) < thisMonth,
  ).length;

  // Расчет качества
  const complaints = messages.filter((m) => m.type === "complaint").length;
  const resolvedComplaints = messages.filter(
    (m) => m.type === "complaint" && m.status === "Решено",
  ).length;
  const resolutionRate =
    complaints > 0 ? Math.round((resolvedComplaints / complaints) * 100) : 0;

  const praisesCount = messages.filter((m) => m.type === "praise").length;
  const suggestions = messages.filter((m) => m.type === "suggestion").length;
  const positiveRatio =
    totalMessages > 0
      ? Math.round(((praisesCount + suggestions) / totalMessages) * 100)
      : 0;

  // Расчет долгосрочности
  const registeredDate = new Date(company.registered);
  const monthsDiff =
    (now.getFullYear() - registeredDate.getFullYear()) * 12 +
    (now.getMonth() - registeredDate.getMonth());
  const longevityMonths = Math.max(0, monthsDiff);

  return {
    totalMessages,
    resolvedMessages,
    messages,
    company,
    responseSpeedStats: { fast, medium, normal },
    activityStats: {
      messagesThisMonth,
      messagesLastMonth,
      messagesTwoMonthsAgo,
      complaintsThisMonth,
      complaintsLastMonth,
    },
    qualityStats: {
      resolutionRate,
      praisesCount,
      positiveRatio,
    },
    longevityMonths,
  };
}

function calculateAchievementProgress(
  achievement: Achievement,
  data: CompanyAchievementData,
): AchievementProgress {
  let current = 0;
  let completed = false;

  switch (achievement.category) {
    case "reviews":
      current = data.totalMessages;
      completed = current >= achievement.target;
      break;

    case "resolved":
      current = data.resolvedMessages;
      completed = current >= achievement.target;
      break;

    case "response_speed":
      current = data.responseSpeedStats.fast;
      completed = current >= achievement.target;
      break;

    case "activity":
      if (achievement.id === "activity_level_1") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const messagesThisWeek = data.messages.filter(
          (m) => new Date(m.createdAt) >= weekAgo,
        ).length;
        current = messagesThisWeek >= 5 ? 1 : 0;
        completed = current >= achievement.target;
      } else if (achievement.id === "activity_level_2") {
        current = data.activityStats.messagesThisMonth >= 10 ? 1 : 0;
        completed = current >= achievement.target;
      } else if (achievement.id === "activity_level_3") {
        current = data.activityStats.complaintsThisMonth === 0 ? 1 : 0;
        completed = current >= achievement.target;
      } else if (achievement.id === "activity_level_4") {
        const hasThisMonth = data.activityStats.messagesThisMonth >= 5;
        const hasLastMonth = data.activityStats.messagesLastMonth >= 5;
        const hasTwoMonthsAgo = data.activityStats.messagesTwoMonthsAgo >= 5;
        current = hasThisMonth && hasLastMonth && hasTwoMonthsAgo ? 3 : 0;
        completed = current >= achievement.target;
      }
      break;

    case "quality":
      if (
        achievement.id?.startsWith("quality_level_1") ||
        achievement.id?.startsWith("quality_level_2") ||
        achievement.id?.startsWith("quality_level_3")
      ) {
        current = data.qualityStats.praisesCount;
        completed = current >= achievement.target;
      } else if (
        achievement.id?.startsWith("quality_level_4") ||
        achievement.id?.startsWith("quality_level_5")
      ) {
        current = data.qualityStats.positiveRatio;
        completed = current >= achievement.target;
      } else if (achievement.id?.startsWith("quality_level_6")) {
        current = data.qualityStats.resolutionRate;
        completed = current >= achievement.target;
      } else if (achievement.id?.startsWith("quality_level_7")) {
        current = data.qualityStats.resolutionRate;
        completed = current >= achievement.target;
      }
      break;

    case "longevity":
      current = data.longevityMonths;
      completed = current >= achievement.target;
      break;
  }

  const progress = completed
    ? 100
    : achievement.target > 0
      ? Math.min(100, Math.round((current / achievement.target) * 100))
      : 0;

  return {
    achievement,
    current,
    progress,
    completed,
    completedAt: completed ? new Date().toISOString().split("T")[0] : undefined,
  };
}

export async function getCompanyAchievements(
  companyId: string,
): Promise<AchievementProgress[]> {
  const company = await Company.findById(companyId);
  if (!company) {
    return [];
  }

  const messages = await Message.find({ companyCode: company.code });
  const stats = calculateCompanyStats(messages, company);

  return ACHIEVEMENTS.map((achievement) =>
    calculateAchievementProgress(achievement, stats),
  ).sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? -1 : 1;
    }
    if (a.progress !== b.progress) {
      return b.progress - a.progress;
    }
    return a.achievement.order - b.achievement.order;
  });
}

export interface GroupedAchievements {
  category: AchievementCategory;
  categoryTitleKey: string;
  achievements: AchievementProgress[];
  currentLevel: number;
  maxLevel: number;
}

export async function getGroupedAchievements(
  companyId: string,
): Promise<GroupedAchievements[]> {
  const company = await Company.findById(companyId);
  if (!company) {
    return [];
  }

  const messages = await Message.find({ companyCode: company.code });
  const stats = calculateCompanyStats(messages, company);
  const allProgress = ACHIEVEMENTS.map((achievement) =>
    calculateAchievementProgress(achievement, stats),
  );

  const grouped: Record<string, AchievementProgress[]> = {};
  allProgress.forEach((progress) => {
    const category = progress.achievement.category;
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(progress);
  });

  const categoryTitles: Record<string, string> = {
    reviews: "company.achievement.category.reviews",
    resolved: "company.achievement.category.resolved",
    response_speed: "company.achievement.category.responseSpeed",
    activity: "company.achievement.category.activity",
    quality: "company.achievement.category.quality",
    longevity: "company.achievement.category.longevity",
  };

  return Object.entries(grouped)
    .map(([category, achievements]) => {
      achievements.sort((a, b) => {
        const levelA = a.achievement.level || 0;
        const levelB = b.achievement.level || 0;
        return levelA - levelB;
      });

      let currentLevel = 0;
      for (const ach of achievements) {
        if (ach.completed) {
          currentLevel = Math.max(currentLevel, ach.achievement.level || 0);
        }
      }
      const nextIncomplete = achievements.find((a) => !a.completed);
      if (nextIncomplete) {
        currentLevel = Math.max(
          currentLevel,
          (nextIncomplete.achievement.level || 1) - 1,
        );
      }

      const maxLevel = Math.max(
        ...achievements.map((a) => a.achievement.level || 0),
      );

      return {
        category: category as AchievementCategory,
        categoryTitleKey: categoryTitles[category] || category,
        achievements,
        currentLevel,
        maxLevel,
      };
    })
    .sort((a, b) => {
      const aHasProgress = a.achievements.some((ach) => ach.progress > 0);
      const bHasProgress = b.achievements.some((ach) => ach.progress > 0);
      if (aHasProgress !== bHasProgress) {
        return aHasProgress ? -1 : 1;
      }
      return a.category.localeCompare(b.category);
    });
}
