# =========================================
# GameVault — Dockerfile
# nginx:alpine static file server
# =========================================

FROM nginx:1.25-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Copy static site content
COPY index.html       /usr/share/nginx/html/index.html
COPY styles/          /usr/share/nginx/html/styles/
COPY scripts/         /usr/share/nginx/html/scripts/
COPY data/            /usr/share/nginx/html/data/
COPY games/           /usr/share/nginx/html/games/
COPY assets/          /usr/share/nginx/html/assets/

# Expose port
EXPOSE 90

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:90/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
