FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.15.1 --activate


FROM base AS build
COPY . /repo
WORKDIR /repo
RUN apt update \
  && apt install protobuf-compiler --no-install-recommends -y \
  && pnpm install --frozen-lockfile \
  && pnpm run -r build \
  && pnpm --prod --filter=@jobber/gateway --node-linker hoisted deploy /app



FROM base
WORKDIR /app
COPY --from=build /app /app
ENTRYPOINT ["node", "./dist/index.js"]