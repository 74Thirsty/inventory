# Microsoft Teams voice-dictation intake

## First release: dictate text into Teams

The simplest phone experience is to use the phone keyboard's microphone/dictation feature inside a dedicated Teams channel. John speaks naturally; the phone converts speech to text; he sends the message. This avoids relying on Teams voice-note attachment access in the first release.

Create a private Teams channel named **inventory-intake** and restrict membership to authorized submitters. Ask users to send one inventory event per message and include corrections as a follow-up, not by editing an old message.

Examples:
- "Pepsi donated 240 cans of pop today for the burger fundraiser. I received them."
- "I bought 6 packs of hamburger buns for $28.50 on the organization debit card. The receipt is available."
- "We used 120 burger patties and 120 buns at Saturday's fundraiser."

The workflow creates a draft only. It does not approve the transaction or treat a voice statement as proof of payment.

## n8n environment

Import workflows/n8n-dictated-teams-intake.json into n8n. Configure these environment variables on the n8n host (not inside the exported workflow):

- LLR_N8N_WEBHOOK_SECRET: long random secret used by the webhook gate.
- LLR_OPENAI_API_KEY: organization-approved API key.
- LLR_OPENAI_MODEL: optional model name; defaults to gpt-4o-mini.
- LLR_API_BASE_URL: HTTPS base URL for the Inventory API, without a trailing slash.
- LLR_API_TOKEN: intake token from the Inventory API's protected .env.

Restart n8n after changing environment variables. The imported workflow disables saving successful, failed, and manual execution payloads because they contain transcripts and secret-bearing headers. Confirm that the webhook returns 401 when the secret is absent or incorrect before activating it. Review the n8n instance-wide execution-data retention settings as well; do not re-enable payload retention without redacting headers and donor/financial content. The API token must be an intake-only token, never the approver token.

## Connect Teams to n8n

Use an organization-approved Teams/Power Automate integration:

1. Create a Power Automate cloud flow with the Teams trigger **When a new channel message is added**.
2. Scope it to the private inventory-intake channel.
3. Add a condition that allows only named authorized submitters. Do not trust display names alone if the trigger exposes a stable user ID.
4. Add an HTTP POST action to the n8n production webhook URL: https://<n8n-host>/webhook/llr/voice-intake.
5. Add header x-llr-webhook-secret with the same secret configured on n8n. Store it in the flow's protected connection/secret configuration; never put it in a public channel message.
6. Add a Content Conversion **Html to text** action if the Teams trigger provides message HTML, then send JSON with this shape (map the fields using dynamic content from the Teams trigger):

    {
      "sender": "stable-user-id-or-verified-email",
      "messageId": "Teams-message-id",
      "channelId": "Teams-channel-id",
      "sentAt": "2026-11-09T12:00:00Z",
      "text": "The dictated message body as plain text"
    }

7. Test with a non-financial sample first. Verify the source message ID is saved and a second delivery of the same message does not create a second transaction.
8. Activate the flow only after the channel membership, sender filter, webhook secret, and HTTPS endpoint are reviewed.

The Power Automate HTTP action may require a premium license depending on the tenant plan. If it is unavailable, use a properly registered Microsoft Graph integration or a secured Teams bot as the bridge; do not expose an unauthenticated n8n webhook.

## Important boundaries

- This first-release workflow accepts **dictated Teams text**, not native Teams voice-note audio attachments. Direct voice-note media ingestion requires a separate Graph/bot implementation and permission review.
- The workflow calls the configured OpenAI Chat Completions endpoint. Do not send donor or financial information to a model provider until the organization approves its data-processing terms and retention settings.
- Teams submission creates a pending draft. An authorized officer must review and approve it using the approver API. The Teams approval card/interactive approval experience is a separate integration task.
- Do not enable public channel intake. Keep the channel private and filter sender identity in Power Automate as well as the webhook secret check.
- Never place APPROVER_TOKEN, database credentials, or service secrets in Teams messages, GitHub, or a client-side app.
