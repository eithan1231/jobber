# Environment Variables

This document describes all environment variables used to configure Jobber.

## Database Configuration

- `DATABASE_URL` - Postgres connection URL  
  **Example:** `postgresql://user:pass@host/db`

- `DATABASE_BACKUP_SCHEDULE` - Cron schedule for automatic database backups  
  **Default:** `0 0 * * *`

- `DATABASE_BACKUP_SCHEDULE_TIMEZONE` - Timezone for the backup schedule  
  **Default:** `UTC`  
  **Examples:** `Australia/Melbourne`, `UTC`

- `DATABASE_BACKUP_RETENTION_COUNT` - Maximum number of backups to retain  
  **Default:** `32`

## Instance Configuration

- `JOBBER_NAME` - Unique identifier for this Jobber instance  
  **Note:** Should be unique per host  
  **Default:** Jobber

## Manager Server

- `MANAGER_PORT` - Port for the runner-manager server  
  **Default:** `5211`

- `MANAGER_HOST` - Host address for the runner-manager server  
  **Default:** `hostname()`

## Authentication

- `AUTH_PUBLIC_REGISTRATION_ENABLED` - Enable public user registration  
  **Values:** `true` | `false`

- `AUTH_PUBLIC_LOGIN_ENABLED` - Enable public user login  
  **Values:** `true` | `false`

- `STARTUP_USERNAME` - Administrator account username  
  **Note:** Created at every startup with full permissions. Changing this creates a new account rather than updating the existing one.  
  **Default:** `admin`

- `STARTUP_PASSWORD` - Administrator account password  
  **Default:** `Password1!`

## Runner Configuration

- `RUNNER_IMAGE_NODE24_URL` - Docker image URL for Node.js 24 runners  
  **Default:** eithan1231/runner-node-24:latest

- `RUNNER_IMAGE_NODE22_URL` - Docker image URL for Node.js 22 runners  
  **Default:** eithan1231/runner-node-22:latest

- `RUNNER_IMAGE_NODE20_URL` - Docker image URL for Node.js 20 runners
  **Default:** eithan1231/runner-node-20:latest

- `RUNNER_CONTAINER_DOCKER_NETWORK` - Docker network for runner containers  
  **Note:** Must have access to `MANAGER_HOST`

- `RUNNER_ALLOW_DOCKER_ARGUMENT_TYPES` - Permitted Docker argument types for projects  
  **Values:** `volumes`, `networks`, `labels`, `memoryLimit`, `directPassthroughArguments`  
  **Default:** None  
  **Example:** `volumes,labels,memoryLimit`  
  **Warning:** Understand security implications before enabling

- `RUNNER_ALLOW_ARGUMENT_DIRECT_PASSTHROUGH` - Enable direct passthrough arguments  
  **Default:** `false`  
  **Warning:** This is insecure and should only be enabled in trusted environments

## Logging

- `LOG_DRIVER` - Logging method for runners  
  **Values:** `database` | `loki`  
  **Default:** `database`

### Loki Configuration (when LOG_DRIVER=loki)

- `LOG_DRIVER_LOKI_PUSH` - Loki log ingestion endpoint  
  **Example:** `http://localhost:3100/loki/api/v1/push`

- `LOG_DRIVER_LOKI_QUERY` - Loki query endpoint  
  **Example:** `http://localhost:3100/loki/api/v1/query_range`

- `LOG_DRIVER_LOKI_QUERY_RANGE` - Maximum query look-back period  
  **Default:** `86400` (24 hours)

## Metrics

- `METRICS_PROMETHEUS_QUERY` - Prometheus query endpoint  
  **Example:** `http://localhost:9090/api/v1/query_range`

- `METRICS_PROMETHEUS_JOB_NAME` - Job name in Prometheus scraping configuration  
  **Note:** Must match the `job_name` in your `prometheus.yml`

- `METRICS_PROMETHEUS_QUERY_STEP` - Query step interval in seconds  
  **Default:** `15`  
  **Note:** Should match your Prometheus `scrape_interval`

## Debug

- `DEBUG_HTTP` - Enables verbose output of all requests via the Jobber Server  
  **Values:** `true` | `false`  
  **Default:** `false`

- `DEBUG_RUNNER` - Enables debugging of Jobber Runners  
  **Values:** `true` | `false`  
  **Default:** `false`
