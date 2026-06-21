# =========================================
# Stage 1: Build static assets
# =========================================
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
# Run compilation build scripts
RUN node scripts/build-blog.js
RUN node scripts/generate-sitemap.js

# =========================================
# Stage 2: Serve static files with Nginx
# =========================================
FROM nginx:1.25-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy static site content from build stage
COPY --from=builder /app/*.html           /usr/share/nginx/html/
COPY --from=builder /app/robots.txt       /usr/share/nginx/html/
COPY --from=builder /app/sitemap.xml      /usr/share/nginx/html/
COPY --from=builder /app/styles/          /usr/share/nginx/html/styles/
COPY --from=builder /app/scripts/         /usr/share/nginx/html/scripts/
COPY --from=builder /app/data/            /usr/share/nginx/html/data/
COPY --from=builder /app/games/           /usr/share/nginx/html/games/
COPY --from=builder /app/blog/            /usr/share/nginx/html/blog/
COPY --from=builder /app/author/          /usr/share/nginx/html/author/

# Expose port
EXPOSE 90

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:90/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
