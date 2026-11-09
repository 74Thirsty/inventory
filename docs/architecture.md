# Architecture and implementation plan

## Objective

Provide Lost Limb Riders with a voice-first, auditable way to capture operational records without requiring volunteers to complete lengthy forms. Start with inventory and donated goods; expand to purchases, reimbursements, fundraiser income/expenses, and equipment only after the first workflow is reliable.

## End-to-end flow

1. **Capture:** Authorized user sends a Teams voice message or uploads an audio file through an approved channel.
2. **Identify source:** Record tenant/user/message identifiers and the original media reference. Verify the sender is authorized.
3. **Transcribe:** Speech service returns transcript and confidence/metadata. Preserve the original audio only under an approved retention policy.
4. **Extract:** LLM converts transcript to a proposed transaction using the canonical JSON schema. It must return null for unknown facts and include a list of missing/ambiguous fields.
5. **Validate:** Deterministic validation checks dates, quantities, units, transaction type, currency, amount, and required fields. Reject malformed or contradictory output.
6. **Clarify:** If required information is missing, ask the submitter one focused question at a time. Do not create an official record yet.
7. **Review:** Send a readable summary and attachments to an authorized approver. The approver can approve, reject, or request correction.
8. **Commit:** After approval, create the system-of-record entry and attach source transcript, approval metadata, and receipts/delivery slips.
9. **Generate:** Produce a transaction confirmation and update inventory/reporting views.
10. **Respond:** Send the record ID and SharePoint link to the submitter.

## Transaction types

- `donation_received`: non-cash items received at no cost.
- `purchase_received`: goods acquired using organization funds.
- `reimbursement_requested`: volunteer-paid expense awaiting review/payment.
- `inventory_used`: items consumed or distributed for a named event/program.
- `inventory_adjustment`: spoilage, damage, count correction, or other approved adjustment.
- `cash_contribution`: cash/check/electronic contribution (requires a separate money-handling control).
- `equipment_received`: durable property received by donation or purchase.

## System of record

Recommended first choice: Microsoft Lists for structured records if the organization's Microsoft 365 plan and permissions support it. Use Dataverse if stronger relational controls, role-based access, or future app development justify the licensing and setup. SharePoint document libraries hold source files and generated documents. Excel is a reporting/export surface, not the only database.

Suggested lists/tables:

- Inventory Transactions (append-only transaction ledger)
- Inventory Items (optional item catalog and unit conventions)
- Events / Programs
- Donors and Suppliers
- Approvals
- Documents / Evidence index

Do not maintain a manually edited quantity field as the only history. Derive on-hand quantities from approved receipts, usage, and adjustments, or maintain a reconciled balance with a full transaction ledger.

## Minimum transaction fields

- Unique record ID
- Transaction type and status
- Occurrence date (unknown remains null)
- Counterparty name and type
- Item description, category, quantity, unit
- Amount paid (zero for fully donated goods; unknown remains null)
- Currency
- Purpose/event
- Submitted by and received by
- Source channel and source message reference
- Transcript and extraction version
- Supporting evidence links
- Approval identity, decision, and timestamp
- Created/updated timestamps and revision history

## Approval policy

- All financial transactions, reimbursements, cash contributions, and inventory adjustments require approval by an authorized officer.
- Low-risk donated supply receipts may eventually use a delegated receiver role, but only after the board adopts a written control policy.
- The AI cannot approve its own extraction.
- Corrections to approved records create a linked correction/reversal record and retain the original.
- Never let a transcript alone trigger a payment, bank transfer, tax filing, or external financial commitment.

## Security and privacy

- Use organization-owned Microsoft 365 and n8n accounts; never embed secrets in workflow JSON or Git.
- Require authenticated webhooks; do not expose an unauthenticated public endpoint.
- Apply least-privilege Microsoft Graph/SharePoint permissions.
- Restrict records and evidence to authorized officers and designated volunteers.
- Store credentials in n8n credentials/secrets, not node parameters or repository files.
- Log actor, source, action, timestamp, approval, and record ID; avoid logging unnecessary personal data or full sensitive audio.
- Define retention and deletion policies with the board/accountant before retaining audio or donor details.
- Back up the system-of-record data and test restoration.

## Rollout phases

### Phase 0 — Foundation (repository starter)
- Define transaction schema and extraction prompt.
- Provide n8n webhook validation starter.
- Document security and approval requirements.

### Phase 1 — Inventory and donated goods
- Connect one approved voice intake channel.
- Add speech transcription and structured extraction.
- Add clarification and human approval.
- Save approved entries to Microsoft Lists/Dataverse.
- Generate Word/PDF receipt-of-goods record and SharePoint filing.
- Test donations, purchases, duplicates, missing dates, ambiguous quantities, and failed integrations.

### Phase 2 — Usage and event summaries
- Record inventory usage and adjustments.
- Reconcile event-level quantities.
- Generate event summary from approved records only.

### Phase 3 — Expenses and reimbursements
- Capture itemized receipts and payment evidence.
- Add approval limits and reimbursement status.
- Keep expense records distinct from non-cash donations.

### Phase 4 — Reporting and governance
- Monthly inventory/donation/expense reports.
- Board-ready summaries.
- Retention, backup, access review, and annual compliance checklist.

## Acceptance criteria for Phase 1

- A Teams/audio submission can be traced to its original sender and source.
- Transcription uncertainty is visible and does not become invented facts.
- Extracted records validate against the schema.
- Missing required details trigger clarification rather than silent completion.
- Duplicate source message IDs are idempotently rejected.
- No record becomes official without an authorized approval.
- Approved records are written to the selected system of record and have a stable ID.
- Generated documents link back to the source and approval.
- Failure at transcription, extraction, approval, or storage is reported and safely retryable.
- A test dataset demonstrates correct distinction between donated and purchased goods.

## Decisions still required from the organization

- Microsoft 365 tenant and whether Teams is enabled for the users.
- Whether Lists or Dataverse is the approved system of record.
- n8n hosting location, owner, backups, and credential management.
- Approved speech and LLM providers.
- Who may submit, receive, approve, and correct records.
- Evidence/audio retention policy.
- Exact legal organization name and preferred document branding.
