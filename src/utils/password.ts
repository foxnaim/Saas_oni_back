import bcrypt from "bcrypt";
import crypto from "crypto";

const SALT_ROUNDS = 10;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (
  password: string,
  hashedPassword: string,
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

/**
 * Генерирует случайный токен для сброса пароля
 */
export const generateResetToken = (): string => {
  return crypto.randomBytes(32).toString("hex");
};

/**
 * Хеширует токен сброса пароля для безопасного хранения
 */
export const hashResetToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

/**
 * Генерирует безопасный случайный пароль
 * @param length - длина пароля (по умолчанию 12 символов)
 * @returns случайный пароль, содержащий буквы (верхний и нижний регистр), цифры и специальные символы
 */
export const generateSecurePassword = (length: number = 12): string => {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";
  const allChars = uppercase + lowercase + numbers + symbols;

  // Гарантируем наличие хотя бы одного символа каждого типа
  let password = "";
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Заполняем остаток случайными символами
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Перемешиваем символы для большей случайности
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

/**
 * Кэш для ежедневного пароля
 * Хранит пароль и дату, чтобы не генерировать его при каждом запросе
 */
interface DailyPasswordCache {
  password: string;
  dateKey: string; // YYYY-MM-DD в UTC
}

let dailyPasswordCache: DailyPasswordCache | null = null;

/**
 * Генерирует seed для пароля на основе даты
 */
const generatePasswordSeed = (dateStr: string): number => {
  return dateStr
    .split("")
    .reduce((acc, char) => (acc << 5) - acc + char.charCodeAt(0), 0);
};

/**
 * Генерирует буквенно-цифровой пароль на основе seed
 */
const generatePasswordFromSeed = (seed: number, length: number): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";
  let currentSeed = Math.abs(seed);

  for (let i = 0; i < length; i++) {
    currentSeed = (currentSeed * 1103515245 + 12345) & 0x7fffffff;
    const index = currentSeed % chars.length;
    password += chars[index];
  }
  return password;
};

/**
 * Получает текущую дату в формате YYYY-MM-DD (UTC)
 */
const getCurrentDateKey = (): string => {
  const today = new Date();
  return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;
};

/**
 * Генерирует ежедневный буквенно-цифровой пароль на основе даты
 * Пароль обновляется каждый день автоматически
 *
 * ОПТИМИЗАЦИЯ: Использует кэширование в памяти для снижения нагрузки на сервер
 * Пароль генерируется один раз в день и кэшируется до смены даты
 *
 * @param length - длина пароля (по умолчанию 10 символов)
 * @returns буквенно-цифровой пароль, который одинаков для всех компаний в один день
 */
export const generateDailyPassword = (length: number = 10): string => {
  const currentDateKey = getCurrentDateKey();

  // Проверяем кэш: если дата совпадает, возвращаем закэшированный пароль
  if (dailyPasswordCache && dailyPasswordCache.dateKey === currentDateKey) {
    return dailyPasswordCache.password;
  }

  // Если кэш устарел или отсутствует, генерируем новый пароль
  const today = new Date();
  const dateStr = `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, "0")}${String(today.getUTCDate()).padStart(2, "0")}`;

  const seed = generatePasswordSeed(dateStr);
  const password = generatePasswordFromSeed(seed, length);

  // Обновляем кэш
  dailyPasswordCache = {
    password,
    dateKey: currentDateKey,
  };

  return password;
};
