# API reference

All endpoints except liveness/readiness require bearer authentication. Use the intake token for creating drafts and a separate approver token for reading, approving, rejecting, and reporting. Never put tokens in a browser app or a public client.

## Health

- `GET /health/live` — process liveness.
- `GET /health/ready` — database readiness.

## Create draft

`POST /v1/transactions`

Header: `Authorization: Bearer <API_TOKEN>`

Body:

```json
{
  "transaction": {
    "transaction_type": "donation_received",
    "occurred_at": "2026-11-09",
    "counterparty": {"name": "Pepsi distributor", "kind": "donor"},
    "items": [{"description": "Canned soft drinks", "category": "food_beverage", "quantity": 240, "unit": "can"}],
    "amount_paid": 0,
    "currency": "USD",
    "purpose": "Burger fundraiser",
    "received_by": "John",
    "notes": null,
    "missing_or_ambiguous": [],
    "source_transcript": "They donated 240 cans of pop."
  },
  "source_message_id": "teams-message-or-upload-id",
  "source_channel": "n8n",
  "submitted_by": "john@example.org",
  "idempotency_key": "stable-source-event-key-0001"
}
```

Returns 201 for a new draft, 200 for a duplicate source/idempotency key, and 400 for invalid input. New records always start as `draft_needs_approval`.

## Review queue

`GET /v1/transactions?status=draft_needs_approval&limit=50`

Approver token required. Status may be `draft_needs_approval`, `approved`, `rejected`, or `all`.

## Approve / reject

- `POST /v1/transactions/:id/approve` with approver token and `x-actor-id: named-authorized-approver`.
- `POST /v1/transactions/:id/reject` with approver token, same actor header, and JSON body `{"reason":"..." }`.

Approval is state-checked and audited. Only drafts can transition. The API does not initiate payments or submit tax filings.

## Documents and reports

- `GET /v1/transactions/:id/document` — downloadable printable HTML record.
- `GET /v1/reports/inventory` — approved inventory movements only.
- `GET /v1/reports/summary` — counts and recorded cash spend by status/type.

## Security notes

- TLS must terminate at a trusted reverse proxy.
- Use high-entropy, separate secrets for intake and approver access.
- Keep the approver token only in a trusted automation/operator environment.
- Restrict network access; do not expose Postgres publicly.
- Configure backups, retention, monitoring, and restore drills before production use.
