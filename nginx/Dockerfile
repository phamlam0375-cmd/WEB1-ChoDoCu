FROM node:20-alpine AS frontend-build

WORKDIR /app

ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

ARG VITE_ENABLE_GOOGLE_MOCK=false
ENV VITE_ENABLE_GOOGLE_MOCK=$VITE_ENABLE_GOOGLE_MOCK

ARG VITE_DEV_ACCOUNT_SWITCHER=false
ENV VITE_DEV_ACCOUNT_SWITCHER=$VITE_DEV_ACCOUNT_SWITCHER

RUN npm install --global pnpm@10

COPY frontend/package.json frontend/pnpm-lock.yaml ./
ENV PNPM_ONLY_BUILT_DEPENDENCIES=@parcel/watcher
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
ARG VITE_D01_DEMO_MODE=false
ENV VITE_D01_DEMO_MODE=${VITE_D01_DEMO_MODE}
RUN pnpm run build

FROM nginx:alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/dist /usr/share/nginx/html

EXPOSE 80
