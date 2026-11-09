import test from "node:test";
import assert from "node:assert/strict";
import { transactionDraft, intakeBody } from "../src/schema.js";

const base = {
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

test("allows cash contributions without inventory line items", () => {
  const cash = { ...base, transaction_type: "cash_contribution", items: [], amount_paid: null, amount_received: 125 };
  assert.equal(transactionDraft.safeParse(cash).success, true);
});
test("requires an explicit direction for inventory adjustments", () => {
  const adjustment = { ...base, transaction_type: "inventory_adjustment", amount_paid: null };
  assert.equal(transactionDraft.safeParse(adjustment).success, false);
  assert.equal(transactionDraft.safeParse({ ...adjustment, items: [{ ...base.items[0], adjustment_direction: "decrease" }] }).success, true);
});

test("rejects cash contributions recorded as an outgoing expense", () => {
  const invalidCash = { ...base, transaction_type: "cash_contribution", items: [], amount_paid: 25, amount_received: null };
  assert.equal(transactionDraft.safeParse(invalidCash).success, false);
});
test("rejects incoming cash on non-cash transaction types", () => {
  assert.equal(transactionDraft.safeParse({ ...base, amount_received: 25 }).success, false);
});
