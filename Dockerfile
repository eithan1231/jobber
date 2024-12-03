FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

RUN apt update && apt install unzip --no-install-recommends -y
RUN rm -rf /var/lib/apt/lists/*



FROM base AS build
COPY . /repo
WORKDIR /repo
RUN pnpm install --frozen-lockfile
RUN pnpm run -r build
RUN pnpm deploy --filter=@jobber/server --prod /app
COPY --from=build /repo/packages/web/dist /app/public



FROM base
COPY --from=build /app /app
EXPOSE 3000
CMD [ "node", "./dist/index.js" ]
