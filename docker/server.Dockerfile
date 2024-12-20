FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# install unzip and docker-cli
RUN apt update \
  && apt install unzip ca-certificates curl --no-install-recommends -y \
  &&  install -m 0755 -d /etc/apt/keyrings \
  && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
  && chmod a+r /etc/apt/keyrings/docker.asc \
  && echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null \
  && apt update \
  && apt install docker-ce-cli --no-install-recommends -y \
  && rm -rf /var/lib/apt/lists/*


FROM base AS build
COPY . /repo
WORKDIR /repo
RUN pnpm install --frozen-lockfile \
  && pnpm run -r build \
  && pnpm deploy --filter=@jobber/server --prod /app \
  && cp -r packages/web/dist/* /app/public/



FROM base
WORKDIR /app
COPY --from=build /app /app
EXPOSE 3000
ENTRYPOINT ["node", "./dist/index.js"]