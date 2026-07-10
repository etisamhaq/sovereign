#!/bin/bash

# AI Writing Platform Monitoring Script
# This script monitors the health of all services

set -e

# Configuration
SLACK_WEBHOOK=${SLACK_WEBHOOK_URL:-""}
EMAIL_ALERT=${ADMIN_EMAIL:-"admin@yourdomain.com"}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to send alerts
send_alert() {
    local service=$1
    local status=$2
    local message=$3
    
    # Send Slack notification if configured
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚨 AI Writing Platform Alert: $service is $status - $message\"}" \
            "$SLACK_WEBHOOK" 2>/dev/null
    fi
    
    # Send email notification
    if command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "AI Writing Platform: $service is $status" "$EMAIL_ALERT"
    fi
}

# Function to check service health
check_service() {
    local service_name=$1
    local health_endpoint=$2
    local container_name=$3
    
    echo -ne "Checking $service_name... "
    
    # Check if container is running
    if ! docker ps --format "{{.Names}}" | grep -q "$container_name"; then
        echo -e "${RED}Container not running${NC}"
        send_alert "$service_name" "DOWN" "Container $container_name is not running"
        return 1
    fi
    
    # Check health endpoint if provided
    if [ -n "$health_endpoint" ]; then
        if curl -f -s "$health_endpoint" > /dev/null 2>&1; then
            echo -e "${GREEN}Healthy${NC}"
            return 0
        else
            echo -e "${RED}Unhealthy${NC}"
            send_alert "$service_name" "UNHEALTHY" "Health check failed for $service_name"
            return 1
        fi
    else
        echo -e "${GREEN}Running${NC}"
        return 0
    fi
}

# Function to check disk space
check_disk_space() {
    echo -ne "Checking disk space... "
    
    local usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$usage" -gt 85 ]; then
        echo -e "${RED}Critical: ${usage}% used${NC}"
        send_alert "Disk Space" "CRITICAL" "Disk usage is at ${usage}%"
    elif [ "$usage" -gt 75 ]; then
        echo -e "${YELLOW}Warning: ${usage}% used${NC}"
    else
        echo -e "${GREEN}OK: ${usage}% used${NC}"
    fi
}

# Function to check memory usage
check_memory() {
    echo -ne "Checking memory usage... "
    
    local mem_usage=$(free | grep Mem | awk '{print int($3/$2 * 100)}')
    if [ "$mem_usage" -gt 90 ]; then
        echo -e "${RED}Critical: ${mem_usage}% used${NC}"
        send_alert "Memory" "CRITICAL" "Memory usage is at ${mem_usage}%"
    elif [ "$mem_usage" -gt 80 ]; then
        echo -e "${YELLOW}Warning: ${mem_usage}% used${NC}"
    else
        echo -e "${GREEN}OK: ${mem_usage}% used${NC}"
    fi
}

# Function to check database connections
check_database_connections() {
    echo -ne "Checking database connections... "
    
    local connections=$(docker-compose exec -T db psql -U $DATABASE_USER -d $DATABASE_NAME -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | tr -d ' ')
    local max_connections=$(docker-compose exec -T db psql -U $DATABASE_USER -d $DATABASE_NAME -t -c "SHOW max_connections;" 2>/dev/null | tr -d ' ')
    
    local usage_percent=$((connections * 100 / max_connections))
    
    if [ "$usage_percent" -gt 90 ]; then
        echo -e "${RED}Critical: $connections/$max_connections connections${NC}"
        send_alert "Database" "CRITICAL" "Database has $connections/$max_connections connections"
    elif [ "$usage_percent" -gt 75 ]; then
        echo -e "${YELLOW}Warning: $connections/$max_connections connections${NC}"
    else
        echo -e "${GREEN}OK: $connections/$max_connections connections${NC}"
    fi
}

# Function to check Redis memory
check_redis_memory() {
    echo -ne "Checking Redis memory... "
    
    local redis_info=$(docker-compose exec -T redis redis-cli info memory 2>/dev/null)
    local used_memory=$(echo "$redis_info" | grep "used_memory_human:" | cut -d':' -f2 | tr -d '\r')
    
    echo -e "${GREEN}OK: $used_memory used${NC}"
}

# Main monitoring routine
echo "=== AI Writing Platform Health Check ==="
echo "Time: $(date)"
echo "======================================="

# Compose v2 derives container names as <project>-<service>-<index>.
# Override COMPOSE_PROJECT_NAME if your stack uses a different prefix.
COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-ai-writing-platform}

# Check all services
check_service "Backend API"   "http://localhost:8000/api/health/" "${COMPOSE_PROJECT_NAME}-backend-1"
check_service "Frontend"      "http://localhost/health"            "${COMPOSE_PROJECT_NAME}-frontend-1"
check_service "PostgreSQL"    ""                                   "${COMPOSE_PROJECT_NAME}-db-1"
check_service "Redis"         ""                                   "${COMPOSE_PROJECT_NAME}-redis-1"
check_service "Celery Worker" ""                                   "${COMPOSE_PROJECT_NAME}-celery-1"
check_service "Celery Beat"   ""                                   "${COMPOSE_PROJECT_NAME}-celery-beat-1"

# System checks
echo ""
echo "=== System Resources ==="
check_disk_space
check_memory
check_database_connections
check_redis_memory

# Application metrics
echo ""
echo "=== Application Metrics ==="

# Get user count
user_count=$(docker-compose exec -T backend python -c "from django.contrib.auth import get_user_model; print(get_user_model().objects.count())" 2>/dev/null || echo "N/A")
echo "Total Users: $user_count"

# Get active subscriptions
active_subs=$(docker-compose exec -T backend python -c "from django.contrib.auth import get_user_model; print(get_user_model().objects.filter(is_pro=True).count())" 2>/dev/null || echo "N/A")
echo "Active Pro Subscriptions: $active_subs"

# Get today's usage
today_usage=$(docker-compose exec -T backend python -c "from tools.models import ToolUsage; from datetime import date; print(ToolUsage.objects.filter(created_at__date=date.today()).count())" 2>/dev/null || echo "N/A")
echo "Tool Uses Today: $today_usage"

echo ""
echo "======================================="
echo "Health check completed at $(date)"

# Exit with appropriate code
if [ $? -eq 0 ]; then
    exit 0
else
    exit 1
fi