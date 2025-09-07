# Jobber

Do you like Lambda, the concept of disposable functions? Well this is surely the solution for you! Do you find OpenFaaS overly complicated for a basic setup? Me too! Are you a fan of basic docker-compose setup scripts? Ai Ai!

The objective of this project is to provide nothing more than a basic interface to create lambda-like functions. These functions can be triggered by a HTTP gateway, MQTT events, or cron schedules!

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

### Screenshots

[Click Here](/docs/pictures.md) to see some demo pictures of the application in action!

<hr>

### Metrics (Prometheus)

[Click Here](/docs/metrics.md) For more detailed explanation of metrics!

<hr>

### Environment Variables

[Click Here](/docs/environment-variables.md) For more extensive list of environment variable configuration!

- `DATABASE_URL` Postgres connection URL. Example: `postgresql://user:pass@host/db`
- `JOBBER_NAME` The name of your jobber instance, should be unique per host.
- `MANAGER_PORT` Port that runner-manager server operates on. Default: 5211
- `MANAGER_HOST` Host that runner-manager server operates on. Default: hostname()
- `STARTUP_USERNAME` The administrator account username. Created at every startup. Has full permissions. If you change this after a previous start, it will create a NEW account, not update the previous account.
- `STARTUP_PASSWORD` The administrator account password.
<hr>

### Docker Compose

See docker-compose.yaml for a sample setup. Networking is configured securely, volumes are created, and all essential details are provided there.

<hr>

### HTTP Ports

For security reasons, this application hides behind two separate ports. One is for the administrative panel, and the other is for the HTTP API Gateway for function invocations.

Port 3000: Administrative panel.
Port 3001: HTTP Gateway (Router for HTTP triggers)

<hr>

### Logging (Loki and Database)

It is highly suggested to use loki as your log driver if you have a decent amount of log-spam, especially high bandwidth logging. This will defer a lot of load from the database.

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
