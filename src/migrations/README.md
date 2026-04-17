# Миграции базы данных

Система миграций для MongoDB позволяет безопасно обновлять схему базы данных без потери данных.

## Автоматический запуск

Миграции автоматически запускаются при старте сервера (в режимах development и production).

## Ручное управление

### Проверить статус миграций
```bash
yarn migrate:status
```

### Запустить миграции вручную
```bash
yarn migrate
```

### Откатить миграцию
```bash
yarn migrate:rollback <migration-name>
```

## Создание новой миграции

1. Создайте файл в `src/migrations/files/` с именем в формате:
   ```
   XXX_description.ts
   ```
   где XXX - порядковый номер (001, 002, 003...)

2. Экспортируйте функции `up` и `down`:

```typescript
export const up = async (): Promise<void> => {
  // Код для применения миграции
  // Например: создание индексов, изменение схемы
};

export const down = async (): Promise<void> => {
  // Код для отката миграции (опционально)
};
```

## Пример миграции

```typescript
// src/migrations/files/002_add_user_index.ts
import mongoose from 'mongoose';

export const up = async (): Promise<void> => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not available');
  
  const usersCollection = db.collection('users');
  await usersCollection.createIndex({ email: 1, role: 1 });
  
  console.log('Added compound index on users(email, role)');
};

export const down = async (): Promise<void> => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database connection not available');
  
  const usersCollection = db.collection('users');
  await usersCollection.dropIndex('email_1_role_1');
  
  console.log('Dropped compound index on users(email, role)');
};
```

## Важно

- Миграции выполняются в порядке имен файлов (алфавитно)
- Каждая миграция выполняется только один раз
- Статус миграций хранится в коллекции `migrations`
- Всегда тестируйте миграции на тестовых данных перед продакшеном

