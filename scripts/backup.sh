#!/bin/bash

# AI Writing Platform Backup Script
# This script handles database and media backups

set -e

# Configuration
BACKUP_DIR="/opt/backups/ai-writing-platform"
PROJECT_DIR="/opt/ai-writing-platform"
RETENTION_DAYS=30
S3_BUCKET=${S3_BACKUP_BUCKET:-""}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Navigate to project directory
cd "$PROJECT_DIR"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Timestamp for backup files
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "Starting backup at $(date)"

# 1. Database Backup
echo "Backing up PostgreSQL database..."
DB_BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"
docker-compose exec -T db pg_dump -U $DATABASE_USER $DATABASE_NAME | gzip > "$DB_BACKUP_FILE"
echo "Database backed up to: $DB_BACKUP_FILE"

# 2. Media Files Backup
echo "Backing up media files..."
MEDIA_BACKUP_FILE="$BACKUP_DIR/media_backup_$TIMESTAMP.tar.gz"
docker run --rm -v ai-writing-platform_media_volume:/media:ro -v "$BACKUP_DIR":/backup alpine \
    tar -czf "/backup/media_backup_$TIMESTAMP.tar.gz" -C / media
echo "Media files backed up to: $MEDIA_BACKUP_FILE"

# 3. Configuration Backup
echo "Backing up configuration files..."
CONFIG_BACKUP_FILE="$BACKUP_DIR/config_backup_$TIMESTAMP.tar.gz"
tar -czf "$CONFIG_BACKUP_FILE" \
    .env \
    docker-compose.yml \
    nginx/nginx.conf \
    nginx/conf.d/ \
    backend/core/settings.py
echo "Configuration backed up to: $CONFIG_BACKUP_FILE"

# 4. Upload to S3 (if configured)
if [ -n "$S3_BUCKET" ] && command -v aws >/dev/null 2>&1; then
    echo "Uploading backups to S3..."
    aws s3 cp "$DB_BACKUP_FILE" "s3://$S3_BUCKET/ai-writing-platform/database/"
    aws s3 cp "$MEDIA_BACKUP_FILE" "s3://$S3_BUCKET/ai-writing-platform/media/"
    aws s3 cp "$CONFIG_BACKUP_FILE" "s3://$S3_BUCKET/ai-writing-platform/config/"
    echo "Backups uploaded to S3"
fi

# 5. Clean up old backups
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "*.gz" -type f -mtime +$RETENTION_DAYS -delete
echo "Old backups removed"

# 6. Verify backup integrity
echo "Verifying backup integrity..."
if gzip -t "$DB_BACKUP_FILE"; then
    echo "Database backup is valid"
else
    echo "ERROR: Database backup is corrupted!"
    exit 1
fi

echo "Backup completed successfully at $(date)"

# Send notification
if command -v mail >/dev/null 2>&1; then
    echo "Backup completed at $(date). Files stored in $BACKUP_DIR" | \
        mail -s "AI Writing Platform Backup Success" admin@yourdomain.com
fi