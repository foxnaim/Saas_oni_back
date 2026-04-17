#!/bin/bash

# Скрипт для восстановления MongoDB из бэкапа
# Использование: ./scripts/restore-mongodb.sh <путь_к_бэкапу.gz>

set -e

if [ -z "$1" ]; then
    echo "Использование: $0 <путь_к_бэкапу.gz>"
    echo "Пример: $0 /srv/mongo-backups/mongodb_backup_20240101_120000.gz"
    exit 1
fi

BACKUP_FILE="$1"
MONGO_CONTAINER="${MONGO_CONTAINER:-anonymous-chat-mongodb-prod}"
MONGO_DB="${MONGO_DB:-anonymous-chat}"

# Проверяем существование файла
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Ошибка: Файл $BACKUP_FILE не найден!"
    exit 1
fi

# Проверяем, запущен ли контейнер
if ! docker ps --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$"; then
    echo "Ошибка: Контейнер $MONGO_CONTAINER не запущен!"
    exit 1
fi

echo "ВНИМАНИЕ: Это действие перезапишет текущую базу данных $MONGO_DB!"
echo "Файл бэкапа: $BACKUP_FILE"
read -p "Продолжить? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Восстановление отменено."
    exit 0
fi

echo "Восстановление базы данных из бэкапа..."

# Восстанавливаем бэкап
cat "$BACKUP_FILE" | docker exec -i "$MONGO_CONTAINER" mongorestore \
    --archive \
    --gzip \
    --drop \
    --db="$MONGO_DB"

echo "✓ База данных восстановлена успешно!"










