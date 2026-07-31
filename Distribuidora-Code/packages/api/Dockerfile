# Build context is the monorepo root (see railway.json: dockerfilePath),
# not this folder — packages/api depends on the npm workspace (root
# node_modules) and on packages/db/prisma, both of which live outside
# packages/api and wouldn't be reachable if the context were this folder.

FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/api/package.json packages/api/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY packages/api packages/api
COPY packages/db packages/db
COPY packages/shared packages/shared

RUN npm run db:generate --workspace=packages/db
RUN npm run build --workspace=packages/db
RUN npm run build --workspace=packages/api

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api/package.json ./packages/api/package.json
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules

EXPOSE 3001

# Applies pending migrations before starting — safe to run on every deploy,
# a no-op when the schema is already up to date. Runs from packages/db since
# that's where the prisma CLI (a devDependency) actually resolves in this
# workspace — see packages/db/node_modules/.bin/prisma.
CMD ["sh", "-c", "cd packages/db && npx prisma migrate deploy && cd /app && node -r dotenv/config packages/api/dist/index.js"]
