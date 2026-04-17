# Multi-stage build для продакшена
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей
COPY package.json yarn.lock* package-lock.json* ./

# Устанавливаем все зависимости (включая dev для сборки)
RUN yarn install --frozen-lockfile

# Копируем исходный код
COPY . .

# Собираем проект
RUN yarn build

# Production образ
FROM node:20-alpine

WORKDIR /app

# Копируем файлы зависимостей
COPY package.json yarn.lock* package-lock.json* ./

# Устанавливаем только production зависимости
RUN yarn install --frozen-lockfile --production

# Копируем собранный код из builder
COPY --from=builder /app/dist ./dist

# Создаем директорию для логов
RUN mkdir -p logs

# Создаем непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Меняем владельца файлов
RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3001

# Запускаем приложение
CMD ["node", "dist/server.js"]



