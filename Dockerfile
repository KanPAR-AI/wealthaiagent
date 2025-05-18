# frontend/Dockerfile

# Stage 1: Build the React application
FROM node:20-alpine AS builder 
# Recommended: Update to Node 20
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

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