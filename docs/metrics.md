# Metrics (Prometheus)

By default an endpoint of `/api/metrics` is available for prometheus scraping. This will allow you to record time-series data within your prometheus instance.

With addition to this, Jobber supports querying prometheus within the Jobber Dashboard to provide metrics and oversights without leaving Jobber. To achieve this, you need to configure the environment variables for `METRICS_PROMETHEUS_QUERY` and `METRICS_PROMETHEUS_JOB_NAME`.

## Permission

Your prometheus instance will not have permission by default, to query the jobber `/api/metrics` endpoint. To allow such access, you can create a token, or enable the anonymous user. For the sake of simplicity, we suggest creating a token with the correct permissions.

1. Within the Jobber Web panel, navigate to `API Tokens Management` (sidebar).
2. Create a new token
3. Set the description and period to your liking
4. Set the `Permissions` field to the json object below. This API token will be restricted to only polling metrics.
5. Create token, and note down the API key.

```JSON
[
  {
    "effect": "allow",
    "actions": [
      "read"
    ],
    "resource": "system/metrics/prometheus"
  }
]
```

## Prometheus Config

```yaml
scrape_configs:
  - job_name: jobber_job_name
    metrics_path: /api/metrics
    bearer_token: <required for bearer token method> # API Token you created above
    scrape_interval: 15s # Adjust to your liking
    static_configs:
      - targets: ["127.0.0.1"] # The hostname of your jobber instance
```

## Environment Variables

The following environment variables are required. [Click Here](/docs/environment-variables.md) for more information.

- `METRICS_PROMETHEUS_QUERY` - **Required**
- `METRICS_PROMETHEUS_JOB_NAME` - **Required**
- `METRICS_PROMETHEUS_QUERY_STEP`
