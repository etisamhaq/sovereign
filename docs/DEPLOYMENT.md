# AI Writing Platform - Production Deployment Guide

## Prerequisites

- Ubuntu 20.04+ or similar Linux distribution
- Docker 20.10+ and Docker Compose 1.29+
- Git
- Domain name with DNS configured
- SSL certificate (or use Let's Encrypt)
- Minimum 4GB RAM, 2 CPU cores, 50GB storage

## Initial Server Setup

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git vim htop
```

### 2. Install Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 3. Install Docker Compose

```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## Deployment Steps

### 1. Clone Repository

```bash
sudo mkdir -p /opt
cd /opt
sudo git clone https://github.com/yourusername/ai-writing-platform.git
sudo chown -R $USER:$USER ai-writing-platform
cd ai-writing-platform
```

### 2. Configure Environment

```bash
cp .env.example .env
vim .env
```

Update the following critical values:
- `SECRET_KEY` - Generate with: `python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'`
- `DATABASE_PASSWORD` - Strong database password
- `REDIS_PASSWORD` - Strong Redis password
- `STRIPE_PUBLIC_KEY` and `STRIPE_SECRET_KEY` - Your Stripe keys
- `GROQ_API_KEY` - Your Groq API key
- `EMAIL_HOST_PASSWORD` - Your SendGrid API key
- `ALLOWED_HOSTS` - Your domain name

### 3. Create Required Directories

```bash
mkdir -p backups certbot/conf certbot/www
```

### 4. Setup SSL Certificate

Option A: Using Let's Encrypt
```bash
# Initial certificate generation
docker run -it --rm \
  -v ./certbot/conf:/etc/letsencrypt \
  -v ./certbot/www:/var/www/certbot \
  certbot/certbot certonly --webroot \
  --webroot-path /var/www/certbot \
  --email admin@yourdomain.com \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com \
  -d www.yourdomain.com
```

Option B: Using existing certificates
```bash
# Copy your certificates
sudo cp /path/to/fullchain.pem ./certbot/conf/live/yourdomain.com/
sudo cp /path/to/privkey.pem ./certbot/conf/live/yourdomain.com/
```

### 5. Update Nginx Configuration

```bash
sed -i 's/yourdomain.com/actual-domain.com/g' nginx/conf.d/default.conf
```

### 6. Deploy Application

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run deployment
./scripts/deploy.sh production
```

### 7. Initialize Database

```bash
# Run migrations
docker-compose exec backend python manage.py migrate

# Create superuser
docker-compose exec backend python manage.py createsuperuser

# Initialize data
docker-compose exec backend python init_db.py
```

## Post-Deployment Configuration

### 1. Setup Cron Jobs

```bash
# Edit crontab
crontab -e

# Add the following entries:
# Backup every day at 2 AM
0 2 * * * /opt/ai-writing-platform/scripts/backup.sh >> /var/log/ai-writing-backup.log 2>&1

# Monitor every 5 minutes
*/5 * * * * /opt/ai-writing-platform/scripts/monitoring.sh >> /var/log/ai-writing-monitor.log 2>&1

# SSL renewal check daily
0 0 * * * docker run --rm -v /opt/ai-writing-platform/certbot/conf:/etc/letsencrypt -v /opt/ai-writing-platform/certbot/www:/var/www/certbot certbot/certbot renew --quiet
```

### 2. Configure Firewall

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 3. Setup Monitoring

Install monitoring tools:
```bash
# Prometheus node exporter
docker run -d \
  --name node-exporter \
  --restart unless-stopped \
  -p 9100:9100 \
  prom/node-exporter

# Configure external monitoring service (e.g., UptimeRobot, Pingdom)
```

### 4. Configure Stripe Webhook

1. Go to Stripe Dashboard > Webhooks
2. Add endpoint: `https://yourdomain.com/api/payments/stripe-webhook/`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy webhook secret to `.env` file

## Maintenance

### Daily Backups

Backups run automatically via cron. Manual backup:
```bash
./scripts/backup.sh
```

### Updates

```bash
# Pull latest changes
git pull origin main

# Deploy updates
./scripts/deploy.sh production
```

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f celery

# Nginx access logs
docker-compose exec nginx tail -f /var/log/nginx/access.log
```

### Database Management

```bash
# Access database shell
docker-compose exec db psql -U aiwriting -d aiwriting

# Create backup
docker-compose exec db pg_dump -U aiwriting aiwriting > backup.sql

# Restore backup
docker-compose exec -T db psql -U aiwriting aiwriting < backup.sql
```

### Scaling

To scale backend workers:
```bash
docker-compose up -d --scale backend=3
```

## Troubleshooting

### Service Won't Start

1. Check logs: `docker-compose logs [service-name]`
2. Verify environment variables: `docker-compose config`
3. Check disk space: `df -h`
4. Check memory: `free -h`

### Database Connection Issues

1. Verify database is running: `docker-compose ps db`
2. Check credentials in `.env`
3. Test connection: `docker-compose exec backend python manage.py dbshell`

### SSL Certificate Issues

1. Verify certificate files exist
2. Check certificate expiry: `openssl x509 -in certbot/conf/live/yourdomain.com/cert.pem -text -noout`
3. Force renewal: `docker-compose run --rm certbot renew --force-renewal`

### Performance Issues

1. Check resource usage: `docker stats`
2. Review slow queries: `docker-compose exec db psql -U aiwriting -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10;"`
3. Clear Redis cache: `docker-compose exec redis redis-cli FLUSHALL`

## Security Checklist

- [ ] Change all default passwords
- [ ] Enable firewall with minimal open ports
- [ ] Setup SSL certificates
- [ ] Configure secure headers in Nginx
- [ ] Enable rate limiting
- [ ] Setup regular backups
- [ ] Monitor logs for suspicious activity
- [ ] Keep Docker and system packages updated
- [ ] Configure fail2ban for SSH protection
- [ ] Use strong passwords for all services
- [ ] Restrict database access to local network
- [ ] Enable Django security settings
- [ ] Configure CORS properly
- [ ] Setup intrusion detection system

## Support

For issues, check:
1. Application logs: `/var/log/ai-writing-*.log`
2. Docker logs: `docker-compose logs`
3. System logs: `journalctl -xe`

Contact: support@yourdomain.com