### Permissions overview

#### Job

- `job/:jobId` READ/WRITE/DELETE

#### Job -> Actions

Example resource pattern: `job/*/actions`

- `job/:jobId/actions/:actionId` READ

#### Job -> Environment

- `job/:jobId/environment/:name` READ/WRITE/DELETE

#### Job -> Logs

- `job/:jobId/logs` READ

#### Job -> Publish

- `job/-/publish` WRITE

#### Job -> Runners

- `job/:jobId/runners` READ/WRITE

#### Job -> Store

- `job/:jobId/store/:storeId` READ/DELETE

#### Job -> Triggers

- `job/:jobId/triggers/:triggerId` READ/WRITE

#### Job -> Versions

- `job/:jobId/versions/:versionId` READ

#### User

- `user` READ - Used for listing users
- `user/:userId` READ/WRITE - Used for listing users, reading specific users, and updating users
- `user/:userId/username` WRITE - Determines if username can be updated
- `user/:userId/password` WRITE - Determines if password can be updated
- `user/:userId/permissions` WRITE - Determines if permissions can be updated

#### API Tokens

- `api-tokens` READ/WRITE/DELETE
- `api-tokens/:tokenId` READ/WRITE/DELETE

#### System -> Metrics

- `system/metrics/prometheus` READ
- `system/metrics/overview` READ

### Example Permissions:

#### API Publisher

```JSON
[
  {
    "effect": "allow",
    "resource": "job/-/publish",
    "actions": ["write"]
  }
]
```

#### Administrator Account

```JSON
[
  {
    "effect": "allow",
    "resource": "*",
    "actions": ["read", "write", "delete"]
  }
]
```

#### Readonly Account

```JSON
[
  {
    "effect": "allow",
    "resource": "*",
    "actions": ["read"]
  }
]
```

#### Readonly with runner management

```JSON
[
  {
    "effect": "allow",
    "resource": "*",
    "actions": ["read"]
  },
  {
    "effect": "allow",
    "resource": "job/*/runners",
    "actions": ["write", "delete"]
  }
]
```

#### Full Permissions without API Tokens and User Management

```JSON
[
  {
    "effect": "allow",
    "resource": "*",
    "actions": ["read", "write", "delete"]
  },
  {
    "effect": "deny",
    "resource": "api-tokens",
    "actions": ["read", "write", "delete"]
  },
  {
    "effect": "deny",
    "resource": "user",
    "actions": ["read", "write", "delete"]
  }
]
```
