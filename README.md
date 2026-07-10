# Sovereign - AI Writing & Productivity Platform

Sovereign is a comprehensive AI-powered platform offering 30+ tools for writing, education, research, SEO, and productivity — all for just $5/month. Built with Django REST Framework, React 18, and powered by Groq AI (Mixtral 8x7B).

## 🚀 Features

### Writing & Content (8 tools)
| Tool | Description |
|------|-------------|
| **AI Paraphrasing Tool** | 6 modes — standard, fluency, formal, creative, simple, academic |
| **Grammar & Style Checker** | Fix errors, get style suggestions, corrected text output |
| **AI Essay Writer** | 5 essay types, 4 length options, markdown output |
| **Writing Improver** | 5 focus modes — clarity, conciseness, engagement, academic, business |
| **Title Generator** | Generate multiple title options with selectable cards |
| **Email Writer** | Professional email composition with subject + body |
| **Social Media Post Generator** | Multi-platform content with hashtag suggestions |
| **Resume Builder** | ATS score, structured preview, multi-format export |

### Education & Study (7 tools)
| Tool | Description |
|------|-------------|
| **Text Summarizer** | Paragraph/bullet modes with compression stats |
| **Citation Generator** | APA, MLA, Chicago, Harvard, IEEE styles |
| **Flashcard Creator** | Card/list views with flip interaction, CSV export |
| **Quiz Generator** | Interactive multiple-choice quizzes with scoring |
| **Course Outline Creator** | Modules, lessons, learning objectives, assessments |
| **Research Assistant** | Multi-source research with knowledge graph, export to PDF/Word/MD |
| **Content Outline Generator** | 5 types — essay, article, report, story, presentation |

### Language & Analysis (6 tools)
| Tool | Description |
|------|-------------|
| **Language Translator** | 20+ languages with searchable flag-emoji grid |
| **Tone Analyzer** | Structured tone/emotion/reading-level analysis |
| **Plagiarism Checker** | AI-powered originality scoring with suggestions |
| **Keyword Extractor** | Relevance pills, category grouping |
| **Code Generator** | Code/tests/usage tabs, complexity badges |
| **Meta Description Generator** | SEO score, SERP preview, selectable descriptions |

### SEO & Marketing (4 tools)
| Tool | Description |
|------|-------------|
| **LinkedIn Post Optimizer** | Hook/hashtag/CTA sections, 2-column layout |
| **Content Calendar** | 30-day strategy with hooks, captions, posting times |
| **Content Repurposer** | Transform content across multiple platforms |
| **Keyword Extractor** | Extract and group keywords by relevance |

### Media & Visual (4 tools)
| Tool | Description |
|------|-------------|
| **VisiSense AI** | Screen/image analysis with Q&A, translation, OCR |
| **Video Downloader** | Download videos with format/quality selection |
| **Video Chat AI** | Upload video and chat about its content via transcription |
| **Image Comparison** | Side-by-side image comparison and analysis |

### External Tools (2 tools)
| Tool | Description |
|------|-------------|
| **PrepZa** | Data Platform |
| **LogiForge** | DSA & discrete math logic builder |

### Platform Features
- **Sovereign Agent** — Function-calling agent with SSE streaming, multi-provider LLM (Groq/OpenAI/Anthropic/Ollama), tool registry, and YAML workflows. See [docs/AGENTS.md](docs/AGENTS.md).
- **JWT Authentication** — Register, login, email verification, forgot/reset password
- **Polar Payments** — Pro subscription at $5/month with Polar integration
- **Gamification** — Reward coins, referral program, usage tracking
- **Export** — Download results as Markdown, PDF, or DOCX
- **Dark Mode** — Full dark/light theme support
- **Responsive** — Mobile-first design with Tailwind CSS
- **Contact Form** — Backend-validated contact submissions
- **Error Boundaries** — Graceful error handling across all components
- **Django Admin** — Full admin panel for tools, usage, documents, templates, agent runs

## 🏗️ Technology Stack

### Backend
- Python 3.11 / Django 5.2
- Django REST Framework
- PostgreSQL / SQLite (dev)
- Redis + Celery (async tasks)
- Groq AI API (Mixtral 8x7B-32768)
- Polar Payment Integration
- BeautifulSoup4 & Newspaper3k (web scraping)
- NetworkX (knowledge graphs)

### Frontend
- React 18 + TypeScript
- Tailwind CSS + Framer Motion
- React Query (TanStack Query)
- Zustand (state management)
- react-hook-form + react-hot-toast
- react-markdown + remark-gfm (rich output rendering)
- Heroicons

### Shared Components
- **ToolOutput** — Reusable output wrapper with markdown rendering, copy, export dropdown, regenerate, word/char stats
- **ToolInput** — Shared helpers: ToolTextArea, ToolOptionSelector, ToolHeader, ToolActions, ToolTips

### Infrastructure
- Docker & Docker Compose
- Nginx (reverse proxy)
- GitHub Actions CI/CD
- Let's Encrypt SSL
- Render / Railway / Vercel deployment configs

## 📦 Quick Start

### Prerequisites
- Docker and Docker Compose (recommended) OR
- Node.js 18+, Python 3.11+, PostgreSQL/SQLite

### With Docker
```bash
git clone https://github.com/etisamhaq/Sovereign-AI-Tools.git
cd ai-writing-platform

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your GROQ_API_KEY, SECRET_KEY, etc.

# Start all services
docker-compose -f docker-compose.dev.yml up
```

Access:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api
- Admin Panel: http://localhost:8000/admin

### Manual Setup (Without Docker)

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python init_db.py          # Seeds all 30 tools into the database
python manage.py runserver
```

#### Frontend
```bash
cd frontend
npm install
npm start
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Django secret key |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `GROQ_API_KEY` | Groq API key for AI features (primary LLM) |
| `OPENAI_API_KEY` | (Optional) OpenAI key — fallback LLM provider |
| `ANTHROPIC_API_KEY` | (Optional) Anthropic key — fallback LLM provider |
| `OLLAMA_BASE_URL` | (Optional) Local Ollama URL — fallback LLM provider |
| `AGENTS_DEFAULT_PROVIDER` | `groq` (default), `openai`, `anthropic`, `ollama` |
| `AGENTS_FALLBACK_PROVIDERS` | Comma-separated list of fallback providers |
| `AGENTS_MAX_STEPS` | Step budget per agent run (default `6`) |
| `AGENTS_TOOL_TIMEOUT` | Per-tool timeout, seconds (default `45`) |
| `AGENTS_ENABLE_MODERATION` | `true` to enable input moderation |
| `POLAR_ACCESS_TOKEN` | Polar API token for payments |
| `SENDGRID_API_KEY` | SendGrid API key for emails |
| `SENTRY_DSN` | (Optional) Sentry error tracking DSN |

See `.env.example` for the full list.

## Testing

```bash
# Backend tests (uses pytest + DRF; covers auth, tools, agents, runner, workflow)
cd backend
DJANGO_SETTINGS_MODULE=core.test_settings pytest -q

# Backend agent tests only (33 tests covering registry, runner, moderation,
# workflows, LLM router, REST API)
DJANGO_SETTINGS_MODULE=core.test_settings pytest agents/tests -q

# Frontend tests (jest + RTL)
cd frontend
CI=true npx react-scripts test --watchAll=false

# Frontend agent tests only (SSE parser, useAgentChat hook)
CI=true npx react-scripts test --watchAll=false --testPathPattern="agents.test|useAgentChat"

# Frontend build
cd frontend && npx react-scripts build
```

### Rate Limits
- Login: 10 requests per 5 minutes
- Register: 15 requests per hour
- API endpoints: 100 requests per minute

```bash
# Clear rate limits if needed
cd backend && python manage.py clear_cache
```

## 📁 Project Structure

```
ai-writing-platform/
├── backend/
│   ├── accounts/          # User auth, profiles, referrals
│   ├── agents/            # Sovereign Agent: function-calling planner, tools, workflows
│   │   ├── apps.py        # AppConfig (lazy-loads tool_bindings on ready)
│   │   ├── models.py      # Conversation, Message, AgentRun, AgentRunStep,
│   │   │                  #   Workflow, WorkflowRun, OutputRating
│   │   ├── registry.py    # Thread-safe ToolRegistry + AgentTool dataclass
│   │   ├── llm.py         # Groq / OpenAI / Anthropic / Ollama provider abstraction
│   │   │                  #   with router, fallback chain, cost estimation
│   │   ├── tool_bindings.py # Registers existing AIService tools as AgentTools
│   │   ├── services/
│   │   │   ├── runner.py        # AgentRunner: function-calling loop + SSE events
│   │   │   ├── workflow_runner.py # YAML workflow executor with template rendering
│   │   │   ├── streaming.py     # SSE framing + heartbeat + safe error wrapping
│   │   │   └── moderation.py    # Heuristic + prompt-injection guards
│   │   ├── workflows/     # YAML pipelines (blog_from_research, social_amplification, ...)
│   │   ├── views.py       # DRF viewsets + SSE endpoints + tool catalogue
│   │   ├── tasks.py       # Celery: cleanup_stale_conversations, run_workflow_async
│   │   └── tests/         # 33 pytest tests with FakeRouter
│   ├── api/               # API configuration & tests
│   ├── core/              # Django settings, middleware, celery
│   ├── monitoring/        # Health checks
│   ├── payments/          # Polar payment integration
│   ├── research/          # Research assistant module
│   ├── tools/             # All 30 AI tool views, models, serializers, admin
│   │   ├── admin.py       # Full admin registration for all models
│   │   ├── ai_service.py  # Groq AI integration with client pooling & caching
│   │   ├── models.py      # Tool, ToolUsage, Document, Template, SavedResult
│   │   ├── views.py       # BaseToolView + all tool endpoints
│   │   └── urls.py        # Tool routing (30+ endpoints)
│   ├── init_db.py         # Database seeder for all tools
│   └── manage.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── tools/     # 30 tool components + ToolOutput + ToolInput
│   │   │   ├── ChatBot.tsx # Floating agent widget — streams via SSE
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   └── useAgentChat.ts # Reducer hook driving the streaming UX
│   │   ├── pages/
│   │   │   ├── AgentPage.tsx   # Full-screen agent workspace
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── agents.ts       # Typed client + SSE parser
│   │   │   └── api.ts          # API client (axios + JWT auto-refresh)
│   │   ├── store/         # Zustand auth store
│   │   └── App.tsx        # Lazy-loaded routes + Suspense
│   └── package.json
├── docs/
│   ├── AGENTS.md          # Agentic AI architecture, env vars, tools, workflows, testing
│   └── ...
├── nginx/                 # Nginx configs
├── scripts/               # Deployment & setup scripts
├── systemd/               # Systemd service files
├── docs/                  # Additional documentation
├── docker-compose.yml
├── docker-compose.dev.yml
└── render.yaml
```

## 🚀 Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed production deployment instructions.

```bash
# Quick deploy with Docker
docker-compose up -d
docker-compose exec backend python manage.py migrate
docker-compose exec backend python manage.py createsuperuser
docker-compose exec backend python init_db.py
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- **Backend**: PEP 8, Black formatter
- **Frontend**: ESLint + Prettier, TypeScript strict mode

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## 📧 Support

- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/etisamhaq/Sovereign-AI-Tools/issues)
- Email: support@sovereign.com

## ✅ Production Status

| Area | Status |
|------|--------|
| 30 AI Tools | ✅ Fully implemented |
| Research Assistant | ✅ Multi-source with knowledge graphs |
| Payment Integration | ✅ Polar subscriptions |
| User Auth | ✅ JWT, email verification, password reset |
| Async Tasks | ✅ Celery + Redis |
| Export (PDF/DOCX/MD) | ✅ All tools |
| Django Admin | ✅ Full model registration |
| Error Handling | ✅ ErrorBoundary + safe type checking |
| Gamification | ✅ Reward coins + referral program |
| Dark Mode | ✅ Full support |
