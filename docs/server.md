# Server

The server has been kept as simple as possible, to create a simple self hosted function platform. It can be broken down in to a few core concepts, a Job, Triggers, and Actions. There is more, but to understand how this works, thats primarily whats relevant.

## Triggers

We have triggers to listen and wait for request/events. When an trigger has been triggered, it sends the trigger payload to the Runner-Manager. The Runner-Manager will delegate the request to a runner.

HTTP Trigger: We create a Jobber-Gateway, a simple HTTP server. When that server receives a request, we attempt to match it with a trigger. If we can match it to a trigger, we route it appropriately through Runner-Manager.

MQTT Trigger: We create a MQTT Client which can subscribe to topics described by the Job's Trigger configuration. Upon receiving a subscribed topic, we forward said message to Runner Manager.

Cron Trigger: Every second we check to see if any crons are scheduled to run. If we find a scheduled cron, we forward the cron to the Runner Manager.

## Actions

Actions are triggered by triggers. When there is a trigger, an action will be invoked. Not to be confused with Runners, runners are entirely a runtime description of actions, however they are closely related.

Actions have the following properties:

- runner-image: Node20, Node22, Python etc
- runner-asynchronous: Can it process requests concurrently?
- runner-min-count: Minimum amount of runners for this action. To avoid cold starts, can be set to 1.
- runner-max-count: Maximum amount of runners for this action.
- runner-timeout: Duration of request, before reaching timeout.
- runner-max-age: Duration of the underlying runner (container) before graceful closure.
- runner-max-age-hard: Duration of underlying runner (container) before forceful closure.
- runner-mode: standard or run-once. Standard allows runner to process infinite requests. Run-once only allows runner to process a single request, before terminating the underlying runner (container).

## Runner Manager

This will handle the lifecycle of runners, using actions as their guidelines. For instance, the Runner Manager will spawn underlying runners, terminate underlying runners, route requests to runners via the runner-server, and entirely manage runners life-cycle from beginning to end.

## Runner Server

Responsible for handling communication with runners. Processing job requests goes through the runner server, before reaching the runner itself. The runner server will send the source-code for the runner to the runner, as it is initialising.

## Runner

A runner is the underlying container for a job, and is entirely managed by the runner-manager. When a runner has been started, it attempts to connect to the runner-server to authenticate who the runner is and what job it belongs to, and it also fetches the source code that it is destine to run.
