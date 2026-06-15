FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY apps/api apps/api
COPY infra/db infra/db
RUN npm run build -w @denim-fit/api

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/src/migrate.js apps/api/src/migrate.js
COPY --from=build /app/infra/db infra/db

EXPOSE 4000
CMD ["sh", "-c", "npm run db:migrate -w @denim-fit/api && npm run start -w @denim-fit/api"]
