# Lost Limb Riders Inventory & Voice Administration

A voice-first administrative record system for Lost Limb Riders. Initial scope: inventory receipts, donated goods, purchases, inventory usage, and fundraiser records, with human approval before records become official.

## Current status

**Backend and automated test foundation implemented; not production deployed.** The repository includes a Fastify/PostgreSQL API, draft/correction/approval/rejection lifecycle, audit events, inventory and cash summaries, DOCX/HTML generation, an AI extraction n8n workflow, Teams/Power Automate setup guides, and PostgreSQL-backed CI tests. No live Teams, n8n, LLM, SharePoint, or production-host connection has been configured or verified.

## Intended user experience

John sends a voice message from his phone, for example:

> “Pepsi's distributor delivered 240 cans of pop today for the burger fundraiser. I received it.”

Phone dictation converts speech to text; the n8n workflow extracts a proposed transaction, and the API stores it as a pending draft. Missing details block approval until corrected. An authorized officer approves it before an official DOCX record is generated. The original transcript and Teams message ID are stored with the draft. Receipt/photo attachments are not yet uploaded or archived by this version.

## Architecture

- **Voice channel:** Microsoft Teams channel with phone keyboard dictation in the first release; native Teams audio-note ingestion is a later Graph/bot integration.
- **Orchestration:** n8n.
- **Speech-to-text:** phone keyboard dictation for the first release; native audio transcription is not implemented yet.
- **Extraction:** LLM returning strict structured JSON using `schemas/transaction.schema.json`.
- **Approval:** separate approver API token and explicit officer action; Power Automate approval and SharePoint filing are documented but not configured.
- **System of record:** PostgreSQL transaction ledger; generated DOCX/HTML records are downloaded from the API. SharePoint, Microsoft Lists/Dataverse, Excel, and Power BI are not connected yet.
- **Audit:** Preserve source message ID, submitter, timestamps, extracted values, approval identity/time, and correction history.

## Repository map

- `schemas/transaction.schema.json` — canonical proposed transaction shape.
- `prompts/extract-transaction.md` — extraction prompt and safety rules for the AI parser.
- `workflows/n8n-dictated-teams-intake.json` — AI extraction and authenticated Teams-dictation intake workflow.
- `workflows/n8n-voice-intake-starter.json` — basic validation-only starter.
- `src/` — authenticated API, validation, PostgreSQL persistence, approvals, reports, and document generation.
- `migrations/` — PostgreSQL schema.
- `Dockerfile` / `docker-compose.yml` — self-hosted deployment foundation.
- `docs/api.md` and `docs/deployment.md` — API and deployment contracts.
- `docs/teams-dictation-setup.md` and `docs/power-automate-approval-setup.md` — Teams intake, approval, and filing setup.
- `docs/production-readiness.md` — verified work and blockers before real data or production use.
- `docs/architecture.md` — system boundaries, data flow, approvals, security, and rollout plan.
- `docs/phase-1-test-cases.md` — acceptance and failure test cases.

## Set up the workflows

1. Deploy the API and PostgreSQL using `docs/deployment.md` in a controlled test environment.
2. Import `workflows/n8n-dictated-teams-intake.json` into n8n for extraction from Teams dictated text.
3. Configure the n8n environment variables listed in `docs/teams-dictation-setup.md`; keep the intake token and webhook secret out of workflow exports and Git.
4. Configure the private Teams channel and Power Automate sender-verified bridge. The workflow expects message text, sender, message ID, and channel ID.
5. Keep the workflow inactive until authentication and duplicate-delivery behavior pass with synthetic data.
6. The workflow creates a pending draft only. Configure officer approval and SharePoint filing separately using `docs/power-automate-approval-setup.md`.

The separate `workflows/n8n-voice-intake-starter.json` is a basic validation-only webhook example; it is not the primary AI extraction workflow.

Example request:

```json
{
  "transcript": "Pepsi's distributor delivered 240 cans of pop today for the burger fundraiser. I received it.",
  "transaction": {
    "transaction_type": "donation_received",
    "occurred_at": "2026-11-09",
    "counterparty": {"name": "Pepsi distributor", "kind": "donor"},
    "items": [{
      "description": "Canned soft drinks",
      "category": "food_beverage",
      "quantity": 240,
      "unit": "can"
    }],
    "amount_paid": 0,
    "currency": "USD",
    "purpose": "Burger fundraiser",
    "received_by": "John",
    "notes": null
  }
}
```

## Non-negotiable recordkeeping rules

1. AI output is a **draft**, not an authoritative accounting conclusion.
2. Never invent donor legal names, dates, quantities, prices, tax values, receipt numbers, or approvals.
3. Unknown values stay null and generate a clarification request.
4. Donated goods and purchased goods remain distinguishable.
5. Do not assign a tax-deductible value to donated goods. An accountant determines accounting treatment.
6. Do not treat a voice statement as proof of payment. Request a receipt/invoice and payment evidence where relevant.
7. Keep an immutable source/audit trail. Corrections create revisions; they do not silently overwrite approved records.
8. Require authorized human approval before posting financial or inventory adjustments.
9. Do not store sensitive personal information that is not necessary for the record.
10. This tool supports recordkeeping; it does not determine legal tax treatment or replace the organization's accountant.

## Development status

See `docs/architecture.md`, `docs/api.md`, and `docs/deployment.md`. Do not use real organizational data until the deployment, identity controls, backups, and integrations have been tested and approved.
