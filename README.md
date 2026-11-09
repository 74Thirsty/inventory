# Lost Limb Riders Inventory & Voice Administration

A voice-first administrative record system for Lost Limb Riders. Initial scope: inventory receipts, donated goods, purchases, inventory usage, and fundraiser records, with human approval before records become official.

## Current status

**Backend foundation implemented; live deployment and integrations remain unverified.** The repository now includes a Fastify/PostgreSQL API, draft/approval lifecycle, audit events, inventory reporting, printable HTML and DOCX generation, Docker deployment files, validation tests, and the initial n8n validation workflow. It is not yet connected to a live Microsoft Teams tenant, speech service, AI provider, or SharePoint site.

## Intended user experience

John sends a voice message from his phone, for example:

> “Pepsi's distributor delivered 240 cans of pop today for the burger fundraiser. I received it.”

The system transcribes the audio, extracts a proposed transaction, asks for missing details, shows John a review card, and only records the transaction after an authorized person approves it. The original message/transcript and supporting files remain linked to the resulting record.

## Architecture

- **Voice channel:** Microsoft Teams (preferred) or a controlled audio-upload endpoint.
- **Orchestration:** n8n.
- **Speech-to-text:** Azure AI Speech or Whisper-compatible provider.
- **Extraction:** LLM returning strict structured JSON using `schemas/transaction.schema.json`.
- **Approval:** Teams review/approval step; no automatic posting of uncertain financial records.
- **System of record:** Microsoft Lists or Dataverse; SharePoint for supporting files; Excel/Power BI for reports.
- **Audit:** Preserve source message ID, submitter, timestamps, extracted values, approval identity/time, and correction history.

## Repository map

- `schemas/transaction.schema.json` — canonical proposed transaction shape.
- `prompts/extract-transaction.md` — extraction prompt and safety rules for the AI parser.
- `workflows/n8n-voice-intake-starter.json` — importable n8n webhook validation starter.\n- `src/` — authenticated API, validation, PostgreSQL persistence, approvals, reports, and document generation.\n- `migrations/` — PostgreSQL schema.\n- `Dockerfile` / `docker-compose.yml` — self-hosted deployment foundation.\n- `docs/api.md` and `docs/deployment.md` — API and deployment contracts.
- `docs/architecture.md` — system boundaries, data flow, approvals, security, and rollout plan.
- `docs/phase-1-test-cases.md` — acceptance and failure test cases.

## Import the n8n starter

1. In n8n, open **Workflows → Import from File**.
2. Import `workflows/n8n-voice-intake-starter.json`.
3. Review the webhook path and configure authentication or an authenticated gateway before exposing it.
4. Activate only after reviewing access controls.
5. POST JSON containing `transcript` and `transaction` to the webhook. The transaction must follow the canonical schema.
6. The current starter validates a proposed transaction. The API can persist it as a draft, enforce approval, and generate a DOCX/HTML record. Direct Teams ingestion, speech-to-text, AI extraction, and SharePoint filing still require tenant configuration and end-to-end integration.

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
