FROM node:20-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

ENV PNPM_ONLY_BUILT_DEPENDENCIES=bcrypt
RUN pnpm install --frozen-lockfile

COPY . .

EXPOSE 3000

CMD ["pnpm", "run", "docker:dev"]