# AI Tools Setup Guide

## Overview
The AI Writing Platform uses Groq's LLM API to power its AI tools. This guide will help you set up the AI functionality.

## Getting a Groq API Key

1. Visit [Groq Console](https://console.groq.com)
2. Sign up for a free account
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (it starts with `gsk_`)

## Configuration

### Option 1: Using .env file (Recommended)
1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and replace `your_groq_api_key_here` with your actual API key:
   ```
   GROQ_API_KEY=gsk_your_actual_key_here
   ```

### Option 2: Export as environment variable
```bash
export GROQ_API_KEY=gsk_your_actual_key_here
docker compose -f docker-compose.dev.yml up
```

## Available Models
The platform supports various Groq models. The default is `llama-3.3-70b-versatile`. You can change it in your `.env` file:
- `llama-3.3-70b-versatile` (Default - Best overall performance)
- `mixtral-8x7b-32768` (Faster, good quality)
- `llama3-8b-8192` (Fastest, lower quality)

## Testing the Tools

### Without API Key (Mock Mode)
The platform will work without an API key but will return mock responses marked with [MOCK]. This is useful for:
- UI/UX development
- Testing the application flow
- Demo purposes

### With API Key
Once configured, the tools will provide real AI-powered responses:

1. **Paraphrase Tool** - Rewrites text in various styles
2. **Grammar Check Tool** - Identifies and corrects grammar errors

## Troubleshooting

### Check if API key is loaded:
```bash
docker compose -f docker-compose.dev.yml exec backend python -c "from django.conf import settings; print(f'API Key configured: {bool(settings.GROQ_API_KEY and settings.GROQ_API_KEY != \"your_groq_api_key_here\")}')"
```

### View backend logs:
```bash
docker compose -f docker-compose.dev.yml logs backend
```

### Common Issues:
- **"Failed to paraphrase text"** - Check your API key is valid
- **Rate limits** - Free tier has limits, upgrade for production use
- **Network errors** - Ensure your internet connection is stable

## Production Deployment
For production, ensure:
1. API key is stored securely (use environment variables, not .env files)
2. Implement rate limiting to control costs
3. Monitor API usage through Groq console
4. Consider caching frequent requests