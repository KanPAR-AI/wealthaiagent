# frontend/Dockerfile

# Stage 1: Build the React application
FROM node:20-alpine AS builder
WORKDIR /app

# Install python/pip and build dependencies for native modules
RUN echo "Installing build dependencies..." && \
    apk add --no-cache python3 make g++ && \
    echo "Build dependencies installed successfully"

# Copy package files.
# packages/ must be present BEFORE npm install: the web app depends on the
# @wealthai/core workspace (npm links node_modules/@wealthai/core ->
# ../packages/core at install time). apps/ (the Expo mobile app) stays
# excluded via .dockerignore — its workspace glob matching nothing is fine.
COPY package.json package-lock.json* ./
COPY packages ./packages

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

# Tests do NOT run inside the image build. Cloud Build's "Run Tests" step is
# the hard gate, on the FULL checkout. This in-image second run was gating
# deploys on a worse copy of the same suite: the image's COPY context lacks
# files some suites import (android-pickers died on a missing
# apps/astro/src/lib/auth.ts), and the throttled build env timed out
# memory-toolbar at 5s — failures impossible in the real gate. Same lesson
# chatservice learned and recorded in its cloudbuild.yaml: test the
# checkout, build the artifact, never re-test inside the build.

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
