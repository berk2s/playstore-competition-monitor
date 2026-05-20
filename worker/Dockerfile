FROM mcr.microsoft.com/playwright:v1.60.0-jammy AS build
WORKDIR /app
RUN corepack enable
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN yarn build

FROM mcr.microsoft.com/playwright:v1.60.0-jammy
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json /app/yarn.lock ./
COPY --from=build /app/dist ./dist
RUN yarn install --production --frozen-lockfile
CMD ["node", "dist/index.js"]
