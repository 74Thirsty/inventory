# Power Automate officer approval and SharePoint filing

This is the recommended approval layer for the first pilot. n8n handles extraction and draft creation; Power Automate handles the human approval; the API remains the authoritative transaction ledger.

## Required configuration

Create protected Power Platform environment variables or equivalent secured connection values for:

- Inventory API base URL (HTTPS).
- Inventory API approver token (APPROVER_TOKEN).
- Authorized approver(s), identified by their Microsoft 365 account.
- SharePoint site and document library destination.

Enable Secure Inputs and Secure Outputs on actions that contain tokens or sensitive donor/financial data. Never put the approver token in n8n, a Teams message, a client-side form, or GitHub. Restrict who can edit the Power Automate flow.

The Power Automate HTTP connector may require a premium license. Confirm licensing and connector availability in the organization's tenant before rollout.

## Extend the Teams intake flow

The intake flow is described in teams-dictation-setup.md. After its HTTP POST action calls the n8n webhook:

1. Add a condition for a successful 2xx response.
2. Read the returned record ID from the n8n response: body.record.id.
3. Read the normalized transaction fields from body.record (transaction_type, counterparty, items, amount_paid, amount_received, purpose, occurred_at, and source_transcript).
4. Add the Approvals action **Start and wait for an approval**. Assign it only to named authorized officers.
5. Include a readable summary: transaction type, donor/supplier, date, item descriptions and quantities, amount paid or cash received, purpose, receiver, and original dictated text. State clearly that the AI created a draft and the approver is responsible for reviewing it.
6. Do not let the submitter approve their own record unless the board's written policy explicitly permits it.

## If the officer approves

1. Call POST to API path /v1/transactions/{recordId}/approve.
2. Include Authorization: Bearer <APPROVER_TOKEN>.
3. Include x-actor-id with the verified responder email or stable Entra ID user identifier returned by the approval action.
4. The API checks required fields and changes the draft to approved. If required facts remain unresolved, it returns HTTP 409; do not proceed to document filing.
5. Call GET on /v1/transactions/{recordId}/document.docx with the same approver authorization header.
6. Use SharePoint **Create file** to save the returned DOCX binary in the approved inventory-records library. Use a filename containing the record ID and date.
7. Reply in the original Teams thread with the record ID and SharePoint file link.

## If the officer rejects

1. Call POST to API path /v1/transactions/{recordId}/reject.
2. Include Authorization: Bearer <APPROVER_TOKEN>.
3. Include x-actor-id with the verified approval responder identity.
4. Send a JSON body with a concise rejection reason, for example {"reason":"Please confirm the quantity and donor before recording."}.
5. Reply in the original Teams thread that the draft was rejected and include the record ID. Do not create or file an approved document.

## Failure handling

- If n8n returns an error or no record ID, stop and notify the flow owner. Do not start an approval.
- If the API returns 401/403, stop and alert the administrator; never retry with a different or broader token.
- If approval returns 409, return the record to the authorized officer for correction; do not file the DOCX.
- If SharePoint filing fails after API approval, keep the approved record in PostgreSQL and retry the document retrieval/file step. Do not create a second transaction.
- Configure Power Automate retry policies carefully. API source-message and idempotency controls protect repeated intake, but the approval action itself should not be blindly replayed.
- Preserve flow run history under the organization's approved retention policy, and avoid storing secrets in action outputs.

## Important

The API's shared approver token is a pilot control, not a complete enterprise identity system. The Power Automate flow must be editable only by trusted administrators, and approval must be assigned to named officers. Before broad production use, replace shared API tokens with per-user Entra ID/OIDC authentication and role-based authorization.
