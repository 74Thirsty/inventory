import test, { before, after } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgres://llr:postgres@127.0.0.1:5432/llr_inventory";
process.env.API_TOKEN ||= "test-intake-token-0123456789-abcdef";
process.env.APPROVER_TOKEN ||= "test-approver-token-9876543210-abcdef";
process.env.ORGANIZATION_NAME ||= "Lost Limb Riders Test";

const { sql, migrate, closeDb } = await import("../src/db.js");
const { buildApp } = await import("../src/app.js");
let app;

const intakeHeaders = { authorization: "Bearer " + process.env.API_TOKEN };
const approverHeaders = { authorization: "Bearer " + process.env.APPROVER_TOKEN, "x-actor-id": "officer@example.org" };

function transaction(overrides = {}) {
  return {
    transaction_type: "donation_received",
    occurred_at: "2026-11-09",
    counterparty: { name: "Pepsi distributor", kind: "donor" },
    items: [{ description: "Canned soft drinks", category: "food_beverage", quantity: 240, unit: "can" }],
    amount_paid: 0,
    amount_received: null,
    currency: "USD",
    purpose: "Burger fundraiser",
    received_by: "John",
    notes: null,
    missing_or_ambiguous: [],
    source_transcript: "Pepsi donated 240 cans of pop for the burger fundraiser.",
    ...overrides
  };
}

async function createDraft(tx, extra = {}) {
  return app.inject({
    method: "POST",
    url: "/v1/transactions",
    headers: intakeHeaders,
    payload: { transaction: tx, source_channel: "integration_test", submitted_by: "john@example.org", ...extra }
  });
}

before(async () => {
  await migrate();
  await sql.unsafe("TRUNCATE TABLE audit_events, idempotency_keys, transactions RESTART IDENTITY CASCADE");
  app = buildApp();
  await app.ready();
});

after(async () => {
  if (app) await app.close();
  await closeDb();
});

test("rejects unauthenticated intake", async () => {
  const response = await app.inject({ method: "POST", url: "/v1/transactions", payload: {} });
  assert.equal(response.statusCode, 401);
});

test("creates one draft for duplicate Teams source messages", async () => {
  const payload = transaction();
  const first = await createDraft(payload, { source_message_id: "teams-message-duplicate-001", idempotency_key: "teams:duplicate-message-001" });
  const second = await createDraft(payload, { source_message_id: "teams-message-duplicate-001", idempotency_key: "teams:duplicate-message-001" });
  assert.equal(first.statusCode, 201);
  assert.equal(second.statusCode, 200);
  assert.equal(second.json().duplicate, true);
  assert.equal(second.json().record.id, first.json().record.id);
});

test("blocks approval until missing details are corrected, then records an auditable approval", async () => {
  const initial = transaction({ missing_or_ambiguous: ["Confirm the delivery date."], occurred_at: null });
  const created = await createDraft(initial);
  const id = created.json().record.id;

  const blocked = await app.inject({ method: "POST", url: "/v1/transactions/" + id + "/approve", headers: approverHeaders });
  assert.equal(blocked.statusCode, 409);
  assert.equal(blocked.json().error, "incomplete_record");

  const corrected = transaction({ occurred_at: "2026-11-09", missing_or_ambiguous: [] });
  const patch = await app.inject({
    method: "PATCH",
    url: "/v1/transactions/" + id,
    headers: approverHeaders,
    payload: { transaction: corrected }
  });
  assert.equal(patch.statusCode, 200);

  const approved = await app.inject({ method: "POST", url: "/v1/transactions/" + id + "/approve", headers: approverHeaders });
  assert.equal(approved.statusCode, 200);
  assert.equal(approved.json().record.status, "approved");

  const audit = await app.inject({ method: "GET", url: "/v1/transactions/" + id + "/audit", headers: approverHeaders });
  assert.equal(audit.statusCode, 200);
  assert.deepEqual(audit.json().events.map((event) => event.event_type), ["draft_created", "draft_corrected", "approved"]);

  const inventory = await app.inject({ method: "GET", url: "/v1/reports/inventory", headers: approverHeaders });
  assert.equal(inventory.statusCode, 200);
  assert.equal(inventory.json().inventory[0].quantity_on_hand, 240);

  const document = await app.inject({ method: "GET", url: "/v1/transactions/" + id + "/document.docx", headers: approverHeaders });
  assert.equal(document.statusCode, 200);
  assert.match(document.headers["content-type"], /wordprocessingml\.document/);
  assert.ok(document.rawPayload.length > 100);
});

test("keeps incoming cash separate from expenses and excludes it from inventory", async () => {
  const cash = transaction({
    transaction_type: "cash_contribution",
    counterparty: { name: "Community donors", kind: "attendee" },
    items: [],
    amount_paid: null,
    amount_received: 75,
    purpose: "Community fundraiser cash donations",
    source_transcript: "We collected 75 dollars in cash donations."
  });
  const created = await createDraft(cash);
  assert.equal(created.statusCode, 201);
  const id = created.json().record.id;

  const approved = await app.inject({ method: "POST", url: "/v1/transactions/" + id + "/approve", headers: approverHeaders });
  assert.equal(approved.statusCode, 200);

  const summary = await app.inject({ method: "GET", url: "/v1/reports/summary", headers: approverHeaders });
  const row = summary.json().summary.find((entry) => entry.transaction_type === "cash_contribution" && entry.status === "approved");
  assert.equal(row.amount_paid, 0);
  assert.equal(row.amount_received, 75);
});

test("rejection and its audit event commit together", async () => {
  const created = await createDraft(transaction({ purpose: "Test rejection record" }));
  const id = created.json().record.id;
  const rejected = await app.inject({
    method: "POST",
    url: "/v1/transactions/" + id + "/reject",
    headers: approverHeaders,
    payload: { reason: "Test-only rejection." }
  });
  assert.equal(rejected.statusCode, 200);
  assert.equal(rejected.json().record.status, "rejected");
  const audit = await app.inject({ method: "GET", url: "/v1/transactions/" + id + "/audit", headers: approverHeaders });
  assert.equal(audit.json().events.at(-1).event_type, "rejected");
});
