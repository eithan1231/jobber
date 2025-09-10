# API

## Auth

#### # POST `/api/auth/login`

<details>
<summary>Request</summary>

```JSON
{
  "username": "admin",
  "password": "Password1!"
}
```

</details>

<details>
<summary>Response</summary>

**Note:** cookie `jobber-session` is set on success

```JSON
{
  "success": true,
  "message": "Login successful",
  "data": {}
}
```

</details>

#### # POST `/api/auth/register`

<details>
<summary>Request</summary>

```JSON
{
  "username": "admin",
  "password": "Password1!"
}
```

</details>

<details>
<summary>Response</summary>

**Note:** cookie `jobber-session` is set on success

```JSON
{
  "success": true,
  "message": "Registration successful",
  "data": {}
}
```

</details>

#### # GET `/api/auth`

<details>
<summary>Response</summary>

```JSON
{
  "success": true,
  "data": {
    "permissions": [...],
    "user": {
      "id": "00000000-0000-0000-0000-000000000000",
      "username": "anonymous"
    },
    "session": {
      "expires": "Wed Sep 11 2001 00:00:00 GMT+1000 (Australian Eastern Standard Time)"
    }
  }
}
```

</details>

## User

#### # GET `/api/users/`

_Lists all user accounts_

<details>
<summary>Permissions</summary>

- `users` READ
- `users/:userId` READ

</details>

<details>
<summary>Response</summary>

```JSON
{
  "success": true,
  "message": "Ok",
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "username": "anonymous",
      "permissions": [...],
      "created": "..."
    }
  ]
}
```

</details>

#### # GET `/api/users/:userId`

_Fetches specific user account_

<details>
<summary>Permissions</summary>

- `users` READ
- `users/:userId` READ

</details>

<details>
<summary>Response</summary>

```JSON
{
  "success": true,
  "message": "Ok",
  "data": {
    "id": "00000000-0000-0000-0000-000000000000",
    "username": "anonymous",
    "permissions": [...],
    "created": "..."
  }
}
```

</details>

#### # POST `/api/users/`

_Creates new user account_

<details>
<summary>Permissions</summary>

- `users` WRITE

</details>

<details>
<summary>Request</summary>

```JSON
{
  "username": "example",
  "password": "Password1!",
  "permissions": [
    {
      // Super admin permissions
      "effect": "allow",
      "resource": "*",
      "action": ["read", "write", "delete"]
    }
  ]
}
```

</details>

<details>
<summary>Response</summary>

```JSON
{
  "success": true,
  "message": "User created successfully",
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "username": "example",
      "permissions": [...],
      "created": "..."
    }
  ]
}
```

</details>

#### # PUT `/api/users/:userId`

_Updates existing user_

<details>
<summary>Permissions</summary>

- `users/:userId` WRITE
- `users/:userId/username` WRITE - Is username writable.
- `users/:userId/password` WRITE - Is username writable.
- `users/:userId/permissions` WRITE - Is username writable.

</details>

<details>
<summary>Request</summary>

**Note: All fields are optional!**

```JSON
{
  // Optional - Ensure sufficient permissions
  "username": "example",

  // Optional - Ensure sufficient permissions
  "password": "Password1!",

  // Optional - Ensure sufficient permissions
  "permissions": [
    {
      // Super admin permissions
      "effect": "allow",
      "resource": "*",
      "action": ["read", "write", "delete"]
    }
  ]
}
```

</details>

<details>
<summary>Response</summary>

```JSON
{
  "success": true,
  "message": "User updated successfully",
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "username": "example",
      "permissions": [...],
      "created": "..."
    }
  ]
}
```

</details>

## API Tokens

#### # GET `/api/api-tokens/`

_Lists all api tokens_

<details>
<summary>Permissions</summary>

- `api-tokens` READ
- `api-tokens/:tokenId` READ

</details>

<details>
<summary>Response</summary>

```JSON
{
  "success": true,
  "message": "Ok",
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "userId": "00000000-0000-0000-0000-000000000000",
      "description": "...",
      "permissions": [...],
      "status": "enabled", // enabled or disabled
      "created": "...",
      "expires": "..."
    }
  ]
}
```

</details>

#### # GET `/api/api-tokens/:tokenId`

_Fetches specific token_

<details>
<summary>Permissions</summary>

- `api-tokens` READ
- `api-tokens/:tokenId` READ

</details>

<details>
<summary>Response</summary>

```JSON
{
  "success": true,
  "message": "Ok",
  "data": {
    "id": "00000000-0000-0000-0000-000000000000",
    "userId": "00000000-0000-0000-0000-000000000000",
    "description": "...",
    "permissions": [...],
    "status": "enabled", // enabled or disabled
    "created": "...",
    "expires": "..."
  }
}
```

</details>

#### # POST `/api/api-tokens/`

_Creates new API token_

<details>
<summary>Permissions</summary>

- `api-tokens` WRITE

</details>

<details>
<summary>Request</summary>

```JSON
{
  "permissions": [...],
  "description": "...",
  "ttl": 60 // In seconds
}
```

</details>

<details>
<summary>Response</summary>

```JSON
{
  "success": true,
  "message": "Ok",
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "token": "token", // Important! This is view-once!
      "userId": "00000000-0000-0000-0000-000000000000",
      "description": "...",
      "permissions": [...],
      "status": "enabled", // enabled or disabled
      "created": "...",
      "expires": "..."
    }
  ]
}
```

</details>

#### # PUT `/api/api-tokens/:tokenId`

_Updates an API token_

<details>
<summary>Permissions</summary>

- `api-tokens` WRITE
- `api-tokens/:tokenId` WRITE

</details>

<details>
<summary>Request</summary>

```JSON
{
  "permissions": [...],
  "status": "enabled", // enabled or disabled
  "description": "..."
}
```

</details>

<details>
<summary>Response</summary>

```JSON
{
  "success": true,
  "message": "Ok",
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "userId": "00000000-0000-0000-0000-000000000000",
      "description": "...",
      "permissions": [...],
      "status": "enabled", // enabled or disabled
      "created": "...",
      "expires": "..."
    }
  ]
}
```

</details>

## Metrics & Config

#### # GET `/api/config`

_An endpoint for web-ui configuration and metadata_

<details>
<summary>Permissions</summary>

**Note:** This is publicly accessible, and holds no data which poses any security risks.

</details>

<details>
<summary>Response</summary>

```JSON
{
  "success": true,
  "data": {
    "jobberName": "Jobber",
    "features": {
      "metricsEnabled": false,
      "actionDockerArgumentVolumesEnabled": false,
      "actionDockerArgumentNetworksEnabled": false,
      "actionDockerArgumentLabelsEnabled": false,
      "actionDockerArgumentMemoryLimitEnabled": false,
      "actionDockerArgumentDirectPassthroughEnabled": false,
    },
  },
}
```

</details>

#### # GET `/api/metrics`

_Prometheus Metrics_

<details>
<summary>Permissions</summary>

**Note:** Add the permission below to an API key, and configure that in your prometheus configuration. Alternatively you enable the anonymous user, and give it the permission. This will make this endpoint completely public, which may pose security risks.

- `system/metrics/prometheus` READ

</details>

<details>
<summary>Response</summary>

```
... a prometheus consumable response
```

</details>

#### # GET `/api/metrics/overview`

_Basic dashboard overview metrics_

<details>
<summary>Permissions</summary>

- `system/metrics/overview` READ

</details>

<details>
<summary>Response</summary>

```JSON
{
  "success": true,
  "data": {
    "runnerMetrics": {
      "runnersTotal": 0,
      "runnersStarting": 0,
      "runnersReady": 0,
      "runnersClosing": 0,
      "runnersClosed": 0,

      "runnersLoadTotal": 0,
      "runnersLoadAverage": 0,

      "lastRequestAt": 0,
    },

    "jobsMetrics": {
      "jobsTotal": 0,
      "jobsDisabled": 0,
      "jobsEnabled": 0,
    },

    "uptime": 0 // Uptime in seconds
  },
}
```

</details>

## Job -> Actions

#### # GET `/api/job/:jobId/actions`

_Fetches all actions with associated job_

<details>
<summary>Permissions</summary>

- `job/:jobId/actions/:actionId` READ

</details>

<details>
<summary>Response</summary>

```JSON
{
  "success": true,
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "jobId": "00000000-0000-0000-0000-000000000000",
      "jobVersionId": "00000000-0000-0000-0000-000000000000",
      "runnerMode": "standard", // "standard" or "run-once"
      "runnerAsynchronous": false,
      "runnerMinCount": 0,
      "runnerMaxCount": 0,
      "runnerTimeout": 60, // In seconds
      "runnerMaxIdleAge": 0, // In seconds
      "runnerMaxAge": 0, // In seconds
      "runnerMaxAgeHard": 0, // In Seconds

      "runnerDockerArguments": {
        // Optional:
        "networks": [""],

        // Optional:
        "volumes": [
          {
            "source": "",
            "target": "",
            "mode": "rw" // rw or ro
          }
        ],

        // Optional:
        "memoryLimit": "512m",

        // Optional & Risky:
        "directPassthroughArguments": []
      },

      // DEPRECATED:
      "version": "...",
    }
  ]
}
```

</details>

#### # GET `/api/job/:jobId/actions:current`

_Fetches the action for the activated job version_

<details>
<summary>Permissions</summary>

- `job/:jobId/actions/:actionId` READ

</details>

<details>
<summary>Response</summary>

```JSON
{
  "success": true,
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "jobId": "00000000-0000-0000-0000-000000000000",
      "jobVersionId": "00000000-0000-0000-0000-000000000000",
      "runnerMode": "standard", // "standard" or "run-once"
      "runnerAsynchronous": false,
      "runnerMinCount": 0,
      "runnerMaxCount": 0,
      "runnerTimeout": 60, // In seconds
      "runnerMaxIdleAge": 0, // In seconds
      "runnerMaxAge": 0, // In seconds
      "runnerMaxAgeHard": 0, // In Seconds

      "runnerDockerArguments": {
        // Optional:
        "networks": [""],

        // Optional:
        "volumes": [
          {
            "source": "",
            "target": "",
            "mode": "rw" // rw or ro
          }
        ],

        // Optional:
        "memoryLimit": "512m",

        // Optional & Risky:
        "directPassthroughArguments": []
      },

      // DEPRECATED:
      "version": "...",
    }
  ]
}
```

</details>

## Job -> Triggers

#### # GET `/api/job/:jobId/triggers`

_Fetches all triggers with associated job_

<details>
<summary>Permissions</summary>

- `job/:jobId/triggers/:triggerId` READ

</details>

<details>
<summary>Response</summary>

```JSON
{
  "success": true,
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "jobId": "00000000-0000-0000-0000-000000000000",
      "jobVersionId": "00000000-0000-0000-0000-000000000000",
      "context": {
        "type": "schedule",
        "cron": "* * * * *",

        "name": "example schedule", // <-- Optional
        "timezone": "Australia/Melbourne", // <-- Optional
      },

      "status": {
        "status": "unhealthy", // unhealthy, healthy, unknown
        "message": ""
      }
    },
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "jobId": "00000000-0000-0000-0000-000000000000",
      "jobVersionId": "00000000-0000-0000-0000-000000000000",
      "context": {
        "type": "http",
        "name": "example http", // <-- Optional

        // If any of the below are omitted, it acts as a wildcard.
        "hostname": "", // <-- Optional
        "method": "", // <-- Optional
        "path": "", // <-- Optional
      },

      "status": {
        "status": "unhealthy", // unhealthy, healthy, unknown
        "message": ""
      }
    },
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "jobId": "00000000-0000-0000-0000-000000000000",
      "jobVersionId": "00000000-0000-0000-0000-000000000000",
      "context": {
        "type": "mqtt",
        "name": "example mqtt", // <-- Optional
        "topics": [""],
        "connection": {
          "protocol": "ws", // wss, ws, mqtt or mqtts
          "protocolVariable": "",

          "port": "",
          "portVariable": "", // <-- Can reference job environment variable/secret

          "host": "",
          "hostVariable": "", // <-- Can reference job environment variable/secret

          "username": "",
          "usernameVariable": "", // <-- Can reference job environment variable/secret

          "password": "",
          "passwordVariable": "", // <-- Can reference job environment variable/secret

          "clientId": "",
          "clientIdVariable": "", // <-- Can reference job environment variable/secret

        }
      },

      "status": {
        "status": "unhealthy", // unhealthy, healthy, unknown
        "message": ""
      }
    }
  ]
}
```

</details>

#### # GET `/api/job/:jobId/triggers:current`

_Fetches the triggers for the activated job version_

<details>
<summary>Permissions</summary>

- `job/:jobId/triggers/:triggerId` READ

</details>

<details>
<summary>Response</summary>

```JSON
{
  "success": true,
  "data": [
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "jobId": "00000000-0000-0000-0000-000000000000",
      "jobVersionId": "00000000-0000-0000-0000-000000000000",
      "context": {
        "type": "schedule",
        "cron": "* * * * *",

        "name": "example schedule", // <-- Optional
        "timezone": "Australia/Melbourne", // <-- Optional
      },

      "status": {
        "status": "unhealthy", // unhealthy, healthy, unknown
        "message": ""
      }
    },
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "jobId": "00000000-0000-0000-0000-000000000000",
      "jobVersionId": "00000000-0000-0000-0000-000000000000",
      "context": {
        "type": "http",
        "name": "example http", // <-- Optional

        // If any of the below are omitted, it acts as a wildcard.
        "hostname": "", // <-- Optional
        "method": "", // <-- Optional
        "path": "", // <-- Optional
      },

      "status": {
        "status": "unhealthy", // unhealthy, healthy, unknown
        "message": ""
      }
    },
    {
      "id": "00000000-0000-0000-0000-000000000000",
      "jobId": "00000000-0000-0000-0000-000000000000",
      "jobVersionId": "00000000-0000-0000-0000-000000000000",
      "context": {
        "type": "mqtt",
        "name": "example mqtt", // <-- Optional
        "topics": [""],
        "connection": {
          "protocol": "ws", // wss, ws, mqtt or mqtts
          "protocolVariable": "",

          "port": "",
          "portVariable": "", // <-- Can reference job environment variable/secret

          "host": "",
          "hostVariable": "", // <-- Can reference job environment variable/secret

          "username": "",
          "usernameVariable": "", // <-- Can reference job environment variable/secret

          "password": "",
          "passwordVariable": "", // <-- Can reference job environment variable/secret

          "clientId": "",
          "clientIdVariable": "", // <-- Can reference job environment variable/secret

        }
      },

      "status": {
        "status": "unhealthy", // unhealthy, healthy, unknown
        "message": ""
      }
    }
  ]
}
```

</details>

#### # GET `/api/job/:jobId/triggers/:triggerId/status`

_Fetches status for a trigger_

<details>
<summary>Permissions</summary>

- `job/:jobId/triggers/:triggerId` READ

</details>

<details>
<summary>Response</summary>

```JSON
{
  "success": true,
  "data": {
    "status": "unhealthy", // unhealthy, healthy, unknown
    "message": ""
  }
}
```

</details>

## Job -> Environment

#### # GET `/api/job/:jobId/environment`

_Fetches environment for specific job_

<details>
<summary>Permissions</summary>

- `job/:jobId/environment/:name` READ

</details>

<details>
<summary>Response</summary>

```JSON
{
  "success": true,
  "data": {
    "ENV_VARIABLE1": {
      "type": "text",
      "value": "hello there!"
    },
    "ENV_VARIABLE1": {
      "type": "secret"
      // Value is omitted
    }
  }
}
```

</details>

#### # POST `/api/job/:jobId/environment/:name`

_Upserts new environment variable_

<details>
<summary>Permissions</summary>

- `job/:jobId/environment/:name` WRITE

</details>

<details>
<summary>Request</summary>

```JSON
{
  "type": "text", // text or secret
  "value": "I am the parameter value :)"
}
```

</details>

<details>

<summary>Response</summary>

```JSON
{
  "success": true,
  "message": "ok"
}
```

</details>

#### # DELETE `/api/job/:jobId/environment/:name`

_Deletes environment variable_

<details>
<summary>Permissions</summary>

- `job/:jobId/environment/:name` DELETE

</details>

<details>

<summary>Response</summary>

```JSON
{
  "success": true,
  "message": "ok"
}
```

</details>

## Job -> Job

**Todo:** Coming soon.

## Job -> Logs

**Todo:** Coming soon.

## Job -> Metrics

**Todo:** Coming soon.

## Job -> Publish

**Todo:** Coming soon.

## Job -> Runners

**Todo:** Coming soon.

## Job -> Store

**Todo:** Coming soon.

## Job -> Versions

**Todo:** Coming soon.
