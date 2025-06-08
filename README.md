# Jobber

Do you like Lambda, the concept of disposable functions? Well this is surely the solution for you! Do you find OpenFaaS overly complicated for a basic setup? Me too! Are you a fan of basic docker-compose setup scripts? Ai Ai!

The objective of this project is to provide nothing more than a basic interface to create lambda-like functions. These functions can be triggered by a HTTP gateway, MQTT events, or cron schedules!

<hr>

### Screenshots

[Click Here](/docs/pictures.md) to see some demo pictures of the application in action!

<hr>

### Terminology

- Jobber: This application/service
- Job: An individual job, containing multiple versions, runners, actions, triggers and environment variables.
- Action: Describes how a job should run, timeouts, parallelism, run-duration, etc.
- Trigger: Describes how a job should start. MQTT, HTTP, or a Schedule.
- Environment: Describes environment variables for a job.
- Runners: Describes a action that is currently running.
- Runner Manager: Describes the component that controls the connections between runners, actions and triggers.
- Gateway: Describes the http server we utilise for forwarding traffic to jobs and runners.

<hr>

### Docker Compose

See docker-compose.yaml for a sample setup. Networking is configured securely, volumes are created, and all essential details are provided there.

<hr>

### HTTP Ports

For security reasons, this application hides behind two separate ports. One is for the administrative panel, and the other is for the HTTP API Gateway for function invocations.

Port 3000: Administrative panel.
Port 3001: HTTP Gateway (Router for HTTP triggers)

<hr>

### Environment Variables

- `DATABASE_URL` Postgres connection URL. Eg: `postgresql://user:pass@host/db`
- `MANAGER_PORT` Port that runner-manager server operates on. Default: 5211
- `MANAGER_HOST` Host that runner-manager server operates on. Default: hostname()
- `RUNNER_IMAGE_NODE22_URL`: Runner docker image for Node22
- `RUNNER_IMAGE_NODE20_URL`: Runner docker image for Node20
- `RUNNER_CONTAINER_DOCKER_NETWORK`: Docker network that runners operate on. Needs access to MANAGER_HOST
- `LOG_DRIVER`: Logging method for runners. Enum: database, loki. Default: database.
- `LOG_DRIVER_LOKI_PUSH`: Loki log push url. Example: `http://localhost/loki/api/v1/push`
- `LOG_DRIVER_LOKI_QUERY`: Loki log query url. Example: `http://localhost/loki/api/v1/query_range`
- `LOG_DRIVER_LOKI_QUERY_RANGE`: Loki log query maximum look-back period, in seconds. Default is 60\*60\*24 (1d)
- `METRICS_PROMETHEUS_QUERY`: Prometheus metrics query url. Example: `http://localhost/api/v1/query_range`
- `METRICS_PROMETHEUS_JOB_NAME`: The `job_name` in your prometheus.yaml scraping config.
- `METRICS_PROMETHEUS_QUERY_STEP`: The step in seconds for the Prometheus query. Default is 15 seconds. Configure to your scrape_interval in Prometheus
<hr>

### Logging (Loki and Database)

It is highly suggested to use loki as your log driver if you have a decent amount of log-spam, especially high bandwidth logging. This will defer a lot of load from the database.

<hr>

### Metrics (Prometheus)

By default an endpoint of `/api/metrics` is available for prometheus scraping. This will allow you to record time-series data within your prometheus instance.

With addition to this, Jobber supports querying prometheus within the Jobber Dashboard to provide metrics and oversights without leaving Jobber. To achieve this, you need to configure the environment variables for `METRICS_PROMETHEUS_QUERY` and `METRICS_PROMETHEUS_JOB_NAME`.

Your prometheus config should look similar to:

```yaml
scrape_configs:
  - job_name: jobber_job_name
    metrics_path: /api/metrics
    scrape_interval: 15s
    static_configs:
      - targets: ["127.0.0.1"]
```

`METRICS_PROMETHEUS_QUERY` Environment variable should be set to `http://localhost/api/v1/query_range` if your prometheus is running locally.

`METRICS_PROMETHEUS_JOB_NAME` Environment variable should reflect the `job_name` option in your prometheus scraping config, as seen above. As per the configuration above, we should set it to `jobber_job_name`

`METRICS_PROMETHEUS_QUERY_STEP`: Environment variable should reflect your `scrape_interval` in prometheus.

<hr>

### Creating your first function

Documentation for this will be finalised in the future, though don't hold me to that. We will be providing a jobber-template repository which includes everything you need to create your first TypeScript job. In the meantime, feel free to reference the examples we have provided in the [/Examples Directory](/examples/). We have an example for [http-typescript](/examples/http-typescript/) and a [schedule-javascript](/examples/schedule-javascript/) application.

<hr>

### API

For further details on the API, please refer to the bruno scripts.

#### # GET `/api/job/`

Fetches list of jobs

#### # GET `/api/job/:jobId`

Fetches a specific job

#### # GET `/api/job/:jobId/environment/`

Fetches a job environment

#### # POST `/api/job/:jobId/environment/:name`

Creates a new environment variable. Body should be multi-part form with the following properties:

```
type = secret|text
value = {variable value}
```

#### # DELETE `/api/job/:jobId/environment/:name`

Deletes new environment variable.

#### # GET `/api/job/actions`

Fetches job actions

#### # GET `/api/job/actions:latest`

Fetches actions for the latest version

#### # GET `/api/job/triggers`

Fetches job triggers

#### # GET `/api/job/triggers:latest`

Fetches triggers for the latest version

#### # GET `/api/job/logs`

Fetches logs associated with a job

#### # GET `/api/job/runners`

Fetches all the current runners associated with a job

#### # GET `/api/job/:jobId/actions/:actionId/runners`

Fetches all the current runners associated with an actionId

#### # DELETE `/api/job/:jobId`

Deletes a job

#### # POST `/api/job/publish`

Publishes a archive (zip) file to jobber. Jobber automatically extracts metadata from the package.json file. If a job does not currently exist, one will be created. This is ideal for CI/CD.

The body should be a multi-part form, with the file attached to the name `archive`.

See Bruno for further information.

<hr>

### Security considerations

- Jobber requires access to a docker daemon, be it docker-in-docker, or the hosts docker daemon. We suggest defaulting to the hosts docker daemon, as its the only tested method. Managing the networking of DIND will be very difficult.
