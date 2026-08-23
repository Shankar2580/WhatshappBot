# ====================================================
# Multi-Stage Dockerfile for WhatsApp Booking Bot (EKS)
# ====================================================

# ----------------------------------------------------
# Stage 1: Build Dependencies
# ----------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Keep Node 22's bundled npm here — npm@latest (v12+) blocks native install scripts
# by default, which leaves sqlite3 without bindings.

# Install native compilation build dependencies required for native modules (e.g., sqlite3)
# py3-setuptools is required by node-gyp on Alpine
RUN apk add --no-cache python3 make g++ gcc py3-setuptools

ENV PYTHON=/usr/bin/python3

# Copy dependency specifications
COPY package*.json ./

# Install prod deps; sqlite3 must compile on Alpine (no reliable Node 22 musl prebuild)
RUN npm ci --omit=dev && \
    npm rebuild sqlite3 && \
    find node_modules/sqlite3 -name 'node_sqlite3.node' | grep -q .

# ----------------------------------------------------
# Stage 2: Production Runtime
# ----------------------------------------------------
FROM node:22-alpine AS runner

# Upgrade npm globally to fix vulnerability scan failures in base image bundled tools (tar, sigstore, etc.)
RUN npm install -g npm@latest

# Set production environment
ENV NODE_ENV=production \
    PORT=8009

WORKDIR /app

# Install curl for container healthchecks
RUN apk add --no-cache curl

# Copy node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source files
COPY . .

# Ensure storage directories exist with non-root ownership
RUN mkdir -p /app/public/tickets /app/public/downloaded_photos && \
    chown -R node:node /app

# Security Best Practice: Run container as non-root user
USER node

# Expose HTTP port
EXPOSE 8009

# Docker Healthcheck targeting the /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8009/wb/health || exit 1

# Start server
CMD ["node", "server.js"]
