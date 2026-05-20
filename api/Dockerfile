FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json ./
RUN yarn install
COPY tsconfig.json ./
COPY src ./src
RUN yarn build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
RUN yarn install --production
EXPOSE 4000
CMD ["node", "dist/index.js"]
