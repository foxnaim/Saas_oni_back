import { Message } from "../models/Message";
import { Company } from "../models/Company";
import { getCompanyAchievements } from "./achievementsService";

export interface Stats {
  new: number;
  inProgress: number;
  resolved: number;
  total: number;
}

export interface MessageDistribution {
  complaints: number;
  praises: number;
  suggestions: number;
}

export interface GrowthMetrics {
  rating: number;
  mood: "Позитивный" | "Нейтральный" | "Негативный";
  trend: "up" | "down" | "stable";
  pointsBreakdown?: {
    totalMessages: number;
    resolvedCases: number;
    responseSpeed: number;
    activityBonus: number;
    achievementsBonus: number;
    praiseBonus: number;
  };
  nextLevel?: {
    current: number;
    next: number;
    progress: number;
  };
}

export const getCompanyStats = async (companyId: string): Promise<Stats> => {
  const company = await Company.findById(companyId);
  if (!company) {
    return { new: 0, inProgress: 0, resolved: 0, total: 0 };
  }

  const messages = await Message.find({ companyCode: company.code });

  let newCount = 0;
  let inProgressCount = 0;
  let resolvedCount = 0;

  for (const message of messages) {
    if (message.status === "Новое") newCount++;
    else if (message.status === "В работе") inProgressCount++;
    else if (message.status === "Решено") resolvedCount++;
  }

  return {
    new: newCount,
    inProgress: inProgressCount,
    resolved: resolvedCount,
    total: newCount + inProgressCount + resolvedCount,
  };
};

export const getMessageDistribution = async (
  companyId: string,
): Promise<MessageDistribution> => {
  const company = await Company.findById(companyId);
  if (!company) {
    return { complaints: 0, praises: 0, suggestions: 0 };
  }

  const messages = await Message.find({ companyCode: company.code });

  let complaints = 0;
  let praises = 0;
  let suggestions = 0;

  for (const message of messages) {
    if (message.type === "complaint") complaints++;
    else if (message.type === "praise") praises++;
    else if (message.type === "suggestion") suggestions++;
  }

  return { complaints, praises, suggestions };
};

/**
 * Улучшенный расчёт рейтинга роста компании
 *
 * Формула (максимум 10 баллов):
 * 1. Решённые кейсы (до 3 баллов) - процент решённых жалоб и предложений
 * 2. Скорость ответа (до 2 баллов) - как быстро отвечают на сообщения
 * 3. Бонус за похвалы (до 2 баллов) - соотношение похвал к жалобам
 * 4. Бонус за активность (до 1.5 балла) - количество сообщений (вовлечённость)
 * 5. Бонус за достижения (до 1.5 балла) - разблокированные достижения
 *
 * Особенности:
 * - Новая компания без сообщений получает базовый рейтинг 5.0
 * - Компания с только похвалами получает высокий рейтинг
 * - Тренд рассчитывается на основе сравнения с прошлым месяцем
 */
export const getGrowthMetrics = async (
  companyId: string,
): Promise<GrowthMetrics> => {
  const company = await Company.findById(companyId);
  if (!company) {
    return {
      rating: 0,
      mood: "Нейтральный",
      trend: "stable",
      pointsBreakdown: {
        totalMessages: 0,
        resolvedCases: 0,
        responseSpeed: 0,
        activityBonus: 0,
        achievementsBonus: 0,
        praiseBonus: 0,
      },
    };
  }

  const messages = await Message.find({ companyCode: company.code });
  const totalMessages = messages.length;

  // Если нет сообщений - базовый рейтинг 5.0 (нейтральный старт)
  if (totalMessages === 0) {
    return {
      rating: 5.0,
      mood: "Нейтральный",
      trend: "stable",
      pointsBreakdown: {
        totalMessages: 0,
        resolvedCases: 0,
        responseSpeed: 0,
        activityBonus: 0,
        achievementsBonus: 0,
        praiseBonus: 0,
      },
      nextLevel: {
        current: 5,
        next: 6,
        progress: 0,
      },
    };
  }

  // Распределение по типам
  const complaints = messages.filter((m) => m.type === "complaint").length;
  const praises = messages.filter((m) => m.type === "praise").length;
  const suggestions = messages.filter((m) => m.type === "suggestion").length;

  // === 1. РЕШЁННЫЕ КЕЙСЫ (до 3 баллов) ===
  const resolvedComplaints = messages.filter(
    (m) => m.type === "complaint" && m.status === "Решено",
  ).length;
  const resolvedSuggestions = messages.filter(
    (m) => m.type === "suggestion" && m.status === "Решено",
  ).length;
  const totalResolved = resolvedComplaints + resolvedSuggestions;
  const totalProblems = complaints + suggestions;

  let resolvedCasesPoints = 0;
  if (totalProblems > 0) {
    const resolvedRatio = totalResolved / totalProblems;
    resolvedCasesPoints = resolvedRatio * 3; // До 3 баллов
  } else {
    // Нет жалоб и предложений - полный балл за решение
    resolvedCasesPoints = 3;
  }

  // === 2. СКОРОСТЬ ОТВЕТА (до 2 баллов) ===
  let responseSpeedRaw = 0;
  let totalResponses = 0;

  messages.forEach((msg) => {
    if (msg.companyResponse && msg.updatedAt) {
      totalResponses++;
      const created = new Date(msg.createdAt);
      const updated = new Date(msg.updatedAt);
      const hoursDiff =
        (updated.getTime() - created.getTime()) / (1000 * 60 * 60);

      // Более детальная шкала скорости
      if (hoursDiff <= 2) {
        responseSpeedRaw += 10; // Очень быстро (2 часа)
      } else if (hoursDiff <= 12) {
        responseSpeedRaw += 8; // Быстро (12 часов)
      } else if (hoursDiff <= 24) {
        responseSpeedRaw += 6; // В тот же день
      } else if (hoursDiff <= 72) {
        responseSpeedRaw += 4; // За 3 дня
      } else if (hoursDiff <= 168) {
        responseSpeedRaw += 2; // За неделю
      } else {
        responseSpeedRaw += 1; // Позже недели
      }
    }
  });

  let responseSpeedPoints = 0;
  if (totalResponses > 0) {
    const maxSpeedRaw = totalResponses * 10;
    responseSpeedPoints = (responseSpeedRaw / maxSpeedRaw) * 2; // До 2 баллов
  }

  // === 3. БОНУС ЗА ПОХВАЛЫ (до 2 баллов) ===
  let praiseBonus = 0;
  if (totalMessages > 0) {
    // Соотношение похвал к общему числу сообщений
    const praiseRatio = praises / totalMessages;

    // Соотношение похвал к жалобам (если есть жалобы)
    const praiseToComplaintRatio =
      complaints > 0 ? praises / complaints : praises > 0 ? 3 : 1;

    // Комбинированный бонус
    // - Много похвал относительно всех сообщений = хорошо
    // - Больше похвал чем жалоб = очень хорошо
    praiseBonus = Math.min(
      2,
      praiseRatio * 2 + Math.min(1, praiseToComplaintRatio * 0.5),
    );
  }

  // === 4. БОНУС ЗА АКТИВНОСТЬ (до 1.5 балла) ===
  // Больше сообщений = больше вовлечённость сотрудников
  let activityBonus = 0;
  if (totalMessages >= 100) activityBonus = 1.5;
  else if (totalMessages >= 50) activityBonus = 1.2;
  else if (totalMessages >= 20) activityBonus = 0.9;
  else if (totalMessages >= 10) activityBonus = 0.6;
  else if (totalMessages >= 5) activityBonus = 0.3;
  else activityBonus = 0.1;

  // === 5. БОНУС ЗА ДОСТИЖЕНИЯ (до 1.5 балла) ===
  let achievementsBonus = 0;
  try {
    const achievements = await getCompanyAchievements(companyId);
    const completedCount = achievements.filter((a) => a.completed).length;
    const totalAchievements = achievements.length;

    if (totalAchievements > 0) {
      achievementsBonus = (completedCount / totalAchievements) * 1.5;
    }
  } catch {
    // Если ошибка получения достижений - пропускаем бонус
    achievementsBonus = 0;
  }

  // === ИТОГОВЫЙ РЕЙТИНГ ===
  const rawRating =
    resolvedCasesPoints +
    responseSpeedPoints +
    praiseBonus +
    activityBonus +
    achievementsBonus;
  const rating = Math.min(10, Math.round(rawRating * 10) / 10);

  // === НАСТРОЕНИЕ ===
  let mood: "Позитивный" | "Нейтральный" | "Негативный" = "Нейтральный";

  // Учитываем и рейтинг, и соотношение похвал/жалоб
  const sentimentRatio =
    complaints > 0 ? praises / complaints : praises > 0 ? 10 : 1;

  if (rating >= 7 || sentimentRatio >= 2) {
    mood = "Позитивный";
  } else if (rating <= 4 || sentimentRatio <= 0.3) {
    mood = "Негативный";
  }

  // === ТРЕНД (сравнение с прошлым месяцем) ===
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const currentMonthMessages = messages.filter((m) => {
    const date = new Date(m.createdAt);
    return date >= currentMonthStart;
  });

  const lastMonthMessages = messages.filter((m) => {
    const date = new Date(m.createdAt);
    return date >= lastMonthStart && date <= lastMonthEnd;
  });

  let trend: "up" | "down" | "stable" = "stable";

  // Сравниваем количество сообщений и соотношение похвал
  const currentPraises = currentMonthMessages.filter(
    (m) => m.type === "praise",
  ).length;
  const currentComplaints = currentMonthMessages.filter(
    (m) => m.type === "complaint",
  ).length;
  const lastPraises = lastMonthMessages.filter(
    (m) => m.type === "praise",
  ).length;
  const lastComplaints = lastMonthMessages.filter(
    (m) => m.type === "complaint",
  ).length;

  const currentSentiment =
    currentComplaints > 0 ? currentPraises / currentComplaints : currentPraises;
  const lastSentiment =
    lastComplaints > 0 ? lastPraises / lastComplaints : lastPraises;

  // Также учитываем решённые кейсы
  const currentResolved = currentMonthMessages.filter(
    (m) => m.status === "Решено",
  ).length;
  const lastResolved = lastMonthMessages.filter(
    (m) => m.status === "Решено",
  ).length;

  // Определяем тренд на основе нескольких факторов
  let trendScore = 0;

  // Больше сообщений = больше вовлечённость
  if (currentMonthMessages.length > lastMonthMessages.length * 1.2) {
    trendScore += 1;
  } else if (currentMonthMessages.length < lastMonthMessages.length * 0.8) {
    trendScore -= 1;
  }

  // Лучше настроение
  if (currentSentiment > lastSentiment * 1.1) trendScore += 1;
  else if (currentSentiment < lastSentiment * 0.9) trendScore -= 1;

  // Больше решённых кейсов
  if (currentResolved > lastResolved) trendScore += 1;
  else if (currentResolved < lastResolved) trendScore -= 1;

  if (trendScore >= 2) trend = "up";
  else if (trendScore <= -2) trend = "down";

  // === ПРОГРЕСС К СЛЕДУЮЩЕМУ УРОВНЮ ===
  const currentLevel = Math.floor(rating);
  const nextLevel = Math.min(10, currentLevel + 1);
  const progress = ((rating - currentLevel) / 1) * 100;

  return {
    rating,
    mood,
    trend,
    pointsBreakdown: {
      totalMessages,
      resolvedCases: Math.round(resolvedCasesPoints * 100) / 100,
      responseSpeed: Math.round(responseSpeedPoints * 100) / 100,
      activityBonus: Math.round(activityBonus * 100) / 100,
      achievementsBonus: Math.round(achievementsBonus * 100) / 100,
      praiseBonus: Math.round(praiseBonus * 100) / 100,
    },
    nextLevel: {
      current: currentLevel,
      next: nextLevel,
      progress: Math.round(progress),
    },
  };
};
