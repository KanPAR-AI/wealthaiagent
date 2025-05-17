# frontend/Dockerfile

# Stage 1: Build the React application
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
# The output will be in /app/dist, which should be configured for /chataiagent/ base path by vite.config.js
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:1.25-alpine

# Remove default Nginx configuration
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built static files from the builder stage
# The build output (dist) already has assets pathed for /chataiagent/
# Nginx root will be /usr/share/nginx/html; we place our app under chataiagent subdirectory within this root.
COPY --from=builder /app/dist /usr/share/nginx/html/chataiagent

# Expose port 80
EXPOSE 80

# Add a label for the source repository (good practice)
LABEL org.opencontainers.image.source https://github.com/KanPAR-AI/wealthaiagent

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]