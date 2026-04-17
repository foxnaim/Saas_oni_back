import { Request, Response } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import { AppError, ErrorCode } from "../utils/AppError";
import { AdminUser } from "../models/AdminUser";
import { User } from "../models/User";
import { Company } from "../models/Company";
import { hashPassword, generateSecurePassword } from "../utils/password";
import { emailService } from "../services/emailService";
import { logger } from "../utils/logger";

export const getAdmins = asyncHandler(async (req: Request, res: Response) => {
  // Только суперадмины могут видеть всех админов
  if (req.user?.role !== "super_admin") {
    throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
  }

  // Отключаем кэширование на уровне HTTP
  res.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");

  const { page, limit } = req.query;

  // Пагинация
  const pageNumber = page && typeof page === "string" ? parseInt(page, 10) : 1;
  const pageSize =
    limit && typeof limit === "string" ? parseInt(limit, 10) : 50;
  const skip = (pageNumber - 1) * pageSize;

  // Оптимизация: выполняем запросы параллельно для максимальной скорости
  const [admins, total] = await Promise.all([
    AdminUser.find()
      .select("-__v") // Исключаем версию документа
      .sort({ createdAt: -1 }) // Использует индекс createdAt: -1
      .skip(skip)
      .limit(pageSize)
      .lean() // lean() для быстрого получения простых объектов без overhead Mongoose
      .readConcern("majority") // Читаем с majority для консистентности
      .exec(),
    AdminUser.countDocuments().exec(), // Параллельно считаем total
  ]);

  res.json({
    success: true,
    data: admins,
    pagination: {
      page: pageNumber,
      limit: pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
});

export const createAdmin = asyncHandler(async (req: Request, res: Response) => {
  // Только суперадмины могут создавать админов
  if (req.user?.role !== "super_admin") {
    throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
  }

  const body = req.body as {
    email?: string;
    name?: string;
    role?: string;
    password?: string;
  };
  const { email, name, role = "admin", password } = body;

  if (!email) {
    throw new AppError("Email is required", 400, ErrorCode.BAD_REQUEST);
  }

  // Нормализуем email для проверки
  const normalizedEmail = String(email).toLowerCase().trim();
  // name опционален: если не передан, используем email как имя; если пустой после trim — fallback на email
  const normalizedNameCandidate = name ? String(name).trim() : "";
  const normalizedName =
    normalizedNameCandidate && normalizedNameCandidate.length > 0
      ? normalizedNameCandidate
      : normalizedEmail.split("@")[0];

  // Если админ уже есть — возвращаем его (идемпотентность создания)
  const existingAdmin = await AdminUser.findOne({ email: normalizedEmail });
  if (existingAdmin) {
    logger.info(
      `Admin with email ${normalizedEmail} already exists. Returning existing admin (idempotent create).`,
    );
    return res.json({
      success: true,
      data: existingAdmin,
    });
  }

  // Проверяем, не существует ли компания с таким email (оставляем как конфликт)
  const existingCompany = await Company.findOne({
    adminEmail: normalizedEmail,
  });
  if (existingCompany) {
    logger.warn(
      `Attempt to create admin with existing company email: ${normalizedEmail}`,
    );
    throw new AppError(
      "Company with this email already exists",
      409,
      ErrorCode.CONFLICT,
    );
  }

  const createdAt = new Date().toISOString().split("T")[0];

  // Создаем админа - полагаемся на уникальный индекс MongoDB для предотвращения дубликатов
  // Это атомарная операция, которая предотвращает race condition
  let admin;
  try {
    admin = await AdminUser.create({
      email: normalizedEmail,
      name: normalizedName,
      role: String(role),
      createdAt,
    });
    logger.info(
      `AdminUser created: ${String(admin._id)} for email: ${normalizedEmail}`,
    );
  } catch (createError: unknown) {
    // Если это ошибка дубликата (уникальный индекс на email предотвратил создание)
    const error = createError as { code?: number; message?: string };
    if (
      error?.code === 11000 ||
      (error?.message && error.message.includes("duplicate")) ||
      (error?.message && error.message.includes("E11000"))
    ) {
      // Проверяем, действительно ли админ существует (может быть создан другим запросом)
      const existingAdmin = await AdminUser.findOne({ email: normalizedEmail });
      if (existingAdmin) {
        logger.info(
          `Admin with email ${normalizedEmail} already exists (race condition or duplicate request) — returning existing.`,
        );
        return res.json({
          success: true,
          data: existingAdmin,
        });
      }
      // Если админа нет, но была ошибка дубликата - это странно, пробрасываем как конфликт
      logger.error(
        `Unexpected duplicate key error for email ${normalizedEmail}, but admin not found`,
      );
      throw new AppError(
        "Admin with this email already exists",
        409,
        ErrorCode.CONFLICT,
      );
    }
    // Другие ошибки пробрасываем дальше
    throw createError;
  }

  // Генерируем или принимаем пароль от клиента (если передан)
  const normalizedPassword = password?.trim();
  const isCustomPasswordValid =
    normalizedPassword && normalizedPassword.length >= 8;

  const plainPassword = isCustomPasswordValid
    ? normalizedPassword
    : generateSecurePassword(16);

  const hashedPassword = await hashPassword(plainPassword);

  // Создаем или обновляем пользователя под этого админа (идемпотентно)
  try {
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      // Обновляем роль/имя при необходимости
      let shouldSave = false;
      const desiredRole = role === "super_admin" ? "super_admin" : "admin";
      if (existingUser.role !== desiredRole) {
        existingUser.role = desiredRole;
        shouldSave = true;
      }
      if (normalizedName && existingUser.name !== normalizedName) {
        existingUser.name = normalizedName;
        shouldSave = true;
      }
      if (shouldSave) {
        await existingUser.save();
      }
      logger.info(
        `User already exists for admin ${String(admin._id)}. Updated role/name if needed.`,
      );
    } else {
      await User.create({
        email: normalizedEmail,
        password: hashedPassword,
        role: role === "super_admin" ? "super_admin" : "admin",
        name: normalizedName,
      });
      logger.info(
        `User created for admin: ${String(admin._id)} with email: ${normalizedEmail}`,
      );
    }
  } catch (userError: unknown) {
    // Если при создании/обновлении пользователя произошла ошибка — пробуем откатить созданного админа
    const userErrorMessage =
      (userError as Error)?.message ??
      (typeof userError === "string"
        ? userError
        : JSON.stringify(userError ?? "Unknown error"));
    logger.error(
      `Failed to ensure user for admin ${String(admin._id)} (${normalizedEmail}): ${userErrorMessage}`,
    );
    await AdminUser.findByIdAndDelete(admin._id);
    throw userError;
  }

  // Отправляем email асинхронно ПОСЛЕ отправки ответа, чтобы не блокировать запрос
  // Используем setImmediate, чтобы гарантировать, что ответ уже отправлен
  if (!isCustomPasswordValid) {
    setImmediate(() => {
      emailService
        .sendAdminPasswordEmail(
          String(email).toLowerCase(),
          name || "Администратор",
          plainPassword,
        )
        .then(() => {
          logger.info(`Admin password email sent to ${email}`);
        })
        .catch((error) => {
          // Логируем ошибку, но не прерываем работу (админ уже создан)
          logger.error(
            `Failed to send admin password email to ${email}:`,
            error,
          );
          // В development режиме можно вернуть пароль, но ответ уже отправлен
          if (process.env.NODE_ENV === "development") {
            logger.warn(
              `Development mode: Admin password for ${email} is ${plainPassword}`,
            );
          }
        });
    });
  }

  // Отправляем ответ клиенту, чтобы не блокировать UI
  return res.status(201).json({
    success: true,
    data: admin,
    tempPassword: isCustomPasswordValid ? undefined : plainPassword,
    message: isCustomPasswordValid
      ? "Admin created successfully with provided password."
      : "Admin created successfully. Password has been sent to the provided email address.",
  });
});

export const updateAdmin = asyncHandler(async (req: Request, res: Response) => {
  // Только суперадмины могут обновлять админов
  if (req.user?.role !== "super_admin") {
    throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
  }

  const { id } = req.params;
  const body = req.body as { name?: string; email?: string; role?: string; password?: string };
  const { name, email, role, password } = body;

  const admin = await AdminUser.findById(id);
  if (!admin) {
    throw new AppError("Admin not found", 404, ErrorCode.NOT_FOUND);
  }

  const oldEmail = admin.email;

  if (name !== undefined && typeof name === "string" && name.trim() !== "") {
    admin.name = name.trim();
  }

  // Обновление email
  if (email !== undefined && typeof email === "string") {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== oldEmail) {
      const existingAdmin = await AdminUser.findOne({ email: normalizedEmail });
      if (existingAdmin) {
        throw new AppError("Admin with this email already exists", 409, ErrorCode.CONFLICT);
      }
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        throw new AppError("User with this email already exists", 409, ErrorCode.CONFLICT);
      }
      const existingCompany = await Company.findOne({ adminEmail: normalizedEmail });
      if (existingCompany) {
        throw new AppError("Company with this email already exists", 409, ErrorCode.CONFLICT);
      }
      admin.email = normalizedEmail;
    }
  }

  if (
    role !== undefined &&
    typeof role === "string" &&
    (role === "admin" || role === "super_admin")
  ) {
    admin.role = role;
  }

  await admin.save();

  // Обновляем пользователя в коллекции User (по старому email до смены)
  const user = await User.findOne({ email: oldEmail }).select("+password");
  if (user) {
    let userChanged = false;
    if (name !== undefined && typeof name === "string" && name.trim() !== "") {
      user.name = name.trim();
      userChanged = true;
    }
    if (email !== undefined && typeof email === "string") {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== oldEmail) {
        user.email = normalizedEmail;
        userChanged = true;
      }
    }
    if (
      role !== undefined &&
      typeof role === "string" &&
      (role === "admin" || role === "super_admin")
    ) {
      user.role = role === "super_admin" ? "super_admin" : "admin";
      userChanged = true;
    }
    // Суперадмин может сбросить пароль без ввода старого
    if (password !== undefined && typeof password === "string" && password.trim().length >= 8) {
      user.password = await hashPassword(password.trim());
      userChanged = true;
    }
    if (userChanged) await user.save();
  } else if (password !== undefined && typeof password === "string" && password.trim().length >= 8) {
    // Пользователя нет в User, но пароль передан — создаём запись для входа
    const hashedPassword = await hashPassword(password.trim());
    await User.create({
      email: admin.email,
      password: hashedPassword,
      name: admin.name,
      role: admin.role === "super_admin" ? "super_admin" : "admin",
    });
  }

  const data = admin.toObject ? admin.toObject() : { ...admin, _id: admin._id };
  res.json({
    success: true,
    data,
  });
});

export const deleteAdmin = asyncHandler(async (req: Request, res: Response) => {
  // Только суперадмины могут удалять админов
  if (req.user?.role !== "super_admin") {
    throw new AppError("Access denied", 403, ErrorCode.FORBIDDEN);
  }

  const { id } = req.params;
  const cleanId = id.trim();
  logger.info(`[AdminController] DELETE request for admin ID: ${cleanId}`);

  // 1. Ищем админа чтобы получить email
  // Используем lean() чтобы получить простой объект
  const admin = await AdminUser.findById(cleanId).lean();

  if (!admin) {
    // Если по ID не нашли, ищем по email в User, может это userID?
    const user = await User.findById(cleanId).lean();
    if (user && (user.role === "admin" || user.role === "super_admin")) {
      // Нашли пользователя, удаляем его и ищем админа по email
      const email = user.email.toLowerCase();
      await User.deleteMany({ email }); // Удаляем всех юзеров с таким email
      await AdminUser.deleteMany({ email }); // Удаляем всех админов с таким email

      res.json({
        success: true,
        message: "Admin deleted successfully (via User ID)",
      });
      return;
    }

    // Если совсем не нашли
    throw new AppError("Admin not found", 404, ErrorCode.NOT_FOUND);
  }

  const email = admin.email.toLowerCase().trim();

  // 2. Проверка на удаление себя
  if (req.user?.email.toLowerCase().trim() === email) {
    throw new AppError("Cannot delete yourself", 400, ErrorCode.BAD_REQUEST);
  }

  // 3. Удаляем ВСЁ, что связано с этим email
  logger.info(`[AdminController] Deleting all records for email: ${email}`);

  // Удаляем всех админов с таким email
  await AdminUser.deleteMany({ email });

  // Удаляем всех пользователей с таким email
  await User.deleteMany({ email });

  // На всякий случай удаляем по ID, если вдруг email отличался (хотя это невозможно по схеме)
  await AdminUser.findByIdAndDelete(cleanId);

  logger.info(`[AdminController] Successfully deleted admin ${email}`);

  res.json({
    success: true,
    message: "Admin deleted successfully",
  });
});
