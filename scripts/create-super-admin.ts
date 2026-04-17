/**
 * Скрипт для создания первого суперадмина
 * Использование: tsx scripts/create-super-admin.ts <email> <name> [password]
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { AdminUser } from '../src/models/AdminUser';
import { User } from '../src/models/User';
import { Company } from '../src/models/Company';
import { hashPassword } from '../src/utils/password';

dotenv.config({ path: '.env' });

const createSuperAdmin = async (): Promise<void> => {
  const email = process.argv[2];
  const name = process.argv[3];
  const password = process.argv[4] || 'admin123';

  if (!email || !name) {
    console.error('Usage: tsx scripts/create-super-admin.ts <email> <name> [password]');
    console.error('Example: tsx scripts/create-super-admin.ts admin@example.com "Admin Name" "Password123!"');
    process.exit(1);
  }

  try {
    // Подключаемся к MongoDB
    const mongodbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/anonymous-chat';
    
    if (!process.env.MONGODB_URI) {
      console.warn('Warning: MONGODB_URI not found in environment variables. Using default: mongodb://localhost:27017/anonymous-chat');
    }
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongodbUri);
    console.log('Connected to MongoDB successfully');

    const normalizedEmail = email.toLowerCase().trim();

    // Проверяем, не существует ли уже админ с таким email
    const existingAdmin = await AdminUser.findOne({ email: normalizedEmail });
    if (existingAdmin) {
      console.error(`Error: Admin with email ${email} already exists`);
      await mongoose.disconnect();
      process.exit(1);
    }

    // Проверяем, не существует ли компания с таким adminEmail
    const existingCompany = await Company.findOne({ adminEmail: normalizedEmail });
    if (existingCompany) {
      console.error(`Error: Company with admin email ${email} already exists`);
      console.error(`Company name: ${existingCompany.name}, code: ${existingCompany.code}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      console.error(`Error: User with email ${email} already exists`);
      await mongoose.disconnect();
      process.exit(1);
    }

    // Создаем админа
    console.log('Creating super admin...');
    const createdAt = new Date().toISOString().split('T')[0];
    const admin = await AdminUser.create({
      email: normalizedEmail,
      name,
      role: 'super_admin',
      createdAt,
    });
    console.log(`Admin created with ID: ${admin._id}`);

    // Создаем пользователя для админа
    console.log('Creating user for admin...');
    const hashedPassword = await hashPassword(password);
    const user = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      role: 'super_admin',
      name,
    });
    console.log(`User created with ID: ${user._id}`);

    console.log('\n✅ Super admin created successfully!');
    console.log(`Email: ${email}`);
    console.log(`Name: ${name}`);
    console.log(`Password: ${password}`);
    console.log('\nYou can now login with these credentials.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error creating super admin:');
    if (error instanceof Error) {
      console.error(error.message);
      console.error(error.stack);
    } else {
      console.error(error);
    }
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      // Ignore disconnect errors
    }
    process.exit(1);
  }
};

void createSuperAdmin();

