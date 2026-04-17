#!/bin/bash

# Скрипт для создания бэкапа MongoDB
# Использование: ./scripts/backup-mongodb.sh

set -e

# Конфигурация
BACKUP_DIR="${BACKUP_DIR:-/srv/mongo-backups}"
MONGO_CONTAINER="${MONGO_CONTAINER:-anonymous-chat-mongodb-prod}"
MONGO_DB="${MONGO_DB:-anonymous-chat}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Создаем директорию для бэкапов если её нет
mkdir -p "$BACKUP_DIR"

# Генерируем имя файла с датой и временем
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mongodb_backup_${TIMESTAMP}"

echo "Создание бэкапа MongoDB..."
echo "Контейнер: $MONGO_CONTAINER"
echo "База данных: $MONGO_DB"
echo "Путь бэкапа: $BACKUP_FILE"

# Проверяем, запущен ли контейнер
if ! docker ps --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$"; then
    echo "Ошибка: Контейнер $MONGO_CONTAINER не запущен!"
    exit 1
fi

# Создаем бэкап через mongodump
docker exec "$MONGO_CONTAINER" mongodump \
    --db="$MONGO_DB" \
    --archive \
    --gzip > "${BACKUP_FILE}.gz"

# Проверяем размер бэкапа
if [ -f "${BACKUP_FILE}.gz" ]; then
    SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
    echo "✓ Бэкап создан успешно: ${BACKUP_FILE}.gz (размер: $SIZE)"
else
    echo "✗ Ошибка: Бэкап не был создан!"
    exit 1
fi

# Удаляем старые бэкапы (старше RETENTION_DAYS дней)
echo "Очистка старых бэкапов (старше $RETENTION_DAYS дней)..."
find "$BACKUP_DIR" -name "mongodb_backup_*.gz" -type f -mtime +$RETENTION_DAYS -delete
echo "✓ Очистка завершена"

echo "Бэкап завершен успешно!"










