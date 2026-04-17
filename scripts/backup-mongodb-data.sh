#!/bin/bash

# Скрипт для создания бэкапа данных MongoDB через копирование директории
# Использование: ./scripts/backup-mongodb-data.sh
# ВАЖНО: MongoDB должна быть остановлена для безопасного копирования

set -e

# Конфигурация
MONGO_DATA_DIR="${MONGO_DATA_DIR:-/srv/mongo-data}"
BACKUP_DIR="${BACKUP_DIR:-/srv/mongo-backups/data}"
MONGO_CONTAINER="${MONGO_CONTAINER:-anonymous-chat-mongodb-prod}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Создаем директорию для бэкапов если её нет
mkdir -p "$BACKUP_DIR"

# Генерируем имя файла с датой и временем
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mongodb_data_${TIMESTAMP}.tar.gz"

echo "Создание бэкапа данных MongoDB (копирование директории)..."
echo "Исходная директория: $MONGO_DATA_DIR"
echo "Путь бэкапа: $BACKUP_FILE"

# Проверяем существование директории
if [ ! -d "$MONGO_DATA_DIR" ]; then
    echo "Ошибка: Директория $MONGO_DATA_DIR не найдена!"
    exit 1
fi

# Проверяем, запущен ли контейнер
if docker ps --format '{{.Names}}' | grep -q "^${MONGO_CONTAINER}$"; then
    echo "ВНИМАНИЕ: Контейнер MongoDB запущен!"
    echo "Для безопасного копирования рекомендуется остановить MongoDB."
    read -p "Продолжить? (yes/no): " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        echo "Бэкап отменен. Остановите MongoDB и попробуйте снова."
        exit 0
    fi
fi

# Создаем архив директории
echo "Создание архива..."
tar -czf "$BACKUP_FILE" -C "$(dirname "$MONGO_DATA_DIR")" "$(basename "$MONGO_DATA_DIR")"

# Проверяем размер бэкапа
if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✓ Бэкап создан успешно: $BACKUP_FILE (размер: $SIZE)"
else
    echo "✗ Ошибка: Бэкап не был создан!"
    exit 1
fi

# Удаляем старые бэкапы (старше RETENTION_DAYS дней)
echo "Очистка старых бэкапов (старше $RETENTION_DAYS дней)..."
find "$BACKUP_DIR" -name "mongodb_data_*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete
echo "✓ Очистка завершена"

echo "Бэкап завершен успешно!"










