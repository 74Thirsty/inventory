# Deployment guide

## Requirements

- Docker Engine and Docker Compose plugin.
- A Linux host controlled by Lost Limb Riders or its service provider.
- HTTPS reverse proxy and DNS.
- Organization-approved data retention and backup policy.

## First deployment

1. Clone this repository onto the host.
2. Generate a database password and two independent API secrets (at least 32 random characters each).
3. Create `.env` from `.env.example`. Set `POSTGRES_PASSWORD`, `API_TOKEN`, `APPROVER_TOKEN`, `ORGANIZATION_NAME`, and `PUBLIC_BASE_URL`. Compose injects the container's database URL.
4. Set `POSTGRES_PASSWORD` in the deployment environment (or Compose's protected environment file); do not commit it.
5. Run `docker compose up -d --build`.
6. Confirm `GET /health/ready` returns 200 from the trusted network.
7. Put the service behind HTTPS. Keep port 3000 private; the Compose binding is loopback-only.
8. Test the draft, duplicate, invalid input, approval, rejection, report, and document routes using synthetic data.
9. Configure encrypted off-host database backups and perform a restore test.
10. Configure monitoring for container restarts, disk capacity, database health, backup age, and failed workflow executions.

## Production hardening before real donor/financial data

- Replace shared bearer secrets with per-user OAuth/OIDC identities or a managed API gateway before broad volunteer access.
- Configure TLS, rate limiting, request-size limits, and network allowlists at the reverse proxy.
- Restrict approver access to named officers and keep approver credentials out of n8n general workflows.
- Configure Postgres TLS if database traffic leaves the private Docker network.
- Define retention and access rules for donor details, receipts, voice audio, and transcripts.
- Encrypt backup media and test restore procedures.
- Add external error monitoring and alerting without logging secrets or unnecessary personal data.
- Obtain board/accountant approval for record categories, approval authority, and retention periods.

## Current integration boundary

This repository's API is a working local foundation, not a deployed service. Microsoft Teams Graph subscriptions, transcription provider, LLM provider, SharePoint document storage, and Teams approval cards still require tenant-specific setup, credentials, permission review, and end-to-end tests. Do not represent the system as production-ready until those have passed.
