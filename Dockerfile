# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=25.9.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Next.js"

# Next.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Install pnpm
ARG PNPM_VERSION=10.33.0
RUN npm install -g pnpm@$PNPM_VERSION


# Throw-away build stage to reduce size of final image
FROM base AS build

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3 ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install node modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod=false

# Copy application code
COPY . .

# Build application
RUN npx next build --experimental-build-mode compile

# Remove development dependencies
RUN pnpm prune --prod && rm -rf .next/cache

# Fail the build immediately if native SQLite bindings were not installed.
RUN node -e "const Database = require('better-sqlite3'); const db = new Database(':memory:'); db.close()"


# Final stage for app image
FROM base

# Copy built application
COPY --from=build /app /app

# Setup sqlite3 on a separate volume
ENV BETTER_AUTH_SQLITE_PATH="/data/auth.sqlite" \
    FILE_STORAGE_ROOT="/data/uploads"
RUN mkdir -p /data/uploads
VOLUME /data

# Entrypoint sets up the container.
ENTRYPOINT [ "node", "/app/docker-entrypoint.js" ]

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "pnpm", "run", "start" ]
