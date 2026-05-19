# ---- Build ----
FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json ./
RUN pnpm install --frozen-lockfile || pnpm install
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# ---- Runtime ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod
EXPOSE 4000
CMD ["node", "dist/index.js"]
