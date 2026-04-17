import { Request, Response } from "express";
import { Types } from "mongoose";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError, ErrorCode } from "../utils/AppError";
import { User } from "../models/User";
import { Company } from "../models/Company";
import { AdminSettings } from "../models/AdminSettings";
import { AdminUser } from "../models/AdminUser";
import { FreePlanSettings } from "../models/FreePlanSettings";
import {
  hashPassword,
  comparePassword,
  generateResetToken,
  hashResetToken,
  generateDailyPassword,
} from "../utils/password";
import { generateToken } from "../utils/jwt";
import { logger } from "../utils/logger";
import { emailService } from "../services/emailService";
import { config } from "../config/env";

/** Выбросить ошибку COMPANY_BLOCKED с номером WhatsApp поддержки (если указан админом) */
async function throwCompanyBlocked(): Promise<never> {
  const settings = await AdminSettings.findOne({
    supportWhatsAppNumber: { $exists: true, $ne: "" },
  })
    .sort({ updatedAt: -1 })
    .select("supportWhatsAppNumber")
    .lean()
    .exec();
  const num = settings?.supportWhatsAppNumber?.trim() || "";
  const message = num ? `COMPANY_BLOCKED|${num}` : "COMPANY_BLOCKED";
  throw new AppError(message, 403, ErrorCode.FORBIDDEN);
}

/**
 * Вход в систему (для доступа в панель управления компанией)
 * Использует ТОЛЬКО постоянный пароль, установленный пользователем при создании компании
 * Ежедневный пароль здесь НЕ используется
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { email?: string; password?: string };
  const { email, password } = body;

  if (!email || !password) {
    throw new AppError(
      "Email and password are required",
      400,
      ErrorCode.BAD_REQUEST,
    );
  }

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new AppError(
      "Invalid email or password",
      401,
      ErrorCode.UNAUTHORIZED,
    );
  }

  // Проверяем ТОЛЬКО постоянный пароль из БД (для входа в систему)
  const isPasswordValid = await comparePassword(
    String(password),
    user.password,
  );
  if (!isPasswordValid) {
    throw new AppError(
      "Invalid email or password",
      401,
      ErrorCode.UNAUTHORIZED,
    );
  }

  // Проверяем, заблокирована ли компания (для пользователей с ролью company)
  if (user.role === "company" && user.companyId) {
    const company = await Company.findById(user.companyId);
    if (company && company.status === "Заблокирована") {
      await throwCompanyBlocked();
    }
  }

  // Обновляем lastLogin
  user.lastLogin = new Date();
  await user.save();

  const token = generateToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role.toLowerCase(),
    companyId: user.companyId?.toString(),
  });

  res.json({
    success: true,
    data: {
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role.toLowerCase(),
        companyId: user.companyId,
        name: user.name,
      },
      token,
    },
  });
});

export const register = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    email?: string;
    password?: string;
    name?: string;
    role?: string;
    companyName?: string;
    companyCode?: string;
  };
  const {
    email,
    password,
    name,
    role = "user",
    companyName,
    companyCode,
  } = body;

  if (!email || !password) {
    throw new AppError(
      "Email and password are required",
      400,
      ErrorCode.BAD_REQUEST,
    );
  }

  // Проверяем, существует ли пользователь с таким email
  const existingUser = await User.findOne({
    email: String(email).toLowerCase(),
  });

  if (existingUser) {
    // Если пользователь существует, но имеет роль 'user' и мы регистрируем компанию
    // Значит это "пустой" аккаунт (например, от OAuth или старый), который хочет стать компанией.
    // Мы можем разрешить это, но нужно убедиться, что это не админ или уже существующая компания.
    // role берется из body, при регистрации компании она равна 'company'
    if (
      existingUser.role === "user" &&
      !existingUser.companyId &&
      role === "company"
    ) {
      // Удаляем "пустого" пользователя, чтобы создать нового с правильными данными компании
      await User.deleteOne({ _id: existingUser._id });
    } else {
      throw new AppError("User already exists", 409, ErrorCode.CONFLICT);
    }
  }

  // Проверяем, не существует ли админ с таким email
  const existingAdmin = await AdminUser.findOne({
    email: String(email).toLowerCase(),
  });
  if (existingAdmin) {
    throw new AppError(
      "Admin with this email already exists",
      409,
      ErrorCode.CONFLICT,
    );
  }

  const hashedPassword = await hashPassword(String(password));

  let companyId: string | undefined;

  // Если регистрация компании, создаем компанию
  if (role === "company" && companyName && companyCode) {
    // Генерируем и нормализуем код компании
    const normalizeCode = (code: string) => String(code).toUpperCase();
    const generateRandomCode = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let result = "";
      for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    let finalCompanyCode = normalizeCode(companyCode);

    // Гарантируем уникальность кода компании.
    // Пользователь код не выбирает, поэтому при конфликте просто генерируем новый.
    // Делаем ограниченное количество попыток, чтобы не попасть в бесконечный цикл.
    const MAX_CODE_ATTEMPTS = 5;
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const existingCompanyByCode = await Company.findOne({
        code: finalCompanyCode,
      });

      if (!existingCompanyByCode) {
        break;
      }

      // Если код занят, пробуем сгенерировать новый
      finalCompanyCode = generateRandomCode();
    }

    // Финальная проверка — если даже после нескольких попыток код занят, отдаём понятную ошибку
    const existingCompanyByFinalCode = await Company.findOne({
      code: finalCompanyCode,
    });
    if (existingCompanyByFinalCode) {
      throw new AppError(
        "Company with this code already exists",
        409,
        ErrorCode.CONFLICT,
      );
    }

    // Проверяем, не существует ли компания с таким именем
    const existingCompanyByName = await Company.findOne({
      name: String(companyName).trim(),
    });
    if (existingCompanyByName) {
      throw new AppError(
        "Company with this name already exists",
        409,
        ErrorCode.CONFLICT,
      );
    }

    // Проверяем, не существует ли компания с таким email администратора
    const existingCompanyByEmail = await Company.findOne({
      adminEmail: String(email).toLowerCase(),
    });
    if (existingCompanyByEmail) {
      throw new AppError(
        "Company with this email already exists",
        409,
        ErrorCode.CONFLICT,
      );
    }

    const registeredDate = new Date().toISOString().split("T")[0];

    // Получаем настройки пробного периода из БД
    let freePlanSettings = await FreePlanSettings.findOne({
      settingsId: "default",
    });
    if (!freePlanSettings) {
      freePlanSettings = await FreePlanSettings.create({ settingsId: "default" });
    }

    const trialEndDate = new Date();
    trialEndDate.setDate(
      trialEndDate.getDate() + freePlanSettings.freePeriodDays,
    );

    const company = await Company.create({
      name: String(companyName),
      code: finalCompanyCode,
      adminEmail: String(email).toLowerCase(),
      status: "Активна",
      plan: "Пробный",
      registered: registeredDate,
      trialEndDate: trialEndDate.toISOString().split("T")[0],
      trialUsed: true, // Устанавливаем флаг, что пользователь использовал пробный тариф
      employees: 0,
      messages: 0,
      messagesThisMonth: 0,
      messagesLimit: 999999,
      storageUsed: 0,
      storageLimit: 999999,
    });

    companyId = company._id.toString();
  }

  const user = await User.create({
    email: String(email).toLowerCase(),
    password: hashedPassword,
    name: name || companyName,
    role,
    companyId: companyId ? (companyId as unknown as Types.ObjectId) : undefined,
    isVerified: true,
  });

  // Сразу генерируем JWT токен для автоматического входа после регистрации
  const token = generateToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role.toLowerCase(),
    companyId: user.companyId?.toString(),
  });

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        name: user.name,
      },
      token,
    },
    message: "Registration successful.",
  });
});

// Verify email handler
const verifyEmailHandler = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { token?: string };
  const { token } = body;

  if (!token) {
    throw new AppError(
      "Verification token is required",
      400,
      ErrorCode.BAD_REQUEST,
    );
  }

  const hashedToken = hashResetToken(token);

  const user = await User.findOne({
    verificationToken: hashedToken,
  });

  if (!user) {
    throw new AppError(
      "Invalid or expired verification token",
      400,
      ErrorCode.BAD_REQUEST,
    );
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  await user.save();

  // После подтверждения сразу логиним пользователя
  const jwtToken = generateToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role.toLowerCase(),
    companyId: user.companyId?.toString(),
  });

  res.json({
    success: true,
    data: {
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role.toLowerCase(),
        companyId: user.companyId,
        name: user.name,
      },
      token: jwtToken,
    },
    message: "Email verified successfully",
  });
});

export const verifyEmail = verifyEmailHandler;

export const verifyPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as { code?: string; password?: string };
    const { code, password } = body;

    if (!code || !password) {
      throw new AppError(
        "Code and password are required",
        400,
        ErrorCode.BAD_REQUEST,
      );
    }

    const company = await Company.findOne({ code });
    if (!company) {
      throw new AppError("Company not found", 404, ErrorCode.NOT_FOUND);
    }

    // Находим пользователя компании
    const user = await User.findOne({
      companyId: company._id,
      role: "company",
    }).select("+password");
    if (!user) {
      throw new AppError("Company user not found", 404, ErrorCode.NOT_FOUND);
    }

    /**
     * Проверка пароля для отправки анонимных сообщений
     * Принимает ДВА типа паролей:
     * 1. Ежедневный пароль - генерируется автоматически каждый день на основе даты (UTC)
     *    Используется сотрудниками для отправки анонимных сообщений
     *    Обновляется автоматически каждый день в полночь UTC
     * 2. Постоянный пароль - пароль компании из БД
     *    Может использоваться как альтернатива ежедневному паролю
     */
    // Генерируем ежедневный пароль на основе текущей даты (UTC)
    const dailyPassword = generateDailyPassword(10);
    const isDailyPassword = password === dailyPassword;

    // Проверяем постоянный пароль из БД
    const isStoredPasswordValid = await comparePassword(
      String(password),
      user.password,
    );

    // Принимаем любой из двух паролей
    const isPasswordValid = isDailyPassword || isStoredPasswordValid;

    res.json({
      success: true,
      data: {
        isValid: isPasswordValid,
      },
    });
  },
);

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError("Not authenticated", 401, ErrorCode.UNAUTHORIZED);
  }

  const user = await User.findById(req.user.userId);
  if (!user) {
    throw new AppError("User not found", 404, ErrorCode.NOT_FOUND);
  }

  // Проверяем, заблокирована ли компания (для пользователей с ролью company)
  if (user.role === "company" && user.companyId) {
    const company = await Company.findById(user.companyId);
    if (company && company.status === "Заблокирована") {
      await throwCompanyBlocked();
    }
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        name: user.name,
        lastLogin: user.lastLogin,
      },
    },
  });
});

export const forgotPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as { email?: string };
    const { email } = body;

    if (!email) {
      throw new AppError("Email is required", 400, ErrorCode.BAD_REQUEST);
    }

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) {
      // Для безопасности не сообщаем, существует ли пользователь
      logger.info(`Password reset requested for non-existent email: ${email}`);
      res.json({
        success: true,
        message: "If the email exists, a password reset link has been sent",
      });
      return;
    }

    // Генерируем токен сброса пароля
    const resetToken = generateResetToken();
    const hashedToken = hashResetToken(resetToken);

    // Сохраняем токен и время истечения (1 час)
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 час
    await user.save();

    // Отправляем email восстановления пароля с бэкенда (синхронно, чтобы знать результат)
    const resetUrl = `${config.frontendUrl}/reset-password?token=${resetToken}`;

    try {
      await emailService.sendPasswordResetEmail(
        String(email).toLowerCase(),
        resetToken,
        resetUrl,
      );
      logger.info(`Password reset email sent to ${email}`);

      return res.json({
        success: true,
        message: "If the email exists, a password reset link has been sent",
      });
    } catch (error) {
      logger.error(`Failed to send password reset email to ${email}:`, error);

      // Получаем номер WhatsApp поддержки из настроек админа
      const settings = await AdminSettings.findOne({
        supportWhatsAppNumber: { $exists: true, $ne: "" },
      })
        .sort({ updatedAt: -1 })
        .select("supportWhatsAppNumber")
        .lean()
        .exec();
      const supportNumber = settings?.supportWhatsAppNumber?.trim() || "";

      const message = supportNumber
        ? `EMAIL_SEND_FAILED|${supportNumber}`
        : "EMAIL_SEND_FAILED";

      throw new AppError(message, 503, ErrorCode.INTERNAL_ERROR);
    }
  },
);

export const resetPassword = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as { token?: string; password?: string };
    const { token, password } = body;

    if (!token || !password) {
      throw new AppError(
        "Token and password are required",
        400,
        ErrorCode.BAD_REQUEST,
      );
    }

    // Валидация пароля выполняется через Zod schema (resetPasswordSchema)

    const hashedToken = hashResetToken(String(token));

    // Находим пользователя с валидным токеном
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    }).select("+resetPasswordToken +resetPasswordExpires");

    if (!user) {
      throw new AppError(
        "Invalid or expired reset token",
        400,
        ErrorCode.BAD_REQUEST,
      );
    }

    // Обновляем пароль
    const hashedPassword = await hashPassword(String(password));
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Password has been reset successfully",
    });
  },
);

export const changeEmail = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError(
      "Authentication required. Please log in to change your email.",
      401,
      ErrorCode.UNAUTHORIZED,
    );
  }

  const body = req.body as { newEmail?: string; password?: string };
  const newEmail = typeof body.newEmail === "string" ? body.newEmail.trim() : "";
  const { password } = body;

  if (!newEmail || !password) {
    throw new AppError(
      "Both new email address and current password are required to change your email. Please fill in all fields.",
      400,
      ErrorCode.BAD_REQUEST,
    );
  }

  // Валидация email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(newEmail)) {
    throw new AppError(
      "The email address format is incorrect. Please enter a valid email address (e.g., user@example.com).",
      400,
      ErrorCode.BAD_REQUEST,
    );
  }

  // Получаем пользователя с паролем
  const user = await User.findById(req.user.userId).select("+password");
  if (!user) {
    throw new AppError(
      "User account not found. Please try logging in again.",
      404,
      ErrorCode.NOT_FOUND,
    );
  }

  // Проверяем текущий пароль
  const isPasswordValid = await comparePassword(
    String(password),
    user.password,
  );
  if (!isPasswordValid) {
    throw new AppError(
      "The current password you entered is incorrect. Please check your password and try again. Make sure Caps Lock is off and you are using the correct password.",
      401,
      ErrorCode.UNAUTHORIZED,
    );
  }

  // Проверяем, что новый email отличается от текущего
  if (user.email.toLowerCase() === newEmail.toLowerCase()) {
    throw new AppError(
      "The new email address must be different from your current email address. Please enter a different email.",
      400,
      ErrorCode.BAD_REQUEST,
    );
  }

  // Проверяем, что новый email не занят в User
  const existingUser = await User.findOne({ email: newEmail.toLowerCase() });
  if (existingUser) {
    throw new AppError(
      "This email address is already registered to another account. Please choose a different email address.",
      400,
      ErrorCode.BAD_REQUEST,
    );
  }

  // Проверяем, что новый email не занят в AdminUser (если пользователь админ)
  if (user.role === "admin" || user.role === "super_admin") {
    const AdminUserModel = (await import("../models/AdminUser")).AdminUser;
    const existingAdmin = await AdminUserModel.findOne({
      email: newEmail.toLowerCase(),
    });
    if (
      existingAdmin &&
      existingAdmin.email.toLowerCase() !== user.email.toLowerCase()
    ) {
      throw new AppError(
        "This email address is already registered to another admin account. Please choose a different email address.",
        400,
        ErrorCode.BAD_REQUEST,
      );
    }
  }

  // Обновляем email в User
  const oldEmail = user.email;
  user.email = newEmail.toLowerCase();
  await user.save();

  // Если пользователь админ или суперадмин, обновляем email в AdminUser
  if (user.role === "admin" || user.role === "super_admin") {
    const AdminUserModel = (await import("../models/AdminUser")).AdminUser;
    const adminUser = await AdminUserModel.findOne({
      email: oldEmail.toLowerCase(),
    });
    if (adminUser) {
      adminUser.email = newEmail.toLowerCase();
      await adminUser.save();
    }
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        name: user.name,
        lastLogin: user.lastLogin,
      },
    },
    message: "Email has been changed successfully",
  });
});

export const changePassword = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(
        "Authentication required. Please log in to change your password.",
        401,
        ErrorCode.UNAUTHORIZED,
      );
    }

    const body = req.body as { currentPassword?: string; newPassword?: string };
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      throw new AppError(
        "Both current password and new password are required to change your password. Please fill in all fields.",
        400,
        ErrorCode.BAD_REQUEST,
      );
    }

    // Валидация пароля выполняется через Zod schema (changePasswordSchema)

    // Получаем пользователя с паролем
    const user = await User.findById(req.user.userId).select("+password");
    if (!user) {
      throw new AppError(
        "User account not found. Please try logging in again.",
        404,
        ErrorCode.NOT_FOUND,
      );
    }

    // Проверяем текущий пароль
    const isPasswordValid = await comparePassword(
      String(currentPassword),
      user.password,
    );
    if (!isPasswordValid) {
      throw new AppError(
        "The current password you entered is incorrect. Please check your password and try again. Make sure Caps Lock is off and you are using the correct password.",
        401,
        ErrorCode.UNAUTHORIZED,
      );
    }

    // Проверяем, что новый пароль отличается от текущего
    const isSamePassword = await comparePassword(
      String(newPassword),
      user.password,
    );
    if (isSamePassword) {
      throw new AppError(
        "The new password must be different from your current password. Please choose a different password.",
        400,
        ErrorCode.BAD_REQUEST,
      );
    }

    // Хешируем и сохраняем новый пароль
    const hashedPassword = await hashPassword(String(newPassword));
    user.password = hashedPassword;
    await user.save();

    res.json({
      success: true,
      message: "Password has been changed successfully",
    });
  },
);

/**
 * OAuth синхронизация - создает/обновляет пользователя после OAuth входа
 * Используется NextAuth для создания пользователя в БД
 */
export const oauthSync = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    email?: string;
    name?: string;
    provider?: string;
    providerId?: string;
  };
  const { email, name } = body;
  // provider и providerId доступны в body, но не используются в текущей реализации

  if (!email) {
    throw new AppError("Email is required", 400, ErrorCode.BAD_REQUEST);
  }

  const normalizedEmail = String(email).toLowerCase();

  // Ищем существующего пользователя
  let user = await User.findOne({ email: normalizedEmail });

  if (user) {
    // Если пользователь существует, проверяем его роль
    // Система разрешает вход только для admin, super_admin и company
    // Если роль 'user', проверяем, может быть это админ или компания, которая была неправильно зарегистрирована
    if (user.role === "user") {
      const adminUser = await AdminUser.findOne({ email: normalizedEmail });
      const company = await Company.findOne({ adminEmail: normalizedEmail });

      if (adminUser) {
        user.role = adminUser.role as "admin" | "super_admin";
        if (name) user.name = name;
        await user.save();
      } else if (company) {
        user.role = "company";
        user.companyId = company._id;
        if (name) user.name = name;
        await user.save();
      } else {
        // Если это просто user без привязки к компании/админу - удаляем пользователя и запрещаем вход
        // Это позволит пользователю зарегистрироваться заново как компания
        await User.deleteOne({ _id: user._id });
        throw new AppError(
          "User not registered. Please register as a company or ask an administrator.",
          403,
          ErrorCode.FORBIDDEN,
        );
      }
    } else {
      // Обновляем lastLogin и имя для существующих корректных пользователей
      user.lastLogin = new Date();
      if (name && user.name !== name) {
        user.name = name;
      }
      await user.save();
    }
  } else {
    // Проверяем, существует ли этот email в админах или компаниях
    const adminUser = await AdminUser.findOne({ email: normalizedEmail });
    const company = await Company.findOne({ adminEmail: normalizedEmail });

    if (adminUser) {
      // Это админ, создаем пользователя
      const randomPassword = generateResetToken();
      const hashedPassword = await hashPassword(randomPassword);
      user = await User.create({
        email: normalizedEmail,
        password: hashedPassword,
        name: name || adminUser.name,
        role: adminUser.role, // "admin" или "super_admin"
      });
    } else if (company) {
      // Это компания, создаем пользователя
      const randomPassword = generateResetToken();
      const hashedPassword = await hashPassword(randomPassword);
      user = await User.create({
        email: normalizedEmail,
        password: hashedPassword,
        name: name || company.name,
        role: "company",
        companyId: company._id,
      });
    } else {
      // Если пользователь не найден нигде - запрещаем вход
      throw new AppError(
        "User not registered. Please register as a company or ask an administrator.",
        403,
        ErrorCode.FORBIDDEN,
      );
    }
  }

  // Проверяем, заблокирована ли компания (для пользователей с ролью company)
  if (user.role === "company" && user.companyId) {
    const company = await Company.findById(user.companyId);
    if (company && company.status === "Заблокирована") {
      await throwCompanyBlocked();
    }
  }

  // Генерируем JWT токен
  const token = generateToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role.toLowerCase(),
    companyId: user.companyId?.toString(),
  });

  res.json({
    success: true,
    data: {
      user: {
        id: user._id.toString(),
        email: user.email,
        role: user.role.toLowerCase(),
        companyId: user.companyId,
        name: user.name,
      },
      token,
    },
  });
});

/**
 * Временный эндпоинт для обновления роли текущего пользователя на super_admin
 * ТОЛЬКО ДЛЯ РАЗРАБОТКИ - удалить в production!
 */
export const promoteToSuperAdmin = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError("Not authenticated", 401, ErrorCode.UNAUTHORIZED);
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      throw new AppError("User not found", 404, ErrorCode.NOT_FOUND);
    }

    // Обновляем роль на super_admin
    user.role = "super_admin";
    await user.save();

    // Обновляем или создаем AdminUser
    const adminUser = await AdminUser.findOne({
      email: user.email.toLowerCase(),
    });
    if (adminUser) {
      adminUser.role = "super_admin";
      await adminUser.save();
    } else {
      const createdAt = new Date().toISOString().split("T")[0];
      await AdminUser.create({
        email: user.email.toLowerCase(),
        name: user.name || user.email.split("@")[0],
        role: "super_admin",
        createdAt,
      });
    }

    // Генерируем новый токен с обновленной ролью
    const token = generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      companyId: user.companyId?.toString(),
    });

    res.json({
      success: true,
      message: "Role updated to super_admin",
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          companyId: user.companyId,
          name: user.name,
        },
        token,
      },
    });
  },
);
