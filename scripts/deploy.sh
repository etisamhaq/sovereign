#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
#  Sovereign AI Writing Platform — Production Deployment Script
#  This script can be run manually on the EC2 instance.
#  It is also called by the GitHub Actions CI/CD pipeline.
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_DIR="${PROJECT_DIR:-/home/ubuntu/Sovereign-AI-Tools}"
COMPOSE_FILE="docker-compose.yml"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${BLUE}  Sovereign Deployment — $(date)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"

trap 'echo -e "${RED}Deployment failed at line $LINENO${NC}"' ERR

# ── Navigate to project ──
cd "$PROJECT_DIR"

# ── Preflight checks ──
echo -e "\n${YELLOW}[0/9] Running preflight checks...${NC}"
if [ ! -f "$COMPOSE_FILE" ]; then
    echo -e "${RED}  ✗ Missing compose file: $COMPOSE_FILE${NC}"
    exit 1
fi
docker compose -f "$COMPOSE_FILE" config >/dev/null
echo -e "${GREEN}  ✓ Compose config valid${NC}"

# ── 1. Pull latest code ──
echo -e "\n${YELLOW}[1/9] Pulling latest code...${NC}"
git fetch origin main
git reset --hard origin/main
echo -e "${GREEN}  ✓ Code updated${NC}"

# ── 2. Backup database ──
echo -e "\n${YELLOW}[2/9] Backing up database...${NC}"
mkdir -p backups
if docker compose ps db --format '{{.State}}' 2>/dev/null | grep -q "running"; then
    docker compose exec -T db pg_dump -U ${DATABASE_USER:-aiwriting} ${DATABASE_NAME:-aiwriting} | gzip > "backups/pre_deploy_${TIMESTAMP}.sql.gz"
    echo -e "${GREEN}  ✓ Database backed up → backups/pre_deploy_${TIMESTAMP}.sql.gz${NC}"
else
    echo -e "${YELLOW}  ⚠ Database not running, skipping backup${NC}"
fi

# ── 3. Build new images ──
echo -e "\n${YELLOW}[3/9] Building Docker images...${NC}"
docker compose -f "$COMPOSE_FILE" build
echo -e "${GREEN}  ✓ Images built${NC}"

# ── 4. Restart services ──
echo -e "\n${YELLOW}[4/9] Restarting services...${NC}"
docker compose -f "$COMPOSE_FILE" up -d
echo -e "${GREEN}  ✓ Services restarted${NC}"

# ── 5. Restart nginx (pick up new container IPs) ──
echo -e "\n${YELLOW}[5/9] Restarting nginx to pick up new container IPs...${NC}"
sleep 10
docker compose -f "$COMPOSE_FILE" restart nginx
echo -e "${GREEN}  ✓ Nginx restarted${NC}"

# ── 6. Wait for services ──
echo -e "\n${YELLOW}[6/9] Waiting for services to stabilize...${NC}"
sleep 10

# ── 7. Run migrations ──
echo -e "\n${YELLOW}[7/9] Running database migrations...${NC}"
MIGRATED=false
for i in 1 2 3; do
    if docker compose -f "$COMPOSE_FILE" exec -T backend python manage.py migrate --noinput; then
        MIGRATED=true
        break
    fi
    echo -e "  Migration attempt $i failed; retrying in 5s..."
    sleep 5
done

if [ "$MIGRATED" != "true" ]; then
    echo -e "${RED}  ✗ Migrations failed after retries${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Migrations applied${NC}"

# ── 8. Collect static files ──
echo -e "\n${YELLOW}[8/9] Collecting static files...${NC}"
docker compose -f "$COMPOSE_FILE" exec -T backend python manage.py collectstatic --noinput
echo -e "${GREEN}  ✓ Static files collected${NC}"

# ── 9. Health checks ──
echo -e "\n${YELLOW}[9/9] Running health checks...${NC}"
RETRIES=5
DELAY=5
HEALTHY=false

for i in $(seq 1 $RETRIES); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/health 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        HEALTHY=true
        break
    fi
    echo -e "  Attempt $i/$RETRIES — HTTP $HTTP_CODE, retrying in ${DELAY}s..."
    sleep $DELAY
done

if [ "$HEALTHY" = "true" ]; then
    echo -e "${GREEN}  ✓ Health check PASSED${NC}"
else
    echo -e "${RED}  ✗ Health check did not return 200${NC}"
    echo -e "${YELLOW}  Check logs: docker compose logs${NC}"
fi

# ── Cleanup ──
echo -e "\n${YELLOW}Cleaning up...${NC}"
docker image prune -f > /dev/null 2>&1

# Keep only last 30 backups
cd backups 2>/dev/null && ls -t *.sql.gz 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null || true
cd "$PROJECT_DIR"

# ── Summary ──
echo -e "\n${BLUE}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Deployment completed at $(date)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════${NC}"
echo ""
docker compose -f "$COMPOSE_FILE" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
