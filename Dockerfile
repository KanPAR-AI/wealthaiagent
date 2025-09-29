# frontend/Dockerfile

# Stage 1: Build the React application
FROM node:20-alpine AS builder
WORKDIR /app

# Install python/pip and build dependencies for native modules
RUN echo "Installing build dependencies..." && \
    apk add --no-cache python3 make g++ && \
    echo "Build dependencies installed successfully"

# Copy package files
COPY package.json package-lock.json* ./

# Debug: Show package.json content
RUN echo "Package.json contents:" && cat package.json | head -20

# Install dependencies with verbose logging
RUN echo "Starting npm install..." && \
    rm -rf node_modules package-lock.json && \
    npm install --legacy-peer-deps 2>&1 && \
    echo "npm install completed successfully"

# Copy application code
COPY . .

# Debug: List files
RUN echo "Files in /app:" && ls -la

# Run tests during build with verbose output
RUN echo "Running tests..." && \
    npm run test:ci 2>&1 || (echo "Tests failed with exit code $?" && exit 1)

# Build the application with verbose output
RUN echo "Building application..." && \
    npm run build 2>&1 || (echo "Build failed with exit code $?" && exit 1)

# Stage 2: Serve the application with Nginx
FROM nginx:1.25-alpine
ENV PORT 8080 # Default port, Cloud Run will override this with its own $PORT value
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.template /etc/nginx/nginx.template 
# Copy as a template
COPY --from=builder /app/dist /usr/share/nginx/html/chataiagent

# This script will substitute $PORT in nginx.template and start nginx
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8080 
# Expose the port Nginx will listen on (dynamically set by $PORT)
LABEL org.opencontainers.image.source https://github.com/KanPAR-AI/wealthaiagent
CMD ["/usr/local/bin/entrypoint.sh"]
