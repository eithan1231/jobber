FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# install unzip
RUN apt update \
  && apt install unzip --no-install-recommends -y \
  && rm -rf /var/lib/apt/lists/*


FROM base AS build
COPY . /repo
WORKDIR /repo
RUN pnpm install --frozen-lockfile \
  && pnpm run -r build \
  && pnpm deploy --filter=@jobber/runner-node-entrypoint --prod /app



FROM base
WORKDIR /app
COPY --from=build /app/dist/index.js /app/jobber-entrypoint.js
