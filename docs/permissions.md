### Permissions overview

#### Job

- `job/:jobId` READ/WRITE/DELETE

#### Job -> Actions

Example resource pattern: `job/*/actions`

- `job/:jobId/actions/:actionId` READ
- `job/:jobId/actions/:actionId/runners` READ

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
