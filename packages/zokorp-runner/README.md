# ZoKorp Runner (BYO Compute)

ZoKorp Runner executes queued MLOps jobs in customer-owned infrastructure.

## Requirements
- Docker installed on runner host
- Network access to ZoKorp control plane URL
- Runner API key from `/mlops/settings/organization`

## Environment
- `ZOKORP_CONTROL_PLANE_URL` (example: `https://app.zokorp.com`)
- `ZOKORP_RUNNER_API_KEY` (secret key from ZoKorp app)
- `ZOKORP_RUNNER_NAME` (optional, default random)
- `ZOKORP_RUNNER_POLL_INTERVAL_MS` (optional, default `8000`)
- `ZOKORP_RUNNER_WORK_DIR` (optional, default `/tmp/zokorp-runner`)

## Run locally
```bash
cd packages/zokorp-runner
npm install
npm run once
npm run start
```

## Quick behavior
1. Poll `/api/mlops/runner/pull-job`.
2. Claim next queued job.
3. Run `docker run` with job image + command.
4. Collect stdout/stderr logs.
5. Upload requested artifacts (if `inputs.artifactPaths` provided).
6. Report terminal status to `/api/mlops/runner/report-job`.
