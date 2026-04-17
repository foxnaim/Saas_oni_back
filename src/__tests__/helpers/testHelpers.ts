import { Types } from "mongoose";
import { User } from "../../models/User";
import { Company } from "../../models/Company";
import { generateToken } from "../../utils/jwt";
import type { UserRole } from "../../models/User";

export interface TestUser {
  _id: Types.ObjectId;
  email: string;
  password: string;
  role: UserRole;
  companyId?: Types.ObjectId;
}

export interface TestCompany {
  _id: Types.ObjectId;
  code: string;
  name: string;
  adminEmail: string;
  status: "Активна" | "Пробная" | "Заблокирована";
  plan: string;
}

/**
 * Создать тестового пользователя
 */
export async function createTestUser(
  overrides: Partial<TestUser> = {},
): Promise<TestUser> {
  const defaultUser = {
    email: `test${Date.now()}@example.com`,
    password: "TestPassword123!",
    role: "user" as UserRole,
    ...overrides,
  };

  const user = new User(defaultUser);
  await user.save();

  return {
    _id: user._id,
    email: user.email,
    password: defaultUser.password,
    role: user.role,
    companyId: user.companyId,
  };
}

/**
 * Создать тестовую компанию
 */
export async function createTestCompany(
  overrides: Partial<TestCompany> = {},
): Promise<TestCompany> {
  const randomCode = Math.random().toString(36).substring(2, 10).toUpperCase();
  const defaultCompany = {
    code: randomCode,
    name: `Test Company ${Date.now()}`,
    adminEmail: `admin${Date.now()}@example.com`,
    status: "Активна" as const,
    plan: "Бесплатный",
    registered: new Date().toISOString(),
    employees: 0,
    messages: 0,
    ...overrides,
  };

  const company = new Company(defaultCompany);
  await company.save();

  return {
    _id: company._id,
    code: company.code,
    name: company.name,
    adminEmail: company.adminEmail,
    status: company.status,
    plan: company.plan,
  };
}

/**
 * Создать JWT токен для тестового пользователя
 */
export function createTestToken(user: TestUser): string {
  return generateToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    companyId: user.companyId?.toString(),
  });
}

/**
 * Создать пользователя компании с компанией
 */
export async function createTestCompanyUser(
  companyOverrides: Partial<TestCompany> = {},
  userOverrides: Partial<TestUser> = {},
): Promise<{ user: TestUser; company: TestCompany; token: string }> {
  const company = await createTestCompany(companyOverrides);
  const user = await createTestUser({
    ...userOverrides,
    role: "company",
    companyId: company._id,
    email: company.adminEmail,
  });
  const token = createTestToken(user);

  return { user, company, token };
}
