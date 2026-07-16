# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# GFL Inventory — single-container image for Coolify
#   • Builds the Vite/React frontend (dist/)
#   • Runs Express API which also serves dist/ and /uploads on one port
#   • Node 20 (matches local + Mutale Coolify pattern)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: production dependencies ────────────────────────────────────────
FROM node:20-bookworm AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: build frontend ─────────────────────────────────────────────────
FROM node:20-bookworm AS build
WORKDIR /app
# Coolify often sets NODE_ENV=production during build, which would skip
# vite/tailwind/devDependencies — force a full install for the SPA build.
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN NODE_ENV=production NODE_OPTIONS="--max-old-space-size=1536" npm run build

# ── Stage 3: runtime ────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

COPY server ./server
COPY shared ./shared
COPY package.json package-lock.json ./

RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
VOLUME ["/app/uploads"]

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
