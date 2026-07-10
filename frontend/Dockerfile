# Frontend Dockerfile
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy project files
COPY . .

# Set API URL to relative path (frontend nginx proxies /api to backend)
ENV REACT_APP_API_URL=/api

# Google OAuth client ID (build arg — passed from docker-compose)
ARG REACT_APP_GOOGLE_CLIENT_ID=""
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID

# Build the application
RUN npm run build

# Production stage
FROM nginx:1.27-alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

RUN addgroup -S app && adduser -S app -G app \
		&& chown -R app:app /usr/share/nginx/html /var/cache/nginx /var/run /var/log/nginx

# Expose port
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD wget -q --spider http://127.0.0.1/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]