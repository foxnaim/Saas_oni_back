import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError, ErrorCode } from "../utils/AppError";
import {
  SubscriptionPlan,
  ISubscriptionPlan,
} from "../models/SubscriptionPlan";
import { FreePlanSettings } from "../models/FreePlanSettings";
import { Company } from "../models/Company";
import { cache, CacheManager } from "../utils/cacheRedis";

// Тип для lean() результата - упрощенный тип для кэширования
type PlanLean = ISubscriptionPlan;

// Функция для получения настроек бесплатного плана из БД
// При первом запуске создаёт запись с default из схемы (единственное место значений по умолчанию)
async function getFreePlanSettingsFromDB(): Promise<{
  messagesLimit: number;
  storageLimit: number;
  freePeriodDays: number;
}> {
  let settings = await FreePlanSettings.findOne({ settingsId: "default" });

  if (!settings) {
    // Создаём с минимальными полями — остальное заполнит schema default
    settings = await FreePlanSettings.create({ settingsId: "default" });
  }

  return {
    messagesLimit: settings.messagesLimit,
    storageLimit: settings.storageLimit,
    freePeriodDays: settings.freePeriodDays,
  };
}

export const getAllPlans = asyncHandler(
  async (_req: Request, res: Response) => {
    // Инвалидируем кэш, чтобы гарантировать актуальные данные
    const cacheKey = "plans:all";
    void cache.delete(cacheKey);

    // Получаем настройки бесплатного плана из БД
    const freePlanSettings = await getFreePlanSettingsFromDB();

    // Оптимизация: используем lean() и select для производительности
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let plans: any[] = await SubscriptionPlan.find()
      .select("-__v")
      .sort({ price: 1 })
      .lean()
      .exec();

    // Если планов нет, создаем дефолтные
    if (plans.length === 0) {
      const defaultPlans = [
        {
          id: "free",
          name: { ru: "Пробный", en: "Trial", kk: "Сынақ" },
          price: 0,
          messagesLimit: freePlanSettings.messagesLimit,
          storageLimit: freePlanSettings.storageLimit,
          isFree: true,
          freePeriodDays: freePlanSettings.freePeriodDays,
          features: [
            {
              ru: `Все функции на ${freePlanSettings.freePeriodDays} ${freePlanSettings.freePeriodDays === 1 ? "день" : freePlanSettings.freePeriodDays < 5 ? "дня" : "дней"}`,
              en: `All features for ${freePlanSettings.freePeriodDays} ${freePlanSettings.freePeriodDays === 1 ? "day" : "days"}`,
              kk: `Барлық функциялар ${freePlanSettings.freePeriodDays} ${freePlanSettings.freePeriodDays === 1 ? "күн" : "күнге"}`,
            },
            {
              ru: "Ответы на сообщения",
              en: "Reply to messages",
              kk: "Хабарламаларға жауап беру",
            },
            {
              ru: "Смена статусов (новое / в работе / решено / отклонено / спам)",
              en: "Change statuses (new / in progress / resolved / rejected / spam)",
              kk: "Статустарды өзгерту (жаңа / жұмыс істеп жатыр / шешілді / қабылданбады / спам)",
            },
            {
              ru: "Расширенная аналитика",
              en: "Extended analytics",
              kk: "Кеңейтілген аналитика",
            },
            {
              ru: "Отчёты (месячные PDF)",
              en: "Reports (monthly PDF)",
              kk: "Есептер (айлық PDF)",
            },
            {
              ru: "Показатель «настроение команды» (на основе типов и статусов сообщений)",
              en: "Team mood indicator (based on message types and statuses)",
              kk: "Команда көңіл-күй көрсеткіші (хабарлама түрлері мен статустарына негізделген)",
            },
            {
              ru: "Рейтинг роста",
              en: "Growth rating",
              kk: "Өсу рейтингі",
            },
          ],
        },
        {
          id: "standard",
          name: { ru: "Стандарт", en: "Standard", kk: "Стандарт" },
          price: 5990,
          messagesLimit: 100,
          storageLimit: 10,
          features: [
            {
              ru: "Ответы на сообщения",
              en: "Reply to messages",
              kk: "Хабарламаларға жауап беру",
            },
            {
              ru: "Смена статусов (новое / в работе / решено / отклонено / спам)",
              en: "Change statuses (new / in progress / resolved / rejected / spam)",
              kk: "Статустарды өзгерту (жаңа / жұмыс істеп жатыр / шешілді / қабылданбады / спам)",
            },
            {
              ru: "Базовая аналитика (распределение сообщений)",
              en: "Basic analytics (message distribution)",
              kk: "Негізгі аналитика (хабарламалардың бөлінуі)",
            },
            {
              ru: "Рейтинг роста",
              en: "Growth rating",
              kk: "Өсу рейтингі",
            },
          ],
        },
        {
          id: "pro",
          name: { ru: "Про", en: "Pro", kk: "Про" },
          price: 11990,
          messagesLimit: 500,
          storageLimit: 50,
          features: [
            {
              ru: "Ответы на сообщения",
              en: "Reply to messages",
              kk: "Хабарламаларға жауап беру",
            },
            {
              ru: "Смена статусов (новое / в работе / решено / отклонено / спам)",
              en: "Change statuses (new / in progress / resolved / rejected / spam)",
              kk: "Статустарды өзгерту (жаңа / жұмыс істеп жатыр / шешілді / қабылданбады / спам)",
            },
            {
              ru: "Расширенная аналитика",
              en: "Extended analytics",
              kk: "Кеңейтілген аналитика",
            },
            {
              ru: "Отчёты (месячные PDF)",
              en: "Reports (monthly PDF)",
              kk: "Есептер (айлық PDF)",
            },
            {
              ru: "Показатель «настроение команды» (на основе типов и статусов сообщений)",
              en: "Team mood indicator (based on message types and statuses)",
              kk: "Команда көңіл-күй көрсеткіші (хабарлама түрлері мен статустарына негізделген)",
            },
            {
              ru: "Приоритетная поддержка",
              en: "Priority support",
              kk: "Басымдықты қолдау",
            },
          ],
        },
      ];

      await SubscriptionPlan.insertMany(defaultPlans);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plans = await SubscriptionPlan.find()
        .select("-__v")
        .sort({ price: 1 })
        .lean()
        .exec();
    } else {
      // Обновляем существующие планы, чтобы гарантировать актуальные цены и features
      const freePlan = await SubscriptionPlan.findOne({
        $or: [{ id: "free" }, { isFree: true }],
      });
      if (freePlan) {
        freePlan.name = { ru: "Пробный", en: "Trial", kk: "Сынақ" };
        freePlan.freePeriodDays = freePlanSettings.freePeriodDays;
        freePlan.messagesLimit = freePlanSettings.messagesLimit;
        freePlan.features = [
          {
            ru: `Все функции на ${freePlanSettings.freePeriodDays} ${freePlanSettings.freePeriodDays === 1 ? "день" : freePlanSettings.freePeriodDays < 5 ? "дня" : "дней"}`,
            en: `All features for ${freePlanSettings.freePeriodDays} ${freePlanSettings.freePeriodDays === 1 ? "day" : "days"}`,
            kk: `Барлық функциялар ${freePlanSettings.freePeriodDays} ${freePlanSettings.freePeriodDays === 1 ? "күн" : "күнге"}`,
          },
          {
            ru: "Ответы на сообщения",
            en: "Reply to messages",
            kk: "Хабарламаларға жауап беру",
          },
          {
            ru: "Смена статусов (новое / в работе / решено / отклонено / спам)",
            en: "Change statuses (new / in progress / resolved / rejected / spam)",
            kk: "Статустарды өзгерту (жаңа / жұмыс істеп жатыр / шешілді / қабылданбады / спам)",
          },
          {
            ru: "Расширенная аналитика",
            en: "Extended analytics",
            kk: "Кеңейтілген аналитика",
          },
          {
            ru: "Отчёты (месячные PDF)",
            en: "Reports (monthly PDF)",
            kk: "Есептер (айлық PDF)",
          },
          {
            ru: "Показатель «настроение команды» (на основе типов и статусов сообщений)",
            en: "Team mood indicator (based on message types and statuses)",
            kk: "Команда көңіл-күй көрсеткіші (хабарлама түрлері мен статустарына негізделген)",
          },
          {
            ru: "Рейтинг роста",
            en: "Growth rating",
            kk: "Өсу рейтингі",
          },
        ];
        await freePlan.save();
      }

      const standardPlan = await SubscriptionPlan.findOne({ id: "standard" });
      if (standardPlan) {
        standardPlan.price = 5990;
        standardPlan.features = [
          {
            ru: "Ответы на сообщения",
            en: "Reply to messages",
            kk: "Хабарламаларға жауап беру",
          },
          {
            ru: "Смена статусов (новое / в работе / решено / отклонено / спам)",
            en: "Change statuses (new / in progress / resolved / rejected / spam)",
            kk: "Статустарды өзгерту (жаңа / жұмыс істеп жатыр / шешілді / қабылданбады / спам)",
          },
          {
            ru: "Базовая аналитика (распределение сообщений)",
            en: "Basic analytics (message distribution)",
            kk: "Негізгі аналитика (хабарламалардың бөлінуі)",
          },
          {
            ru: "Рейтинг роста",
            en: "Growth rating",
            kk: "Өсу рейтингі",
          },
        ];
        await standardPlan.save();
      }

      const proPlan = await SubscriptionPlan.findOne({ id: "pro" });
      if (proPlan) {
        proPlan.price = 11990;
        proPlan.features = [
          {
            ru: "Ответы на сообщения",
            en: "Reply to messages",
            kk: "Хабарламаларға жауап беру",
          },
          {
            ru: "Смена статусов (новое / в работе / решено / отклонено / спам)",
            en: "Change statuses (new / in progress / resolved / rejected / spam)",
            kk: "Статустарды өзгерту (жаңа / жұмыс істеп жатыр / шешілді / қабылданбады / спам)",
          },
          {
            ru: "Расширенная аналитика",
            en: "Extended analytics",
            kk: "Кеңейтілген аналитика",
          },
          {
            ru: "Отчёты (месячные PDF)",
            en: "Reports (monthly PDF)",
            kk: "Есептер (айлық PDF)",
          },
          {
            ru: "Показатель «настроение команды» (на основе типов и статусов сообщений)",
            en: "Team mood indicator (based on message types and statuses)",
            kk: "Команда көңіл-күй көрсеткіші (хабарлама түрлері мен статустарына негізделген)",
          },
          {
            ru: "Приоритетная поддержка",
            en: "Priority support",
            kk: "Басымдықты қолдау",
          },
        ];
        await proPlan.save();
      }

      // Обновляем кэш после обновления планов
      void cache.delete("plans:all");

      // Перезагружаем планы после обновления
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      plans = await SubscriptionPlan.find()
        .select("-__v")
        .sort({ price: 1 })
        .lean()
        .exec();
    }

    // Обновляем freePeriodDays для бесплатного плана из текущих настроек
    // Это гарантирует, что всегда используется актуальное значение из админки
    const freePlanIndex = plans.findIndex(
      (p: PlanLean) => p.id === "free" || p.isFree === true,
    );
    if (freePlanIndex !== -1 && freePlanIndex < plans.length) {
      // Обновляем в базе данных (нужно найти документ, а не lean объект)
      const freePlanDoc = await SubscriptionPlan.findOne({
        $or: [{ id: "free" }, { isFree: true }],
      });
      if (freePlanDoc) {
        // Обновляем название (переводимое)
        freePlanDoc.name = { ru: "Пробный", en: "Trial", kk: "Сынақ" };
        freePlanDoc.freePeriodDays = freePlanSettings.freePeriodDays;
        freePlanDoc.messagesLimit = freePlanSettings.messagesLimit;
        // Обновляем features с описанием пробного периода
        const expectedFeatures = [
          {
            ru: `Все функции на ${freePlanSettings.freePeriodDays} ${freePlanSettings.freePeriodDays === 1 ? "день" : freePlanSettings.freePeriodDays < 5 ? "дня" : "дней"}`,
            en: `All features for ${freePlanSettings.freePeriodDays} ${freePlanSettings.freePeriodDays === 1 ? "day" : "days"}`,
            kk: `Барлық функциялар ${freePlanSettings.freePeriodDays} ${freePlanSettings.freePeriodDays === 1 ? "күн" : "күнге"}`,
          },
          {
            ru: "Ответы на сообщения",
            en: "Reply to messages",
            kk: "Хабарламаларға жауап беру",
          },
          {
            ru: "Смена статусов (новое / в работе / решено / отклонено / спам)",
            en: "Change statuses (new / in progress / resolved / rejected / spam)",
            kk: "Статустарды өзгерту (жаңа / жұмыс істеп жатыр / шешілді / қабылданбады / спам)",
          },
          {
            ru: "Расширенная аналитика",
            en: "Extended analytics",
            kk: "Кеңейтілген аналитика",
          },
          {
            ru: "Отчёты (месячные PDF)",
            en: "Reports (monthly PDF)",
            kk: "Есептер (айлық PDF)",
          },
          {
            ru: "Показатель «настроение команды» (на основе типов и статусов сообщений)",
            en: "Team mood indicator (based on message types and statuses)",
            kk: "Команда көңіл-күй көрсеткіші (хабарлама түрлері мен статустарына негізделген)",
          },
          {
            ru: "Рейтинг роста",
            en: "Growth rating",
            kk: "Өсу рейтингі",
          },
        ];
        freePlanDoc.features = expectedFeatures;
        await freePlanDoc.save();

        // Обновляем в массиве для ответа
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
        const planToUpdate = plans[freePlanIndex];
        if (planToUpdate) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          planToUpdate.freePeriodDays = freePlanSettings.freePeriodDays;
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          planToUpdate.messagesLimit = freePlanSettings.messagesLimit;
          // Обновляем название (переводимое)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          planToUpdate.name = { ru: "Пробный", en: "Trial", kk: "Сынақ" };
          // Обновляем features с описанием пробного периода
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          planToUpdate.features = [
            {
              ru: `Все функции на ${freePlanSettings.freePeriodDays} ${freePlanSettings.freePeriodDays === 1 ? "день" : freePlanSettings.freePeriodDays < 5 ? "дня" : "дней"}`,
              en: `All features for ${freePlanSettings.freePeriodDays} ${freePlanSettings.freePeriodDays === 1 ? "day" : "days"}`,
              kk: `Барлық функциялар ${freePlanSettings.freePeriodDays} ${freePlanSettings.freePeriodDays === 1 ? "күн" : "күнге"}`,
            },
            {
              ru: "Ответы на сообщения",
              en: "Reply to messages",
              kk: "Хабарламаларға жауап беру",
            },
            {
              ru: "Смена статусов (новое / в работе / решено / отклонено / спам)",
              en: "Change statuses (new / in progress / resolved / rejected / spam)",
              kk: "Статустарды өзгерту (жаңа / жұмыс істеп жатыр / шешілді / қабылданбады / спам)",
            },
            {
              ru: "Расширенная аналитика",
              en: "Extended analytics",
              kk: "Кеңейтілген аналитика",
            },
            {
              ru: "Отчёты (месячные PDF)",
              en: "Reports (monthly PDF)",
              kk: "Есептер (айлық PDF)",
            },
            {
              ru: "Показатель «настроение команды» (на основе типов и статусов сообщений)",
              en: "Team mood indicator (based on message types and statuses)",
              kk: "Команда көңіл-күй көрсеткіші (хабарлама түрлері мен статустарына негізделген)",
            },
            {
              ru: "Рейтинг роста",
              en: "Growth rating",
              kk: "Өсу рейтингі",
            },
          ];
        }
      }
    }

    // Обновляем цены и features для Standard и Pro планов в базе данных и в массиве ответа
    const standardPlanDoc = await SubscriptionPlan.findOne({ id: "standard" });
    if (standardPlanDoc) {
      standardPlanDoc.price = 5990;
      standardPlanDoc.features = [
        {
          ru: "Ответы на сообщения",
          en: "Reply to messages",
          kk: "Хабарламаларға жауап беру",
        },
        {
          ru: "Смена статусов (новое / в работе / решено / отклонено / спам)",
          en: "Change statuses (new / in progress / resolved / rejected / spam)",
          kk: "Статустарды өзгерту (жаңа / жұмыс істеп жатыр / шешілді / қабылданбады / спам)",
        },
        {
          ru: "Базовая аналитика (распределение сообщений)",
          en: "Basic analytics (message distribution)",
          kk: "Негізгі аналитика (хабарламалардың бөлінуі)",
        },
        {
          ru: "Рейтинг роста",
          en: "Growth rating",
          kk: "Өсу рейтингі",
        },
      ];
      await standardPlanDoc.save();
    }

    const proPlanDoc = await SubscriptionPlan.findOne({ id: "pro" });
    if (proPlanDoc) {
      proPlanDoc.price = 11990;
      proPlanDoc.features = [
        {
          ru: "Ответы на сообщения",
          en: "Reply to messages",
          kk: "Хабарламаларға жауап беру",
        },
        {
          ru: "Смена статусов (новое / в работе / решено / отклонено / спам)",
          en: "Change statuses (new / in progress / resolved / rejected / spam)",
          kk: "Статустарды өзгерту (жаңа / жұмыс істеп жатыр / шешілді / қабылданбады / спам)",
        },
        {
          ru: "Расширенная аналитика",
          en: "Extended analytics",
          kk: "Кеңейтілген аналитика",
        },
        {
          ru: "Отчёты (месячные PDF)",
          en: "Reports (monthly PDF)",
          kk: "Есептер (айлық PDF)",
        },
        {
          ru: "Показатель «настроение команды» (на основе типов и статусов сообщений)",
          en: "Team mood indicator (based on message types and statuses)",
          kk: "Команда көңіл-күй көрсеткіші (хабарлама түрлері мен статустарына негізделген)",
        },
        {
          ru: "Приоритетная поддержка",
          en: "Priority support",
          kk: "Басымдықты қолдау",
        },
      ];
      await proPlanDoc.save();
    }

    // Обновляем цены и features для Standard и Pro планов в массиве ответа
    const standardPlanIndex = plans.findIndex(
      (p: PlanLean) => p.id === "standard",
    );
    if (standardPlanIndex !== -1) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const standardPlan = plans[standardPlanIndex];
      if (standardPlan) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        standardPlan.price = 5990;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        standardPlan.features = [
          {
            ru: "Ответы на сообщения",
            en: "Reply to messages",
            kk: "Хабарламаларға жауап беру",
          },
          {
            ru: "Смена статусов (новое / в работе / решено / отклонено / спам)",
            en: "Change statuses (new / in progress / resolved / rejected / spam)",
            kk: "Статустарды өзгерту (жаңа / жұмыс істеп жатыр / шешілді / қабылданбады / спам)",
          },
          {
            ru: "Базовая аналитика (распределение сообщений)",
            en: "Basic analytics (message distribution)",
            kk: "Негізгі аналитика (хабарламалардың бөлінуі)",
          },
          {
            ru: "Рейтинг роста",
            en: "Growth rating",
            kk: "Өсу рейтингі",
          },
        ];
      }
    }

    const proPlanIndex = plans.findIndex((p: PlanLean) => p.id === "pro");
    if (proPlanIndex !== -1) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      const proPlan = plans[proPlanIndex];
      if (proPlan) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        proPlan.price = 11990;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        proPlan.features = [
          {
            ru: "Ответы на сообщения",
            en: "Reply to messages",
            kk: "Хабарламаларға жауап беру",
          },
          {
            ru: "Смена статусов (новое / в работе / решено / отклонено / спам)",
            en: "Change statuses (new / in progress / resolved / rejected / spam)",
            kk: "Статустарды өзгерту (жаңа / жұмыс істеп жатыр / шешілді / қабылданбады / спам)",
          },
          {
            ru: "Расширенная аналитика",
            en: "Extended analytics",
            kk: "Кеңейтілген аналитика",
          },
          {
            ru: "Отчёты (месячные PDF)",
            en: "Reports (monthly PDF)",
            kk: "Есептер (айлық PDF)",
          },
          {
            ru: "Показатель «настроение команды» (на основе типов и статусов сообщений)",
            en: "Team mood indicator (based on message types and statuses)",
            kk: "Команда көңіл-күй көрсеткіші (хабарлама түрлері мен статустарына негізделген)",
          },
          {
            ru: "Приоритетная поддержка",
            en: "Priority support",
            kk: "Басымдықты қолдау",
          },
        ];
      }
    }

    // Получаем все компании для подсчета статистики по тарифам
    const companies = await Company.find()
      .select("plan trialEndDate status")
      .lean()
      .exec();

    // Функция для получения имени плана (поддержка разных форматов)
    const getPlanName = (plan: PlanLean): string => {
      if (typeof plan.name === "string") {
        return plan.name;
      }
      if (plan.name && typeof plan.name === "object") {
        return plan.name.ru || plan.name.en || plan.name.kk || "";
      }
      return "";
    };

    // Функция для вычисления дней до окончания тарифа
    const calculateDaysUntilExpiry = (trialEndDate?: string): number | null => {
      if (!trialEndDate) return null;
      try {
        const endDate = new Date(trialEndDate);
        const now = new Date();
        const diffTime = endDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
      } catch {
        return null;
      }
    };

    // Подсчитываем количество компаний на каждом тарифе и вычисляем среднее время до окончания
    const planStats = new Map<
      string,
      {
        count: number;
        totalDaysUntilExpiry: number;
        companiesWithExpiry: number;
      }
    >();

    companies.forEach((company) => {
      const companyPlan = company.plan || "Бесплатный";

      // Находим соответствующий план в списке планов
      const matchingPlan = (plans as PlanLean[]).find((p: PlanLean) => {
        const planName = getPlanName(p);
        return (
          planName === companyPlan ||
          (typeof p.name === "object" &&
            (p.name.ru === companyPlan ||
              p.name.en === companyPlan ||
              p.name.kk === companyPlan))
        );
      });

      // Используем ID плана или имя плана как ключ
      const planKey = matchingPlan ? String(matchingPlan.id) : companyPlan;

      if (!planStats.has(planKey)) {
        planStats.set(planKey, {
          count: 0,
          totalDaysUntilExpiry: 0,
          companiesWithExpiry: 0,
        });
      }

      const stats = planStats.get(planKey)!;
      stats.count += 1;

      // Вычисляем дни до окончания для компаний с trialEndDate
      if (company.trialEndDate) {
        const daysUntilExpiry = calculateDaysUntilExpiry(company.trialEndDate);
        if (daysUntilExpiry !== null) {
          stats.totalDaysUntilExpiry += daysUntilExpiry;
          stats.companiesWithExpiry += 1;
        }
      }
    });

    // Добавляем статистику к каждому плану
    const plansWithStats = plans.map((plan: PlanLean) => {
      const planKey = String(plan.id);
      const stats =
        planStats.get(planKey) ||
        ({
          count: 0,
          totalDaysUntilExpiry: 0,
          companiesWithExpiry: 0,
        } as {
          count: number;
          totalDaysUntilExpiry: number;
          companiesWithExpiry: number;
        });

      // Вычисляем среднее количество дней до окончания
      const avgDaysUntilExpiry =
        stats.companiesWithExpiry > 0
          ? Math.round(stats.totalDaysUntilExpiry / stats.companiesWithExpiry)
          : null;

      return {
        ...plan,
        companiesCount: stats.count,
        avgDaysUntilExpiry,
      };
    });

    // Кэшируем на 30 минут (планы меняются редко)
    await cache.set(cacheKey, plansWithStats, CacheManager.getTTL("company"));

    res.json({
      success: true,
      data: plansWithStats,
    });
  },
);

export const createPlan = asyncHandler(async (req: Request, res: Response) => {
  // Только админы могут создавать планы
  if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
    throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
  }

  const body = req.body as {
    name?: string;
    price?: number;
    messagesLimit?: number;
    storageLimit?: number;
    features?: string[];
    isFree?: boolean;
    freePeriodDays?: number;
  };
  const {
    name,
    price,
    messagesLimit,
    storageLimit,
    features,
    isFree,
    freePeriodDays,
  } = body;

  const planId = `custom-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const plan = await SubscriptionPlan.create({
    id: planId,
    name,
    price,
    messagesLimit,
    storageLimit,
    features,
    isFree,
    freePeriodDays,
  });

  // Инвалидируем кэш планов
  void cache.delete("plans:all");

  res.status(201).json({
    success: true,
    data: plan,
  });
});

export const getFreePlanSettings = asyncHandler(
  async (_req: Request, res: Response) => {
    // Проверяем кэш
    const cacheKey = "plans:free-settings";
    const cached = await cache.get<{
      messagesLimit: number;
      storageLimit: number;
      freePeriodDays: number;
    }>(cacheKey);
    if (cached) {
      res.json({
        success: true,
        data: cached,
      });
      return;
    }

    // Получаем настройки из БД
    const settings = await getFreePlanSettingsFromDB();

    // Кэшируем на 5 минут (статистика)
    await cache.set(cacheKey, settings, CacheManager.getTTL("stats"));

    res.json({
      success: true,
      data: settings,
    });
  },
);

export const updateFreePlanSettings = asyncHandler(
  async (req: Request, res: Response) => {
    // Только суперадмины могут обновлять настройки пробного плана
    if (req.user?.role !== "super_admin") {
      throw new AppError(
        "Access denied. Only super admins can edit trial plan settings",
        403,
        ErrorCode.FORBIDDEN,
      );
    }

    const body = req.body as {
      messagesLimit?: number;
      storageLimit?: number;
      freePeriodDays?: number;
    };
    const { messagesLimit, storageLimit, freePeriodDays } = body;

    // Получаем текущие настройки из БД
    let settings = await FreePlanSettings.findOne({ settingsId: "default" });

    if (!settings) {
      // Создаем новые настройки только если переданы все обязательные поля
      if (
        messagesLimit === undefined ||
        storageLimit === undefined ||
        freePeriodDays === undefined
      ) {
        throw new AppError(
          "Для создания настроек пробного плана необходимо указать messagesLimit, storageLimit и freePeriodDays.",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }
      settings = await FreePlanSettings.create({
        settingsId: "default",
        messagesLimit,
        storageLimit,
        freePeriodDays,
      });
    } else {
      // Обновляем только переданные поля
      if (messagesLimit !== undefined) {
        settings.messagesLimit = messagesLimit;
      }
      if (storageLimit !== undefined) {
        settings.storageLimit = storageLimit;
      }
      if (freePeriodDays !== undefined) {
        settings.freePeriodDays = freePeriodDays;
      }
      await settings.save();
    }

    // Обновляем бесплатный план в SubscriptionPlan, если он существует
    const freePlan = await SubscriptionPlan.findOne({
      $or: [{ id: "free" }, { isFree: true }],
    });
    if (freePlan) {
      freePlan.messagesLimit = settings.messagesLimit;
      freePlan.freePeriodDays = settings.freePeriodDays;
      await freePlan.save();
    }

    // Инвалидируем кэш
    void cache.delete("plans:free-settings");
    void cache.delete("plans:all"); // Также инвалидируем кэш всех планов

    const responseData = {
      messagesLimit: settings.messagesLimit,
      storageLimit: settings.storageLimit,
      freePeriodDays: settings.freePeriodDays,
    };

    res.json({
      success: true,
      data: responseData,
    });
  },
);
