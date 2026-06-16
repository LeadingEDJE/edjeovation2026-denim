FROM node:24-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/design-system/package.json packages/design-system/package.json
RUN npm ci

# Dev stage: source (apps/web + packages) is bind-mounted and `vite` is run via
# compose. Deps are installed here and shielded from the mount by an anonymous
# volume on /app/node_modules (see docker-compose.override.yml).
FROM deps AS dev
EXPOSE 5173
CMD ["npm", "run", "dev", "-w", "@denim-fit/web"]

FROM deps AS build

ARG VITE_API_BASE_URL=http://localhost:4000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY packages packages
RUN npm run build -w @denim-fit/design-system
COPY apps/web apps/web
RUN npm run build -w @denim-fit/web

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV VITE_API_BASE_URL=""

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev

COPY --from=build /app/apps/web/dist apps/web/dist
COPY apps/web/scripts/write-runtime-env.mjs apps/web/scripts/write-runtime-env.mjs

EXPOSE 5173
CMD ["sh", "-c", "node apps/web/scripts/write-runtime-env.mjs && npm run start -w @denim-fit/web"]
