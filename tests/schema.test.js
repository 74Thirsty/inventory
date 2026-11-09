import test from "node:test";
import assert from "node:assert/strict";
import { transactionDraft, intakeBody } from "../src/schema.js";

const base = {
  transaction_type: "donation_received",
  occurred_at: "2026-11-09",
  counterparty: { name: "Pepsi distributor", kind: "donor" },
  items: [{ description: "Canned soft drinks", category: "food_beverage", quantity: 240, unit: "can" }],
  amount_paid: 0,
  currency: "USD",
  purpose: "Burger fundraiser",
  received_by: "John",
  notes: null,
  missing_or_ambiguous: [],
  source_transcript: "They donated 240 cans of pop."
};

test("accepts a complete non-cash donation draft", () => {
  assert.equal(transactionDraft.safeParse(base).success, true);
});
test("rejects unknown transaction types", () => {
  assert.equal(transactionDraft.safeParse({ ...base, transaction_type: "tax_filing" }).success, false);
});
test("rejects negative quantities", () => {
  assert.equal(transactionDraft.safeParse({ ...base, items: [{ ...base.items[0], quantity: -1 }] }).success, false);
});
test("rejects an amount paid on a fully donated transaction", () => {
  assert.equal(transactionDraft.safeParse({ ...base, amount_paid: 12 }).success, false);
});
test("rejects extra fields rather than silently accepting them", () => {
  assert.equal(transactionDraft.safeParse({ ...base, approved: true }).success, false);
});
test("requires a purchase amount to be positive or unknown", () => {
  assert.equal(transactionDraft.safeParse({ ...base, transaction_type: "purchase_received", amount_paid: 0 }).success, false);
});
test("validates the intake envelope", () => {
  assert.equal(intakeBody.safeParse({ transaction: base, source_channel: "n8n" }).success, true);
});
