# Production readiness gate

Last reviewed: 2026-11-09

## Status: NOT PRODUCTION READY

The repository has a working backend foundation and CI build, but the live service integrations and operational controls are not configured. Do not use it as the organization's official record system yet.

## Verified in GitHub Actions

The CI run associated with commit 61f86354e9938573d5790d0478b7d970ceff246d completed successfully:

- Node 22 dependency installation.
- npm audit for production dependencies (no high-severity finding at that run).
- JavaScript syntax checks.
- JSON parsing of the transaction schema and both n8n workflows.
- Schema unit tests.
- Production Docker image build.

This verifies static checks, unit tests, PostgreSQL-backed API integration tests, dependency audit at that point in time, and image build. It does not verify a live production host or the external Microsoft 365/n8n integrations.

## Implemented

- PostgreSQL transaction ledger and idempotent source-message handling.
- Separate cash-in and cash-out amount fields.
- Draft, correction, approval, and rejection API routes.
- Separate intake and approver bearer secrets.
- Transaction audit events.
- Deterministic approval completeness checks.
- Approved-only stock movement reporting.
- DOCX and printable HTML generation for approved records.
- n8n dictated Teams text extraction workflow.
- Docker Compose deployment foundation.
- CI dependency audit, syntax/schema checks, tests, and container build.

## Blocking work before production

- [ ] Generate and commit package-lock.json; use npm ci in CI and Docker builds.
- [ ] Deploy to an organization-controlled host with HTTPS and a trusted reverse proxy.
- [x] Run PostgreSQL migration, draft, duplicate, approval, rejection, audit, stock, cash separation, and document integration tests against a disposable PostgreSQL service in CI.
- [ ] Configure encrypted backups and prove a full restore.
- [ ] Configure uptime, error, disk, database, backup-age, and workflow-failure monitoring.
- [ ] Configure per-user Microsoft Entra ID/OIDC authentication and role-based authorization; current API uses shared secrets.
- [ ] Create the private Teams inventory-intake channel and enforce stable sender IDs.
- [ ] Configure the Power Automate Teams-to-n8n HTTP bridge and test unauthorized senders.
- [ ] Configure n8n secrets, approved LLM provider, API base URL, and intake token.
- [ ] Complete the Power Automate approval flow using named officers and the API approver token.
- [ ] Verify DOCX retrieval and SharePoint file creation; verify retry behavior when filing fails.
- [ ] Implement receipt/photo upload and protected evidence storage.
- [ ] Define data retention, access, donor privacy, and incident response policies with the board.
- [ ] Obtain approval from the organization and its accountant for record categories, approval authority, and retention.
- [ ] Run end-to-end tests with synthetic data before any real data is entered.

## Known scope limits

- First-release voice capture is phone keyboard dictation into Teams text. Native Teams audio-note ingestion and server-side transcription are not implemented.
- The n8n workflow creates drafts. The officer approval and SharePoint filing flow is documented but must be configured in the tenant.
- Generated Word/HTML records are returned by the API; they are not automatically archived until SharePoint integration is configured.
- Receipt and photo attachments are not yet stored.
- This is an operational recordkeeping system, not tax advice, a valuation service, a payment system, or a tax-filing service.
