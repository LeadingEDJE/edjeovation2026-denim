FROM node:24-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/design-system/package.json packages/design-system/package.json
RUN npm ci

# Dev stage: source is bind-mounted and the dev server (tsx watch) is run via
# compose. Deps are installed here and shielded from the mount by an anonymous
# volume on /app/node_modules (see docker-compose.override.yml).
FROM deps AS dev
EXPOSE 4000
CMD ["npm", "run", "dev", "-w", "@denim-fit/api"]

FROM deps AS build

COPY apps/api apps/api
COPY infra/db infra/db
COPY infra/wiremock/__files infra/wiremock/__files
RUN npm run build -w @denim-fit/api

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/src/migrate.js apps/api/src/migrate.js
COPY --from=build /app/apps/api/src/seed-local-appointments.js apps/api/src/seed-local-appointments.js
COPY --from=build /app/infra/db infra/db
COPY --from=build /app/infra/wiremock/__files infra/wiremock/__files

EXPOSE 4000
CMD ["sh", "-c", "npm run db:migrate -w @denim-fit/api && npm run start -w @denim-fit/api"]
