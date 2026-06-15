FROM node:24-alpine AS build

WORKDIR /app
ARG VITE_API_BASE_URL=http://localhost:4000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY apps/web apps/web
RUN npm run build -w @denim-fit/web

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev

COPY --from=build /app/apps/web/dist apps/web/dist

EXPOSE 5173
CMD ["npm", "run", "start", "-w", "@denim-fit/web"]
