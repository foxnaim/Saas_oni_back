import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError, ErrorCode } from "../utils/AppError";
import { Company } from "../models/Company";
import { User } from "../models/User";
import { AdminUser } from "../models/AdminUser";
import { SubscriptionPlan } from "../models/SubscriptionPlan";
import { FreePlanSettings } from "../models/FreePlanSettings";
import { Message } from "../models/Message";
import { hashPassword } from "../utils/password";
import { logger } from "../utils/logger";
import { cache } from "../utils/cacheRedis";
import { isTrialPlan } from "../utils/planPermissions";
import { verifyPayPalOrder } from "../services/PaypalService";

export const getAllCompanies = asyncHandler(
  async (req: Request, res: Response) => {
    // Только админы могут видеть все компании
    if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
      throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
    }

    const { page, limit } = req.query;

    // Пагинация
    const pageNumber =
      page && typeof page === "string" ? parseInt(page, 10) : 1;
    const pageSize =
      limit && typeof limit === "string" ? parseInt(limit, 10) : 20;
    const skip = (pageNumber - 1) * pageSize;

    // Оптимизация: используем lean() для производительности и select для исключения ненужных полей
    const [companies, total] = await Promise.all([
      Company.find()
        .select("-__v") // Исключаем версию документа
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean()
        .exec(),
      Company.countDocuments(),
    ]);

    // Преобразуем в формат фронтенда
    const companiesData = companies.map((company) => ({
      id: company._id.toString(),
      ...company,
      _id: undefined,
    }));

    res.json({
      success: true,
      data: companiesData,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  },
);

export const getCompanyById = asyncHandler(
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

    // Преобразуем в формат фронтенда (с числовым ID)
    const companyData = {
      id: company._id.toString(),
      ...company.toObject(),
      _id: undefined,
    };

    res.json({
      success: true,
      data: companyData,
    });
  },
);

export const getCompanyByCode = asyncHandler(
  async (req: Request, res: Response) => {
    const { code } = req.params;

    const company = await Company.findOne({ code: code.toUpperCase() });
    if (!company) {
      throw new AppError("Company not found", 404, ErrorCode.NOT_FOUND);
    }

    const companyData = {
      id: company._id.toString(),
      ...company.toObject(),
      _id: undefined,
    };

    res.json({
      success: true,
      data: companyData,
    });
  },
);

/**
 * Получить список публичных компаний для sitemap и SEO
 * Возвращает только публичные поля: code, name, status, updatedAt
 */
export const getPublicCompanies = asyncHandler(
  async (_req: Request, res: Response) => {
    // Получаем только активные компании (не заблокированные)
    const companies = await Company.find({ status: { $ne: "Заблокирована" } })
      .select("code name status updatedAt createdAt")
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    // Преобразуем в формат фронтенда
    const companiesData = companies.map((company) => ({
      id: company._id.toString(),
      code: company.code,
      name: company.name,
      status: company.status,
      updatedAt: company.updatedAt,
      createdAt: company.createdAt,
    }));

    res.json({
      success: true,
      data: companiesData,
    });
  },
);

export const createCompany = asyncHandler(
  async (req: Request, res: Response) => {
    // Только админы могут создавать компании
    if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
      throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
    }

    const body = req.body as {
      name?: string;
      code?: string;
      adminEmail?: string;
      password?: string;
      plan?: string;
      employees?: number;
      messagesLimit?: number;
      storageLimit?: number;
    };
    const {
      name,
      code,
      adminEmail,
      password,
      plan,
      employees,
      messagesLimit,
      storageLimit,
    } = body;

    const normalizedName = name ? String(name).trim() : "";
    const normalizedCode = code ? String(code).toUpperCase() : "";
    const normalizedEmail = adminEmail
      ? String(adminEmail).toLowerCase().trim()
      : "";
    const normalizedPassword = password ? String(password) : "";

    if (
      !normalizedName ||
      !normalizedCode ||
      !normalizedEmail ||
      !normalizedPassword
    ) {
      throw new AppError(
        "Name, code, adminEmail, and password are required",
        400,
        ErrorCode.BAD_REQUEST,
      );
    }

    // Валидация пароля выполняется через Zod schema (createCompanySchema)

    // Проверяем, не существует ли компания уже (код, email, имя) — делаем создание идемпотентным
    const existingCompany =
      (await Company.findOne({ code: normalizedCode })) ||
      (await Company.findOne({ adminEmail: normalizedEmail })) ||
      (await Company.findOne({ name: normalizedName }));

    if (existingCompany) {
      const companyData = {
        id: existingCompany._id.toString(),
        ...existingCompany.toObject(),
        _id: undefined,
      };

      res.json({
        success: true,
        data: companyData,
        message:
          "Company already exists. Returning existing company (idempotent create).",
      });
      return;
    }

    // Проверяем, не существует ли пользователь с таким email — если есть и привязан к другой компании, отдаем конфликт
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });
    if (
      existingUser &&
      existingUser.companyId &&
      existingUser.companyId.toString() !== ""
    ) {
      throw new AppError(
        "User with this email already exists",
        409,
        ErrorCode.CONFLICT,
      );
    }

    // Проверяем, не существует ли админ с таким email
    const existingAdmin = await AdminUser.findOne({
      email: normalizedEmail,
    });
    if (existingAdmin) {
      throw new AppError(
        "Admin with this email already exists",
        409,
        ErrorCode.CONFLICT,
      );
    }

    const registeredDate = new Date().toISOString().split("T")[0];
    const selectedPlan = plan || "Пробный";
    const isTrialPlan = selectedPlan === "Пробный";
    let trialEndDate: string | undefined;

    if (isTrialPlan) {
      // Получаем настройки пробного периода из БД
      let freePlanSettings = await FreePlanSettings.findOne({
        settingsId: "default",
      });
      if (!freePlanSettings) {
        freePlanSettings = await FreePlanSettings.create({ settingsId: "default" });
      }

      const endDate = new Date(registeredDate);
      endDate.setDate(endDate.getDate() + freePlanSettings.freePeriodDays);
      trialEndDate = endDate.toISOString().split("T")[0];
    }

    let company;
    try {
      company = await Company.create({
        name: normalizedName,
        code: normalizedCode,
        adminEmail: normalizedEmail,
        status: "Активна",
        plan: selectedPlan,
        registered: registeredDate,
        trialEndDate,
        employees: employees || 0,
        messages: 0,
        messagesThisMonth: 0,
        messagesLimit: isTrialPlan ? 999999 : messagesLimit || 10,
        storageUsed: 0,
        storageLimit: isTrialPlan ? 999999 : storageLimit || 1,
      });
    } catch (createError: unknown) {
      const error = createError as { code?: number; message?: string };
      if (
        error?.code === 11000 ||
        (error?.message && error.message.includes("duplicate")) ||
        (error?.message && error.message.includes("E11000"))
      ) {
        const dupCompany =
          (await Company.findOne({ code: normalizedCode })) ||
          (await Company.findOne({ adminEmail: normalizedEmail })) ||
          (await Company.findOne({ name: normalizedName }));

        if (dupCompany) {
          const companyData = {
            id: dupCompany._id.toString(),
            ...dupCompany.toObject(),
            _id: undefined,
          };

          res.json({
            success: true,
            data: companyData,
            message:
              "Company already exists (race condition). Returning existing.",
          });
          return;
        }
      }
      throw createError;
    }

    // Создаем пользователя для компании с указанным паролем
    const hashedPassword = await hashPassword(normalizedPassword);

    // Создаем или обновляем пользователя под эту компанию (идемпотентно)
    const user = await User.findOne({ email: normalizedEmail });
    if (user) {
      let shouldSave = false;
      if (
        !user.companyId ||
        user.companyId.toString() !== company._id.toString()
      ) {
        user.companyId = company._id;
        shouldSave = true;
      }
      if (user.role !== "company") {
        user.role = "company";
        shouldSave = true;
      }
      const desiredName = `${normalizedName} Admin`;
      if (desiredName && user.name !== desiredName) {
        user.name = desiredName;
        shouldSave = true;
      }
      // При создании через админ-панель email считается верифицированным
      if (!user.isVerified) {
        user.isVerified = true;
        shouldSave = true;
      }
      if (shouldSave) {
        await user.save();
      }
    } else {
      await User.create({
        email: normalizedEmail,
        password: hashedPassword,
        role: "company",
        companyId: company._id,
        name: `${normalizedName} Admin`,
        isVerified: true, // При создании через админ-панель email считается верифицированным
      });
    }

    const companyData = {
      id: company._id.toString(),
      ...company.toObject(),
      _id: undefined,
    };

    // Инвалидируем кэш планов, так как статистика изменилась
    void cache.delete("plans:all");

    res.status(201).json({
      success: true,
      data: companyData,
    });
    return;
  },
);

export const updateCompany = asyncHandler(
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

    const updates = req.body as {
      code?: string;
      adminEmail?: string;
      name?: string;
      status?: string;
      plan?: string;
      employees?: number;
      messagesLimit?: number;
      storageLimit?: number;
      logoUrl?: string;
      fullscreenMode?: boolean;
      supportWhatsApp?: string;
    };
    if (updates.code && typeof updates.code === "string") {
      updates.code = updates.code.toUpperCase();
    }
    if (updates.adminEmail && typeof updates.adminEmail === "string") {
      const normalizedNewEmail = updates.adminEmail.toLowerCase().trim();

      // Проверяем, не используется ли новый email админом (если email меняется)
      if (normalizedNewEmail !== company.adminEmail.toLowerCase()) {
        const existingAdmin = await AdminUser.findOne({
          email: normalizedNewEmail,
        });
        if (existingAdmin) {
          throw new AppError(
            "Admin with this email already exists",
            409,
            ErrorCode.CONFLICT,
          );
        }

        // Проверяем, не используется ли новый email другой компанией
        const existingCompanyWithEmail = await Company.findOne({
          adminEmail: normalizedNewEmail,
          _id: { $ne: company._id }, // Исключаем текущую компанию
        });
        if (existingCompanyWithEmail) {
          throw new AppError(
            "Company with this email already exists",
            409,
            ErrorCode.CONFLICT,
          );
        }
      }

      // Обновляем email в User модели, чтобы пользователь мог логиниться с новым email
      const companyUser = await User.findOne({
        companyId: company._id,
        role: "company",
      });
      if (companyUser) {
        // Проверяем, не занят ли email другим пользователем
        const existingUser = await User.findOne({
          email: normalizedNewEmail,
          _id: { $ne: companyUser._id },
        });
        if (existingUser) {
          throw new AppError(
            "User with this email already exists",
            409,
            ErrorCode.CONFLICT,
          );
        }
        companyUser.email = normalizedNewEmail;
        await companyUser.save();
      }

      updates.adminEmail = normalizedNewEmail;
    }

    // Валидация размера логотипа (base64 строка)
    if (
      updates.logoUrl &&
      typeof updates.logoUrl === "string" &&
      updates.logoUrl !== ""
    ) {
      // Проверяем, является ли это base64 строкой
      if (updates.logoUrl.startsWith("data:image/")) {
        // Примерный размер base64 строки (base64 увеличивает размер на ~33%)
        // Для изображения 200x200px сжатого до ~500KB, base64 будет ~667KB
        const base64Size = (updates.logoUrl.length * 3) / 4; // Размер в байтах
        const maxSizeBytes = 1024 * 1024; // 1MB максимум для base64 строки

        if (base64Size > maxSizeBytes) {
          throw new AppError(
            "Logo file is too large. Maximum size: 1MB",
            400,
            ErrorCode.BAD_REQUEST,
          );
        }
      }
    }

    // Если план обновляется и пользователь - админ, обновляем лимиты
    if (
      updates.plan &&
      typeof updates.plan === "string" &&
      (req.user?.role === "admin" || req.user?.role === "super_admin")
    ) {
      const plan = updates.plan;
      const isPlanTrial = await isTrialPlan(plan);

      // Ищем план в базе данных для получения лимитов
      const subscriptionPlan = await SubscriptionPlan.findOne({
        $or: [
          { "name.ru": plan },
          { "name.en": plan },
          { "name.kk": plan },
          { name: plan },
        ],
      });

      if (isPlanTrial) {
        // Для пробного/бесплатного плана устанавливаем неограниченные лимиты
        updates.messagesLimit = 999999;
        updates.storageLimit = 999999;
      } else if (subscriptionPlan) {
        // Обновляем лимиты из найденного плана
        updates.messagesLimit = subscriptionPlan.messagesLimit;
        updates.storageLimit = subscriptionPlan.storageLimit;
      }
    }

    // supportWhatsApp доступен для всех планов
    // Для Pro плана это приоритетная поддержка, для остальных - обычная

    Object.assign(company, updates);
    await company.save();

    const companyData = {
      id: company._id.toString(),
      ...company.toObject(),
      _id: undefined,
    };

    res.json({
      success: true,
      data: companyData,
    });
  },
);

export const updateCompanyStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body as { status?: string };
    const { status } = body;

    // Только админы могут менять статус
    if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
      throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
    }

    const company = await Company.findById(id);
    if (!company) {
      throw new AppError("Company not found", 404, ErrorCode.NOT_FOUND);
    }

    if (status && typeof status === "string") {
      company.status = status as "Активна" | "Пробная" | "Заблокирована";
    }
    await company.save();

    const companyData = {
      id: company._id.toString(),
      ...company.toObject(),
      _id: undefined,
    };

    res.json({
      success: true,
      data: companyData,
    });
  },
);

export const updateCompanyPlan = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body as { plan?: string; planEndDate?: string };
    const { plan, planEndDate } = body;

    // Только админы могут менять план
    if (req.user?.role !== "admin" && req.user?.role !== "super_admin") {
      throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
    }

    const company = await Company.findById(id);
    if (!company) {
      throw new AppError("Company not found", 404, ErrorCode.NOT_FOUND);
    }

    // Проверяем, является ли текущий план компании пробным/бесплатным
    const isCurrentPlanTrial = await isTrialPlan(company.plan);

    // Обычные админы не могут редактировать пробный/бесплатный план
    if (req.user?.role === "admin") {
      // Проверяем, если пытаются установить пробный/бесплатный план
      if (plan && typeof plan === "string") {
        const isNewPlanTrial = await isTrialPlan(plan);
        if (isNewPlanTrial) {
          throw new AppError(
            "Regular admins cannot edit trial/free plans",
            403,
            ErrorCode.FORBIDDEN,
          );
        }
      }

      // Проверяем, если пытаются изменить компанию с пробным/бесплатным планом
      // Разрешаем апгрейд с пробного на платный план (после оплаты)
      if (isCurrentPlanTrial) {
        const isNewPlanTrialCheck = plan ? await isTrialPlan(plan) : true;
        if (isNewPlanTrialCheck) {
          throw new AppError(
            "Regular admins cannot edit companies with trial/free plans",
            403,
            ErrorCode.FORBIDDEN,
          );
        }
        // Если новый план платный — разрешаем апгрейд
      }
    }

    const oldPlan = company.plan;

    if (plan && typeof plan === "string") {
      company.plan = plan;

      // Обновляем лимиты на основе нового плана
      const isPlanTrial = await isTrialPlan(plan);

      // Ищем план в базе данных для получения лимитов
      const subscriptionPlan = await SubscriptionPlan.findOne({
        $or: [
          { "name.ru": plan },
          { "name.en": plan },
          { "name.kk": plan },
          { name: plan },
        ],
      });

      if (isPlanTrial) {
        // Устанавливаем флаг, что пользователь использовал пробный тариф
        company.trialUsed = true;

        // Для пробного/бесплатного плана устанавливаем неограниченные лимиты
        company.messagesLimit = 999999;
        company.storageLimit = 999999;

        // Если trialEndDate не указан в запросе, устанавливаем его автоматически на основе настроек
        if (!planEndDate || typeof planEndDate !== "string") {
          // Получаем настройки пробного периода из БД
          let freePlanSettings = await FreePlanSettings.findOne({
            settingsId: "default",
          });
          if (!freePlanSettings) {
            freePlanSettings = await FreePlanSettings.create({ settingsId: "default" });
          }

          const startDate = company.registered
            ? new Date(company.registered)
            : new Date();
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + freePlanSettings.freePeriodDays);
          company.trialEndDate = endDate.toISOString().split("T")[0];
        }
      } else if (subscriptionPlan) {
        // Обновляем лимиты из найденного плана
        company.messagesLimit = subscriptionPlan.messagesLimit;
        company.storageLimit = subscriptionPlan.storageLimit;
      } else {
        // Если план не найден, используем дефолтные значения
        // Это может быть кастомный план или план с другим названием
        // Оставляем текущие лимиты или устанавливаем дефолтные
        if (!company.messagesLimit) {
          company.messagesLimit = 10;
        }
        if (!company.storageLimit) {
          company.storageLimit = 1;
        }
      }

      if (!isPlanTrial) {
        // Очищаем trialEndDate при переходе на платный план
        company.trialEndDate = undefined;
        company.status = "Активна" as any;

        // Устанавливаем дату окончания платного тарифа — 30 дней от текущей даты
        const planEnd = new Date();
        planEnd.setDate(planEnd.getDate() + 30);
        company.planEndDate = planEnd.toISOString().split("T")[0];

        // Сбрасываем счетчик сообщений за месяц
        company.messagesThisMonth = 0;
      } else {
        // Для пробного плана очищаем planEndDate
        company.planEndDate = undefined;
      }
    }

    if (planEndDate && typeof planEndDate === "string") {
      const endDate = new Date(planEndDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      if (endDate < today) {
        throw new AppError(
          "Plan end date cannot be in the past",
          400,
          ErrorCode.VALIDATION_ERROR,
        );
      }
      // Устанавливаем дату окончания в правильное поле в зависимости от типа плана
      const isPlanTrialForEndDate = plan ? await isTrialPlan(plan) : await isTrialPlan(company.plan);
      if (isPlanTrialForEndDate) {
        company.trialEndDate = planEndDate;
      } else {
        company.planEndDate = planEndDate;
      }
    }

    logger.info(`[CompanyController] Plan change: company=${id}, oldPlan="${oldPlan}" → newPlan="${plan}", by=${req.user?.role}(${req.user?.userId})`);

    await company.save();

    // Инвалидируем кэш планов, так как статистика изменилась
    void cache.delete("plans:all");

    const companyData = {
      id: company._id.toString(),
      ...company.toObject(),
      _id: undefined,
    };

    res.json({
      success: true,
      data: companyData,
    });
  },
);

export const verifyPaymentAndUpgrade = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body as { orderId?: string; planId?: string };
    const { orderId, planId } = body;

    logger.info(`[PayPal] verify-payment request: companyId=${id}, orderId=${orderId}, planId=${planId}`);

    if (!orderId || !planId) {
      throw new AppError(
        "orderId and planId are required",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // 1. Verify PayPal order
    let orderDetails;
    try {
      orderDetails = await verifyPayPalOrder(orderId);
    } catch (err: any) {
      logger.error(`[PayPal] Verification error for order ${orderId}: ${err.message}`);
      throw new AppError(
        `Payment verification failed: ${err.message}`,
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (orderDetails.status !== "COMPLETED") {
      throw new AppError(
        "Payment not completed",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // 2. Find the company
    const company = await Company.findById(id);
    if (!company) {
      throw new AppError("Company not found", 404, ErrorCode.NOT_FOUND);
    }

    // 3. Find the subscription plan (planId can be MongoDB _id or plan name/slug)
    const planRegex = new RegExp(`^${planId}$`, "i");
    let subscriptionPlan = await SubscriptionPlan.findById(planId).catch(() => null);
    if (!subscriptionPlan) {
      subscriptionPlan = await SubscriptionPlan.findOne({
        $or: [
          { "name.ru": planRegex },
          { "name.en": planRegex },
          { "name.kk": planRegex },
          { name: planRegex },
          { slug: planRegex },
        ],
      });
    }
    logger.info(`[PayPal] Plan lookup for "${planId}": ${subscriptionPlan ? `found "${subscriptionPlan.name}"` : "NOT FOUND"}`);
    if (!subscriptionPlan || subscriptionPlan.isFree) {
      throw new AppError("Invalid plan", 400, ErrorCode.VALIDATION_ERROR);
    }

    // 4. Verify payment amount
    const paidAmount = parseFloat(
      orderDetails.purchase_units?.[0]?.amount?.value || "0",
    );
    if (paidAmount < 1) {
      throw new AppError(
        "Invalid payment amount",
        400,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // 5. Update company plan
    const oldPlan = company.plan;
    const planName =
      typeof subscriptionPlan.name === "string"
        ? subscriptionPlan.name
        : subscriptionPlan.name?.ru ||
          subscriptionPlan.name?.en ||
          "";

    company.plan = planName;
    company.messagesLimit = subscriptionPlan.messagesLimit;
    company.storageLimit = subscriptionPlan.storageLimit;

    // Очищаем trialEndDate — платный план не ограничен пробным периодом
    company.trialEndDate = undefined;

    // Устанавливаем дату окончания платного тарифа — 30 дней от текущей даты
    const planEnd = new Date();
    planEnd.setDate(planEnd.getDate() + 30);
    company.planEndDate = planEnd.toISOString().split("T")[0];

    // Сбрасываем счетчик сообщений за месяц при покупке нового тарифа
    company.messagesThisMonth = 0;

    // Clear trial status
    company.status = "Активна" as "Активна" | "Пробная" | "Заблокирована";

    await company.save();

    // Invalidate cache
    void cache.delete("plans:all");

    // Log the change
    logger.info(
      `[PayPal] Plan upgraded: company=${id}, ${oldPlan} → ${planName}, orderId=${orderId}, amount=$${paidAmount}, planEndDate=${company.planEndDate}`,
    );

    res.json({
      success: true,
      message: "Plan upgraded successfully",
      plan: planName,
      orderId: orderDetails.id,
    });
  },
);

/**
 * Смена пароля компании (только суперадмин, без подтверждения старого пароля)
 */
export const updateCompanyPassword = asyncHandler(
  async (req: Request, res: Response) => {
    if (req.user?.role !== "super_admin") {
      throw new AppError("Access denied. Only super admins can change company password without confirmation.", 403, ErrorCode.FORBIDDEN);
    }

    const { id } = req.params;
    const body = req.body as { password?: string };
    const { password } = body;

    if (!password || typeof password !== "string" || password.trim().length < 8) {
      throw new AppError("Valid new password is required", 400, ErrorCode.BAD_REQUEST);
    }

    const company = await Company.findById(id);
    if (!company) {
      throw new AppError("Company not found", 404, ErrorCode.NOT_FOUND);
    }

    const user = await User.findOne({ companyId: company._id, role: "company" }).select("+password");
    if (!user) {
      throw new AppError("Company user not found", 404, ErrorCode.NOT_FOUND);
    }

    user.password = await hashPassword(password.trim());
    await user.save();

    res.json({
      success: true,
      message: "Company password updated successfully",
    });
  },
);

/**
 * Принудительное завершение пробного периода (только super_admin)
 * Устанавливает trialEndDate на вчерашнюю дату — эффект как при естественном истечении
 */
export const expireTrial = asyncHandler(
  async (req: Request, res: Response) => {
    if (req.user?.role !== "super_admin") {
      throw new AppError("Access denied. Only super admins can expire trial.", 403, ErrorCode.FORBIDDEN);
    }

    const { id } = req.params;
    const company = await Company.findById(id);
    if (!company) {
      throw new AppError("Company not found", 404, ErrorCode.NOT_FOUND);
    }

    const isTrial = await isTrialPlan(company.plan);
    if (!isTrial) {
      throw new AppError("Company is not on a trial plan", 400, ErrorCode.BAD_REQUEST);
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    company.trialEndDate = yesterday.toISOString().split("T")[0];
    await company.save();

    // Инвалидируем кэш
    void cache.delete("plans:all");

    logger.info(`[CompanyController] Trial expired manually: company=${id}, by=${req.user?.userId}`);

    res.json({
      success: true,
      message: "Trial period expired successfully",
      data: {
        id: company._id.toString(),
        ...company.toObject(),
        _id: undefined,
      },
    });
  },
);

export const deleteCompany = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const cleanId = id.trim();
    const body = req.body as { password?: string };
    const { password } = body;

    logger.info(
      `[CompanyController] DELETE request for company ID: ${cleanId}`,
    );

    // 1. Находим компанию
    const company = await Company.findById(cleanId).lean();
    if (!company) {
      logger.warn(`[CompanyController] Company with ID ${cleanId} not found`);
      throw new AppError("Company not found", 404, ErrorCode.NOT_FOUND);
    }

    // Проверка прав доступа:
    // - Системные админы могут удалять любую компанию (без проверки пароля)
    // - Администратор компании может удалить только свою компанию (с проверкой пароля)
    const isSystemAdmin =
      req.user?.role === "admin" || req.user?.role === "super_admin";
    const isCompanyAdmin =
      req.user?.role === "company" &&
      req.user?.companyId &&
      req.user.companyId.toString() === company._id.toString();

    if (!isSystemAdmin && !isCompanyAdmin) {
      throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
    }

    // Для администраторов компании требуется проверка пароля
    if (isCompanyAdmin && !isSystemAdmin) {
      if (!password) {
        throw new AppError(
          "Password is required to delete company",
          400,
          ErrorCode.BAD_REQUEST,
        );
      }

      // Находим пользователя компании для проверки пароля
      const user = await User.findById(req.user?.userId).select("+password");
      if (!user) {
        throw new AppError("User not found", 404, ErrorCode.NOT_FOUND);
      }

      // Проверяем пароль
      const { comparePassword } = await import("../utils/password");
      const isPasswordValid = await comparePassword(
        String(password),
        user.password,
      );
      if (!isPasswordValid) {
        throw new AppError("Invalid password", 401, ErrorCode.UNAUTHORIZED);
      }
    }

    const companyCode = company.code;
    const companyId = company._id.toString();

    logger.info(
      `[CompanyController] Deleting company: ${company.name} (code: ${companyCode}, id: ${companyId})`,
    );

    // 2. Удаляем все сообщения компании по companyCode
    const messagesResult = await Message.deleteMany({ companyCode });
    logger.info(
      `[CompanyController] Deleted ${messagesResult.deletedCount} messages for company ${companyCode}`,
    );

    // 3. Удаляем всех пользователей компании по companyId
    const usersResult = await User.deleteMany({ companyId: company._id });
    logger.info(
      `[CompanyController] Deleted ${usersResult.deletedCount} users for company ${companyId}`,
    );

    // 4. Удаляем компанию по ID
    await Company.findByIdAndDelete(cleanId);

    // Инвалидируем кэш планов, так как статистика изменилась
    void cache.delete("plans:all");

    logger.info(
      `[CompanyController] Successfully deleted company ${company.name} (${companyCode})`,
    );

    res.json({
      success: true,
      message: "Company deleted successfully",
    });
  },
);
