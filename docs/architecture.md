# Architecture and implementation status

## Purpose

Build a voice-first, auditable administrative record system for Lost Limb Riders. The first operational scope is non-cash donations, purchases, inventory usage, adjustments, equipment receipts, cash contributions, and fundraiser recordkeeping.

## Implemented in this repository

- **Phone input:** the submitter uses the phone keyboard microphone to dictate a message into a dedicated Teams channel. The phone sends the resulting text, not a native Teams audio-note attachment.
- **Teams bridge:** a Power Automate flow can forward authorized channel messages to the n8n webhook. Tenant-specific setup is documented in teams-dictation-setup.md.
- **Automation:** an importable n8n workflow authenticates the incoming webhook, calls an OpenAI-compatible Chat Completions endpoint for structured extraction, and submits a draft to the API.
- **API:** Fastify service with separate intake and approver bearer tokens.
- **Database:** PostgreSQL transaction ledger, source-message uniqueness, idempotency keys, and append-only audit events at the application level.
- **Validation:** Zod schema validation plus deterministic approval completeness checks. Unknown details remain unresolved; AI cannot approve.
- **Lifecycle:** draft creation, officer correction, approval, rejection, and audit-history retrieval.
- **Inventory reporting:** on-hand quantities derive from approved receipts, usage, and signed adjustments.
- **Documents:** approved records can be generated on demand as editable DOCX or printable HTML. They are not automatically saved to SharePoint.
- **Deployment foundation:** Dockerfile, Compose file, environment template, SQL migrations, and CI syntax/schema/unit-test workflow.

## Not implemented / production blockers

- Native Teams voice-note/audio attachment ingestion and server-side speech transcription.
- Interactive Teams approval cards, conversational clarification messages, and automated Teams confirmation replies.
- SharePoint evidence/document filing, Microsoft Lists/Dataverse synchronization, and Excel/Power BI dashboards.
- Receipt/photo upload and durable evidence-file storage.
- Per-user Microsoft Entra ID/OIDC authentication and role-based access; the current API uses shared intake and approver secrets.
- Production hosting, HTTPS reverse proxy, rate limiting, backup/restore, monitoring, retention controls, and tenant permission review.
- Full API/database integration tests and a successful live end-to-end test against a configured n8n, Teams, LLM, and PostgreSQL environment.

Do not call the system production-ready or enter live donor/financial records until these blockers are resolved and tested.

## End-to-end target flow

1. **Capture:** authorized submitter dictates into the private Teams inventory-intake channel.
2. **Bridge:** Power Automate verifies sender membership/identity and forwards message ID, sender ID, timestamp, and plain text over HTTPS to n8n.
3. **Authenticate:** n8n rejects requests unless the configured webhook secret is present and correct.
4. **Extract:** LLM returns a proposed transaction matching the canonical schema. The transcript is treated as untrusted data, never as instructions to bypass policy.
5. **Validate:** API validates types, dates, quantities, units, currency, amount fields, and transaction-specific constraints.
6. **Persist draft:** PostgreSQL saves the source reference and transaction in draft_needs_approval status. Repeated message IDs are idempotently handled.
7. **Clarify/correct:** missing facts remain listed; an authorized officer corrects the draft through the API. The correction is audited.
8. **Approve/reject:** an authorized officer explicitly approves or rejects. Approval is blocked when required fields remain unresolved.
9. **Generate:** after approval, API generates a downloadable DOCX/HTML record.
10. **Report:** inventory totals include approved movements only; summary separates cash received from cash paid.

## Transaction types and accounting separation

- donation_received: non-cash goods received at no cost. Record quantity and donor; amount_paid must be zero. Do not estimate fair market value or tax deduction.
- purchase_received: goods acquired using organization funds. Record amount_paid and retain the itemized receipt/payment evidence outside this API until evidence storage is implemented.
- reimbursement_requested: volunteer-paid expense awaiting officer review/payment. Never initiate payment automatically.
- inventory_used: items consumed or distributed for a named event/program.
- inventory_adjustment: spoilage, damage, count correction, or other approved adjustment. Every item requires adjustment_direction of increase or decrease.
- cash_contribution: cash/check/electronic contribution. Use amount_received, never amount_paid, and do not create inventory line items.
- equipment_received: durable property received by donation or purchase. Track it as a separate item category.

## Data model

The PostgreSQL transactions table stores transaction type, status, occurrence date, counterparty, item lines, amount_paid, amount_received, currency, purpose, receiver, notes, original transcript, source channel/message ID, submitter, and approval/rejection metadata.

Audit events record draft creation, corrections, approval, and rejection. Correction events preserve the corrected transaction snapshot and missing-field list. Source message IDs are unique. Idempotency keys are serialized with a PostgreSQL advisory transaction lock.

Inventory balance is calculated from approved movements:
- donation_received, purchase_received, equipment_received: add quantity.
- inventory_used: subtract quantity.
- inventory_adjustment: add or subtract according to each item's adjustment_direction.
- draft and rejected transactions: no stock effect.
- cash_contribution: no inventory effect.

## Approval policy

- All financial transactions, reimbursements, cash contributions, and inventory adjustments require explicit officer approval.
- The API cannot approve its own extraction.
- Corrections can only be made while a record remains a draft.
- Approved and rejected records cannot be silently edited through the current API.
- No transaction triggers a payment, bank transfer, tax filing, or external financial commitment.
- Donated goods are not assigned a tax-deductible value by the AI or this system.

## Security and privacy

- Never commit service secrets, database credentials, API tokens, or donor documents.
- Use separate high-entropy intake and approver secrets.
- Keep PostgreSQL on a private network; expose the API only through a trusted HTTPS reverse proxy.
- Keep the n8n webhook secret separate from the API intake token.
- Restrict the Teams channel and validate stable sender identity in Power Automate.
- Do not put the approver token in the Teams bridge workflow.
- Define data retention and access rules with the board/accountant before storing donor data, receipts, audio, or transcripts.
- Configure encrypted backups and verify restoration.
- Replace shared bearer secrets with named Entra ID/OIDC identities before broad volunteer access.

## Rollout phases

### Phase 1 — controlled inventory pilot
- Deploy API and PostgreSQL in a controlled test environment.
- Configure n8n environment variables and import dictated Teams workflow.
- Configure a private Teams channel and Power Automate sender filter.
- Use synthetic test data; verify duplicate handling, incomplete records, corrections, approval, rejection, stock calculations, and DOCX output.
- Obtain board approval for authorized submitters, approvers, and record retention.

### Phase 2 — evidence and Microsoft 365 integration
- Add secure receipt/photo uploads.
- Store generated documents and evidence in SharePoint with least-privilege permissions.
- Add Teams approval cards and confirmation replies.
- Add conversational clarification for missing fields.
- Add Microsoft Lists/Dataverse or Power BI only if required; PostgreSQL remains the authoritative ledger unless an explicit migration is designed.

### Phase 3 — full administration
- Expand fundraiser income/expense summaries and reimbursements.
- Add equipment register, donor/vendor directory, event records, and board reports.
- Add scheduled reconciliations, backup/restore verification, monitoring, and annual access reviews.

## Acceptance criteria before production

- CI passes on the final commit and all automated tests pass.
- Container image builds and starts successfully with a clean PostgreSQL database.
- Migration succeeds on both fresh and existing test databases.
- Invalid and unauthenticated requests are rejected; secrets never appear in logs.
- Duplicate source messages create exactly one transaction.
- Unknown or ambiguous details prevent approval until corrected.
- Donated goods, purchases, inventory use, adjustments, cash received, and cash paid are separately represented.
- Only approved movements affect stock balances.
- Approval and rejection are attributable to named authorized officers.
- Audit history preserves every correction and decision.
- DOCX/HTML generation is verified against real test records.
- Teams-to-n8n-to-API end-to-end test passes with tenant-approved permissions.
- Backups restore successfully and monitoring alerts on failures.
- Organization approves access, retention, privacy, and financial-control policies.

## Organization decisions required

- Exact legal organization name and brand/logo for generated records.
- Microsoft 365 tenant owner and authorized Teams channel members.
- Named submitters, inventory receivers, approvers, and correction permissions.
- Whether n8n is self-hosted or managed and where it runs.
- Approved LLM provider and data-processing terms.
- SharePoint destination and retention policy for receipts and generated documents.
- Hosting owner, domain, backup destination, monitoring, and incident contact.
