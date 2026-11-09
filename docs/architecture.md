# System architecture

## Product definition

Lost Limb Riders' application is a general-purpose, voice-first AI administrative work system. Inventory is one domain capability, not the product's center. A user states an outcome in ordinary language; the system interprets the request, plans the work, delegates specialized tasks, generates the appropriate document package, checks consistency, and routes drafts for authorized review.

## System boundaries

1. **Intake:** accepts text now and is designed for recorded audio plus transcription later. Preserve the original transcript, sender/source metadata, and idempotency key.
2. **Orchestration:** n8n coordinates planning, specialist agents, retries, handoffs, and execution status. The planner chooses deliverables dynamically; users do not select a document type first.
3. **Organizational knowledge:** approved mission/identity, contacts, policies, programs, event history, templates, and prior approved artifacts. Each item needs provenance, owner, and freshness; unverified memory must not silently become fact.
4. **Document production:** render DOCX, PDF, XLSX, PPTX, HTML, or text from typed, validated content models and reusable templates. Preserve source facts and provenance.
5. **Review and approval:** generated work remains draft until an authorized officer approves it. Clarifications and approval decisions are attributable and auditable.
6. **Domain adapters:** inventory/transactions remain in the existing PostgreSQL subsystem. The user's existing HTML GAAP accounting application is a separate external subsystem to be integrated later through a versioned adapter. Do not recreate, replace, or claim to have inspected it.
7. **Evidence and records:** retain source references, generated artifact versions, review outcomes, and audit events under an organization-approved retention policy.

## Current implementation in this branch

- Existing transaction/inventory subsystem remains intact.
- New `work_requests` storage supports general requests, source preservation, dynamic deliverable plans, unresolved questions, execution steps, and risk flags.
- New authenticated API routes accept a work request, let the orchestration layer record a plan, and let authorized reviewers inspect the queue and history.
- The planning prompt defines dynamic deliverable selection and anti-fabrication rules.
- No audio transcription provider, LLM credential, n8n instance, document renderer for arbitrary deliverables, organizational knowledge base, approval UI, file storage, or accounting adapter is configured by this change.

## Work-request lifecycle

`received → awaiting_clarification` or `ready_for_review` (plan captured). Subsequent execution and approval states are reserved in the data model but are not automatically advanced by the current API. A planner may update a plan while it remains in a planning/review-ready state. No external side effect is authorized by intake or planning.

## Accounting integration contract

The existing HTML accounting app is treated as an external source of truth for accounting data. Integration is deferred until its actual interface is supplied. At that point define a read/write capability matrix, authentication, audit behavior, data mapping, reconciliation, and explicit authority for writes. Until then, the platform must not create duplicate journal entries, calculate official GAAP balances, or present mock financial figures as real.

## Security and quality boundaries

- Separate intake credentials from reviewer credentials.
- Treat dictated content as untrusted prompt data.
- Preserve original source content; do not store unnecessary personal data.
- Unknown facts remain unresolved; never fabricate.
- Keep generated documents as drafts until explicit authorized approval.
- Financial, tax, legal, donor, and governance claims require authoritative evidence and appropriate human review.
- Use synthetic data until identity, retention, backups, monitoring, and integrations are configured.

## Next implementation phases

1. Complete and test the generic request API and n8n planner workflow.
2. Add typed artifact generation, document storage/versioning, and cross-document consistency checks.
3. Add organizational knowledge with provenance and permissions.
4. Add audio capture/transcription and conversational clarification.
5. Add specialist agent workflows for events, fundraising, communications, governance, inventory, and finance.
6. Integrate the existing accounting application through a tested adapter after source inspection.
7. Add named identities, role-based authorization, approval UX, backups, monitoring, and production deployment controls.
