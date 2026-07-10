# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development Environment
```bash
# Start all services in development mode
docker-compose -f docker-compose.dev.yml up

# Run backend separately (for debugging)
cd backend
python manage.py runserver

# Run frontend separately
cd frontend
npm start

# Run Django migrations
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate

# Create superuser
docker-compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser

# Initialize tools data
docker-compose -f docker-compose.dev.yml exec backend python init_db.py
```

### Testing
```bash
# Run comprehensive system tests
docker-compose -f docker-compose.dev.yml exec backend python test_system.py

# Run Django tests
cd backend
python manage.py test

# Run frontend tests
cd frontend
npm test

# Run AI tools test
docker-compose -f docker-compose.dev.yml exec backend python test_tools.py

# Run pytest with coverage (backend)
cd backend
pytest --cov
```

### Production Deployment
```bash
# Build and start production services
docker-compose up -d

# Deploy script
./scripts/deploy.sh

# Monitor services
./scripts/monitoring.sh

# Backup database
./scripts/backup.sh
```

## Architecture Overview

### Backend (Django)
The backend follows Django's MVT pattern with REST API architecture:

- **`accounts/`** - User authentication using JWT tokens (djangorestframework-simplejwt)
- **`tools/`** - Core AI tools implementation with Groq API integration
- **`payments/`** - Polar payment integration for subscriptions ($3/month Pro tier)
- **`research/`** - Smart research assistant with web scraping (BeautifulSoup4, newspaper3k)
- **`core/`** - Django settings, URLs, middleware, and Celery configuration

Key services:
- **`tools/ai_service.py`** - Central AI service handling all Groq API interactions
- **`payments/polar_service.py`** - Polar payment processing and webhook handling
- **`research/research_service.py`** - Multi-source research aggregation and knowledge graphs

### Frontend (React + TypeScript)
Single-page application with modern React patterns:

- **`src/pages/`** - Route-level components (HomePage, DashboardPage, ToolsPage, etc.)
- **`src/components/tools/`** - Individual tool components (14 AI tools)
- **`src/services/`** - API client, authentication, and analytics services
- **`src/store/authStore.ts`** - Zustand state management for authentication

Key patterns:
- React Query for server state management
- Zustand for client state
- Tailwind CSS with custom components
- Framer Motion for animations

### Database Schema
PostgreSQL with key models:
- `User` - Extended Django user with subscription status
- `Tool` - AI tool definitions with usage tracking
- `Document` - User-generated content storage
- `Subscription` - Polar subscription tracking
- `UsageRecord` - Tool usage analytics

### Async Processing
Celery with Redis broker handles:
- Email sending (SendGrid)
- Research data aggregation
- Usage analytics processing
- Background AI processing for large documents

## API Patterns

All API endpoints follow RESTful conventions:
- Authentication: JWT Bearer tokens in Authorization header
- Base URL: `/api/`
- Tool usage: `POST /api/tools/{tool-slug}/use/`
- Response format: JSON with `success`, `data`, and `error` fields

## Development Workflow

1. Feature branches from `main`
2. Backend changes require migrations: `python manage.py makemigrations`
3. Frontend changes use TypeScript - ensure type safety
4. All new tools must:
   - Be added to `init_db.py`
   - Have corresponding frontend component in `src/components/tools/`
   - Include proper error handling and loading states

## Environment Variables

Critical variables (see `.env.example`):
- `GROQ_API_KEY` - Required for AI functionality
- `POLAR_ACCESS_TOKEN` - Required for payments
- `SENDGRID_API_KEY` - Required for email notifications
- `SECRET_KEY` - Django secret (generate new for production)
- `DATABASE_URL` - PostgreSQL connection string

## Common Tasks

### Adding a New AI Tool
1. Define tool in `backend/init_db.py`
2. Create frontend component in `src/components/tools/`
3. Add route in `src/pages/ToolPage.tsx`
4. Implement AI logic in `backend/tools/views.py`

### Modifying Payment Plans
1. Update `backend/payments/models.py` for subscription tiers
2. Modify `frontend/src/pages/PricingPage.tsx` for UI
3. Update Polar product configuration

### Debugging AI Issues
1. Check Groq API key validity
2. Review `backend/tools/ai_service.py` for error handling
3. Monitor Celery logs for async task failures
4. Use `test_tools.py` to validate individual tools