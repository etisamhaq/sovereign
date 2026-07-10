# AI Writing Platform - Codebase Structure

## Project Overview
A comprehensive AI-powered writing platform (Sovereign) built with Django (backend) and React/TypeScript (frontend), featuring 15+ AI tools for content creation, editing, and education.

## Technology Stack

### Backend
- **Framework**: Django 5.2.4 with Django REST Framework
- **Database**: PostgreSQL
- **Authentication**: JWT tokens (djangorestframework-simplejwt)
- **AI Integration**: Groq API for LLM capabilities
- **Async Processing**: Celery with Redis broker
- **Payment Processing**: Polar SDK for subscriptions
- **Email Service**: SendGrid
- **Web Scraping**: BeautifulSoup4, newspaper3k
- **Deployment**: Docker, Gunicorn, WhiteNoise

### Frontend
- **Framework**: React 19.1.0 with TypeScript
- **State Management**: Zustand + React Query
- **Styling**: Tailwind CSS with custom components
- **Routing**: React Router v7
- **Forms**: React Hook Form
- **Animations**: Framer Motion
- **Charts**: Chart.js, Recharts
- **HTTP Client**: Axios
- **Build Tool**: Create React App

## Backend Structure

### Core Django Apps

#### 1. **accounts/** - User Management
- Custom User model with subscription tracking
- JWT authentication endpoints
- Email verification and password reset
- Models:
  - `User`: Extended with subscription fields, usage tracking
  - `PasswordResetToken`: Secure password reset
  - `EmailVerificationToken`: Email verification

#### 2. **tools/** - AI Tools Engine
- Central tool management and execution
- AI service integration (Groq API)
- Usage tracking and analytics
- Models:
  - `Tool`: Tool definitions with categories
  - `ToolUsage`: Usage history and metrics
  - `Document`: User-generated content
  - `Template`: Content templates
  - `SavedResult`: Saved tool outputs
  - `VideoChat`: Video transcription and chat

#### 3. **payments/** - Subscription Management
- Polar payment integration
- Subscription tracking
- Usage quotas
- Models:
  - `Subscription`: Active subscriptions
  - `Payment`: Payment history
  - `UsageQuota`: Monthly usage limits
  - `Invoice`: Payment invoices

#### 4. **research/** - Smart Research Assistant
- Multi-source web scraping
- Knowledge graph generation
- Research aggregation
- Services:
  - `research_service.py`: Research orchestration
  - `scraping_service.py`: Web content extraction

#### 5. **api/** - API Gateway
- Central API routing
- Authentication middleware
- API versioning

### Key Backend Services

- **`tools/ai_service.py`**: Centralized Groq API integration
- **`payments/polar_service.py`**: Polar payment processing
- **`core/celery.py`**: Async task configuration
- **`core/middleware.py`**: Custom middleware

## Frontend Structure

### Page Components (`src/pages/`)
- **Public Pages**: HomePage, PricingPage, AboutPage, ContactPage
- **Auth Pages**: LoginPage, RegisterPage
- **Protected Pages**: DashboardPage, ToolsPage, ToolPage, ProfilePage

### Tool Components (`src/components/tools/`)
19 AI-powered tools including:
- **Writing Tools**: ParaphraseTool, GrammarCheckTool, EssayGeneratorTool
- **Education Tools**: FlashcardCreator, QuizGeneratorTool, SummarizerTool
- **SEO Tools**: TitleGeneratorTool, MetaDescriptionGenerator
- **Utility Tools**: TranslatorTool, CitationGenerator, VideoChat

### Core Services (`src/services/`)
- **`api.ts`**: Axios client with interceptors
- **`auth.ts`**: Authentication service
- **`analytics.ts`**: Usage analytics

### State Management
- **`store/authStore.ts`**: Zustand store for authentication
- React Query for server state
- Context API for theme management

## Database Schema

### User System
- Extended Django User model
- Subscription tiers: Free (100 requests/month), Pro ($3/month, 10,000 requests)
- Usage tracking and reset mechanisms

### Content Management
- Documents with version control
- Templates with variables
- Saved results with favorites

### Analytics
- Tool usage tracking
- Processing time metrics
- Token usage monitoring

## API Structure

### Authentication Endpoints
- `POST /api/auth/register/` - User registration
- `POST /api/auth/login/` - JWT token generation
- `POST /api/auth/refresh/` - Token refresh
- `POST /api/auth/logout/` - Token blacklist

### Tool Endpoints
- `GET /api/tools/` - List all tools
- `POST /api/tools/{slug}/use/` - Execute tool
- `GET /api/tools/{slug}/history/` - Usage history

### Payment Endpoints
- `POST /api/payments/create-checkout/` - Create Polar checkout
- `POST /api/payments/webhook/` - Polar webhook handler
- `GET /api/payments/subscription/` - Current subscription

## Development Workflow

### Local Development
```bash
# Backend
docker-compose -f docker-compose.dev.yml up
# or
cd backend && python manage.py runserver

# Frontend
cd frontend && npm start
```

### Testing
- Backend: pytest with coverage
- Frontend: React Testing Library
- System tests: `test_system.py`
- Tool tests: `test_tools.py`

### Deployment
- Backend: Docker container with Gunicorn
- Frontend: Static build served by Nginx
- Database: PostgreSQL with migrations
- Static files: WhiteNoise
- Media files: Django storage backend

## Environment Configuration

### Required Environment Variables
- `GROQ_API_KEY` - AI model access
- `POLAR_ACCESS_TOKEN` - Payment processing
- `SENDGRID_API_KEY` - Email notifications
- `DATABASE_URL` - PostgreSQL connection
- `SECRET_KEY` - Django secret
- `REDIS_URL` - Celery broker

## Key Features

1. **15+ AI Tools**: Comprehensive suite for writing, education, and SEO
2. **Real-time Processing**: Async task handling with Celery
3. **Subscription System**: Free tier + Pro tier with Polar integration
4. **Usage Analytics**: Detailed tracking and visualization
5. **Multi-language Support**: 20+ languages for translation
6. **Video Chat**: Upload videos and chat about content
7. **Research Assistant**: Smart web scraping and aggregation
8. **Export Options**: PDF, DOCX, Markdown formats

## Security Features

- JWT authentication with refresh tokens
- CORS configuration
- Rate limiting
- Input validation
- XSS protection
- CSRF protection
- Secure password reset flow