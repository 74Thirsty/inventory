import { z } from "zod";

const nullableText = z.string().trim().max(2000).nullable();
const item = z.object({
  description: z.string().trim().min(1).max(500),
  category: z.enum(["food_beverage","serving_supplies","cleaning_supplies","merchandise","equipment","office_supplies","other"]).nullable().optional(),
  quantity: z.number().finite().positive(),
  unit: z.string().trim().min(1).max(80),
  package_count: z.number().finite().positive().nullable().optional(),
  units_per_package: z.number().finite().positive().nullable().optional(),
  condition: z.enum(["new_unopened","usable","perishable_check","damaged","unknown"]).nullable().optional(),
  adjustment_direction: z.enum(["increase","decrease"]).nullable().optional(),
  expiration_date: z.string().date().nullable().optional()
}).strict();

export const transactionDraft = z.object({
  transaction_type: z.enum(["donation_received","purchase_received","reimbursement_requested","inventory_used","inventory_adjustment","cash_contribution","equipment_received"]),
  occurred_at: z.string().date().nullable(),
  counterparty: z.object({
    name: z.string().trim().max(300).nullable(),
    kind: z.enum(["donor","supplier","volunteer","attendee","other"]).nullable()
  }).strict().nullable(),
  items: z.array(item).max(100),
  amount_paid: z.number().finite().nonnegative().nullable(),
  amount_received: z.number().finite().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  purpose: nullableText,
  received_by: z.string().trim().max(300).nullable(),
  notes: nullableText,
  missing_or_ambiguous: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  source_transcript: z.string().max(20000).nullable().optional()
}).strict().superRefine((value, ctx) => {
  if (value.transaction_type !== "cash_contribution" && value.items.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items"], message: "At least one item is required for an inventory transaction." });
  }
  if (value.transaction_type === "inventory_adjustment" && value.items.some((entry) => !entry.adjustment_direction)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["items"], message: "Every inventory adjustment item requires adjustment_direction: increase or decrease." });
  }
  if (value.transaction_type === "cash_contribution" && (value.amount_received === null || value.amount_received <= 0 || value.amount_paid !== null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount_received"], message: "Cash contributions require a positive amount_received and no amount_paid." });
  }
  if (value.transaction_type !== "cash_contribution" && value.amount_received !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount_received"], message: "amount_received is only valid for cash contributions." });
  }
  if (value.transaction_type === "donation_received" && value.amount_paid !== null && value.amount_paid !== 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount_paid"], message: "A donation received at no cost must have amount_paid 0; otherwise clarify whether this is a partial purchase." });
  }
  if (["purchase_received","reimbursement_requested","cash_contribution"].includes(value.transaction_type) && value.amount_paid === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount_paid"], message: "This transaction must have a positive amount or remain null pending clarification." });
  }
});

export const intakeBody = z.object({
  transaction: transactionDraft,
  source_message_id: z.string().trim().min(1).max(500).nullable().optional(),
  source_channel: z.string().trim().min(1).max(80).default("api"),
  submitted_by: z.string().trim().max(300).nullable().optional(),
  idempotency_key: z.string().trim().min(8).max(200).nullable().optional()
}).strict();


// General administrative work intake. This contract deliberately describes the
// request, not a fixed document type or a preselected workflow.
const plannedDeliverable = z.object({
  kind: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(300),
  purpose: z.string().trim().min(1).max(2000),
  format: z.enum(["docx","pdf","xlsx","pptx","html","txt","other"]),
  required_facts: z.array(z.string().trim().min(1).max(500)).max(100).default([])
}).strict();

export const workRequestIntake = z.object({
  source_text: z.string().trim().min(1).max(20000),
  source_channel: z.string().trim().min(1).max(80).default("api"),
  source_message_id: z.string().trim().min(1).max(500).nullable().optional(),
  submitted_by: z.string().trim().max(300).nullable().optional(),
  idempotency_key: z.string().trim().min(8).max(200).nullable().optional()
}).strict();

export const workRequestPlan = z.object({
  intent_summary: z.string().trim().min(1).max(4000),
  context: z.record(z.string(), z.unknown()).default({}),
  deliverables: z.array(plannedDeliverable).max(50),
  open_questions: z.array(z.string().trim().min(1).max(1000)).max(100).default([]),
  execution_plan: z.array(z.string().trim().min(1).max(2000)).max(100).default([]),
  risk_flags: z.array(z.string().trim().min(1).max(1000)).max(50).default([])
}).strict();
