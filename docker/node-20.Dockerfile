FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate

# install unzip
RUN apt update \
  && apt install unzip --no-install-recommends -y \
  && rm -rf /var/lib/apt/lists/*


# Build tooling (tsdown, vitest) requires a newer Node than this runtime. The bundled entrypoint
# targets ES2020, so it still runs on the runtime image below.
FROM node:24-slim AS build
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate
COPY . /repo
WORKDIR /repo
RUN pnpm install --frozen-lockfile \
  && pnpm run -r build \
  && pnpm --prod --filter=@jobber/runner-node-entrypoint --node-linker hoisted deploy /app



FROM base
WORKDIR /app
COPY --from=build /app/dist/index.js /app/jobber-entrypoint.js
