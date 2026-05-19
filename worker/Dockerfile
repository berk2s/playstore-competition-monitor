FROM mcr.microsoft.com/playwright:v1.46.0-jammy AS build
WORKDIR /app
RUN corepack enable
COPY package.json ./
RUN pnpm install --frozen-lockfile || pnpm install
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM mcr.microsoft.com/playwright:v1.46.0-jammy
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod
CMD ["node", "dist/index.js"]
