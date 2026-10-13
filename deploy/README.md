# Container candidate

The Dockerfile builds the dashboard with `VITE_API_URL=/api/v1`. nginx serves the SPA and proxies `/api/` and `/health/` to the backend service named `api`.

Run it with the companion backend `deploy/compose.yaml`, keeping folders `core-backend` and `core-frontend` beside each other. See the backend deployment guide for bootstrap, credentials and validation. This is a preparation candidate: container builds and a real browser/API/RabbitMQ end-to-end test remain pending.
