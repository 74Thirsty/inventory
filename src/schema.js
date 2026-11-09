import { z } from "zod";

const nullableText = z.string().trim().max(2000).nullable();
const item = z.object({
  description: z.string().trim().min(1).max(500),
  category: z.enum(["food_beverage","serving_supplies","cleaning_supplies","merchandise","equipment","office_supplies","other"]).nullable().optional(),
  quantity: z.number().finite().nonnegative(),
  unit: z.string().trim().min(1).max(80),
  package_count: z.number().finite().nonnegative().nullable().optional(),
  units_per_package: z.number().finite().nonnegative().nullable().optional(),
  condition: z.enum(["new_unopened","usable","perishable_check","damaged","unknown"]).nullable().optional(),
  expiration_date: z.string().date().nullable().optional()
}).strict();

export const transactionDraft = z.object({
  transaction_type: z.enum(["donation_received","purchase_received","reimbursement_requested","inventory_used","inventory_adjustment","cash_contribution","equipment_received"]),
  occurred_at: z.string().date().nullable(),
  counterparty: z.object({
    name: z.string().trim().max(300).nullable(),
    kind: z.enum(["donor","supplier","volunteer","attendee","other"]).nullable()
  }).strict().nullable(),
  items: z.array(item).min(1).max(100),
  amount_paid: z.number().finite().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  purpose: nullableText,
  received_by: z.string().trim().max(300).nullable(),
  notes: nullableText,
  missing_or_ambiguous: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  source_transcript: z.string().max(20000).nullable().optional()
}).strict().superRefine((value, ctx) => {
  if (value.transaction_type === "donation_received" && value.amount_paid !== null && value.amount_paid !== 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount_paid"], message: "A donation received at no cost must have amount_paid 0; otherwise clarify whether this is a partial purchase." });
  }
  if (value.transaction_type === "purchase_received" && value.amount_paid === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount_paid"], message: "A purchase must have a positive amount or remain null pending clarification." });
  }
});

export const intakeBody = z.object({
  transaction: transactionDraft,
  source_message_id: z.string().trim().min(1).max(500).nullable().optional(),
  source_channel: z.string().trim().min(1).max(80).default("api"),
  submitted_by: z.string().trim().max(300).nullable().optional(),
  idempotency_key: z.string().trim().min(8).max(200).nullable().optional()
}).strict();
