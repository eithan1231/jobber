FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

# Corepack Enable, and setup
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

# Setup Postgres Client, unzip, and DockerCLI
RUN apt update \
  && apt install unzip ca-certificates curl postgresql-common --no-install-recommends -y \
  && /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y \
  && apt install postgresql-client-17 --no-install-recommends -y \
  && install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
  && chmod a+r /etc/apt/keyrings/docker.asc \
  && echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null \
  && apt update \
  && apt install docker-ce-cli --no-install-recommends -y \
  && rm -rf /var/lib/apt/lists/*
#

FROM base AS build
COPY . /repo
WORKDIR /repo

RUN pnpm install --frozen-lockfile \
  && pnpm run -r build \
  && pnpm --prod --filter=@jobber/server --node-linker hoisted deploy /app \
  && mkdir /app/public/ \
  && cp -r packages/web/dist/* /app/public/
#


FROM base
WORKDIR /app
COPY --from=build /app /app
EXPOSE 3000
ENTRYPOINT ["node", "./dist/index.js"]