import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { sql } from "./db.js";
import { config } from "./config.js";
import { intakeBody, workRequestIntake, workRequestPlan } from "./schema.js";
import { requireApproverAuth, requireIntakeAuth } from "./security.js";
import { transactionHtml, transactionDocx } from "./documents.js";

const toRecord = (row) => row ? {
  ...row,
  amount_paid: row.amount_paid === null ? null : Number(row.amount_paid),
  amount_received: row.amount_received === null ? null : Number(row.amount_received),
  items: row.items,
  counterparty: row.counterparty
} : null;


function approvalMissing(record, auditMissing = []) {
  const missing = [...auditMissing];
  const add = (field) => { if (!missing.includes(field)) missing.push(field); };
  if (!record.occurred_at) add("occurred_at");
  if (!record.received_by) add("received_by");
  if (!record.purpose) add("purpose");
  if (["donation_received","purchase_received","reimbursement_requested","cash_contribution","equipment_received"].includes(record.transaction_type) && !record.counterparty?.name) add("counterparty.name");
  if (["purchase_received","reimbursement_requested","equipment_received"].includes(record.transaction_type) && record.amount_paid === null) add("amount_paid");
  if (record.transaction_type === "cash_contribution" && (record.amount_received === null || record.amount_received <= 0)) add("amount_received");
  if (record.transaction_type === "donation_received" && (record.amount_paid === null || Number(record.amount_paid) !== 0)) add("amount_paid must be zero for a fully donated item");
  if (record.transaction_type === "cash_contribution" && !record.currency) add("currency");
  if (record.transaction_type !== "cash_contribution" && (!Array.isArray(record.items) || record.items.length === 0)) add("items");
  if (record.transaction_type === "inventory_adjustment" && record.items.some((item) => !item.adjustment_direction)) add("inventory_adjustment direction");
  return missing;
}

export function buildApp() {
  const app = Fastify({
    logger: { level: config.logLevel, redact: ["req.headers.authorization"] },
    trustProxy: config.trustProxy,
    bodyLimit: 1024 * 1024
  });

  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async (_req, reply) => {
    try { await sql`SELECT 1`; return { status: "ready" }; }
    catch { return reply.code(503).send({ status: "not_ready" }); }
  });

  app.post("/v1/transactions", { preHandler: requireIntakeAuth }, async (request, reply) => {
    const parsed = intakeBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_failed", details: parsed.error.issues });
    const input = parsed.data;
    const id = randomUUID();
    try {
      const result = await sql.begin(async (tx) => {
        if (input.idempotency_key) {
          await tx`SELECT pg_advisory_xact_lock(hashtext(${input.idempotency_key}))`;
          const prior = await tx`SELECT response FROM idempotency_keys WHERE key = ${input.idempotency_key}`;
          if (prior.length) {
            const priorId = prior[0].response?.id;
            const existing = priorId ? await tx`SELECT * FROM transactions WHERE id = ${priorId}` : [];
            return { duplicate: true, record: existing.length ? toRecord(existing[0]) : prior[0].response };
          }
        }
        const rows = await tx`
          INSERT INTO transactions (
            id, transaction_type, status, occurred_at, counterparty, items,
            amount_paid, amount_received, currency, purpose, received_by, notes, source_transcript,
            source_message_id, source_channel, submitted_by
          ) VALUES (
            ${id}, ${input.transaction.transaction_type}, 'draft_needs_approval',
            ${input.transaction.occurred_at}, ${tx.json(input.transaction.counterparty)},
            ${tx.json(input.transaction.items)}, ${input.transaction.amount_paid}, ${input.transaction.amount_received},
            ${input.transaction.currency}, ${input.transaction.purpose},
            ${input.transaction.received_by}, ${input.transaction.notes},
            ${input.transaction.source_transcript ?? null}, ${input.source_message_id ?? null},
            ${input.source_channel}, ${input.submitted_by ?? null}
          ) RETURNING *
        `;
        const record = toRecord(rows[0]);
        await tx`INSERT INTO audit_events (transaction_id,event_type,actor,source,details) VALUES (${id},'draft_created',${input.submitted_by ?? null},${input.source_channel},${tx.json({missing_or_ambiguous: input.transaction.missing_or_ambiguous})})`;
        if (input.idempotency_key) await tx`INSERT INTO idempotency_keys (key,response) VALUES (${input.idempotency_key},${tx.json({id, status: record.status})}) ON CONFLICT (key) DO NOTHING`;
        return { duplicate: false, record };
      });
      return reply.code(result.duplicate ? 200 : 201).send({ duplicate: result.duplicate, record: result.record });
    } catch (error) {
      if (error.code === "23505" && input.source_message_id) {
        const existing = await sql`SELECT * FROM transactions WHERE source_message_id = ${input.source_message_id}`;
        return reply.code(200).send({ duplicate: true, record: toRecord(existing[0]) });
      }
      request.log.error({ err: error }, "transaction create failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  app.get("/v1/transactions", { preHandler: requireApproverAuth }, async (request, reply) => {
    const status = request.query.status || "draft_needs_approval";
    if (!["draft_needs_approval","approved","rejected","all"].includes(status)) return reply.code(400).send({ error: "invalid_status" });
    const requestedLimit = Number(request.query.limit || 50);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 200) : 50;
    const rows = status === "all"
      ? await sql`SELECT * FROM transactions ORDER BY created_at DESC LIMIT ${limit}`
      : await sql`SELECT * FROM transactions WHERE status = ${status} ORDER BY created_at DESC LIMIT ${limit}`;
    return { records: rows.map(toRecord) };
  });

  app.get("/v1/transactions/:id", { preHandler: requireApproverAuth }, async (request, reply) => {
    const rows = await sql`SELECT * FROM transactions WHERE id = ${request.params.id}`;
    if (!rows.length) return reply.code(404).send({ error: "not_found" });
    return { record: toRecord(rows[0]) };
  });


  app.patch("/v1/transactions/:id", { preHandler: requireApproverAuth }, async (request, reply) => {
    const actor = String(request.headers["x-actor-id"] || "").trim();
    if (!actor) return reply.code(400).send({ error: "x-actor-id_required" });
    const parsed = intakeBody.safeParse({ transaction: request.body?.transaction, source_channel: "correction", submitted_by: actor });
    if (!parsed.success) return reply.code(400).send({ error: "validation_failed", details: parsed.error.issues });
    const input = parsed.data.transaction;
    const corrected = await sql.begin(async (tx) => {
      const rows = await tx`
        UPDATE transactions SET transaction_type=${input.transaction_type}, occurred_at=${input.occurred_at},
        counterparty=${tx.json(input.counterparty)}, items=${tx.json(input.items)}, amount_paid=${input.amount_paid}, amount_received=${input.amount_received},
        currency=${input.currency}, purpose=${input.purpose}, received_by=${input.received_by}, notes=${input.notes},
        source_transcript=${input.source_transcript ?? null}, updated_at=now()
        WHERE id=${request.params.id} AND status='draft_needs_approval' RETURNING *
      `;
      if (!rows.length) return null;
      await tx`INSERT INTO audit_events (transaction_id,event_type,actor,source,details)
        VALUES (${request.params.id},'draft_corrected',${actor},'api',${tx.json({missing_or_ambiguous: input.missing_or_ambiguous, transaction: input})})`;
      return rows[0];
    });
    if (!corrected) {
      const exists = await sql`SELECT status FROM transactions WHERE id=${request.params.id}`;
      return exists.length ? reply.code(409).send({ error: "invalid_state", status: exists[0].status }) : reply.code(404).send({ error: "not_found" });
    }
    return { record: toRecord(corrected) };
  });

  app.post("/v1/transactions/:id/approve", { preHandler: requireApproverAuth }, async (request, reply) => {
    const actor = String(request.headers["x-actor-id"] || "").trim();
    if (!actor) return reply.code(400).send({ error: "x-actor-id_required" });
    try {
      const record = await sql.begin(async (tx) => {
        const rows = await tx`SELECT * FROM transactions WHERE id = ${request.params.id} FOR UPDATE`;
        if (!rows.length) return null;
        if (rows[0].status !== "draft_needs_approval") return { conflict: true, status: rows[0].status };
        const draftAudit = await tx`SELECT details FROM audit_events WHERE transaction_id=${request.params.id} AND event_type IN ('draft_created','draft_corrected') ORDER BY occurred_at DESC LIMIT 1`;
        const missing = approvalMissing(rows[0], draftAudit[0]?.details?.missing_or_ambiguous || []);
        if (missing.length) return { incomplete: true, missing };
        const updated = await tx`UPDATE transactions SET status='approved', approved_by=${actor}, approved_at=now(), updated_at=now() WHERE id=${request.params.id} RETURNING *`;
        await tx`INSERT INTO audit_events (transaction_id,event_type,actor,source) VALUES (${request.params.id},'approved',${actor},'api')`;
        return toRecord(updated[0]);
      });
      if (!record) return reply.code(404).send({ error: "not_found" });
      if (record.conflict) return reply.code(409).send({ error: "invalid_state", status: record.status });
      if (record.incomplete) return reply.code(409).send({ error: "incomplete_record", missing: record.missing });
      return { record, document_path: `/v1/transactions/${record.id}/document.docx` };
    } catch (error) {
      request.log.error({ err: error }, "approval failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  app.post("/v1/transactions/:id/reject", { preHandler: requireApproverAuth }, async (request, reply) => {
    const actor = String(request.headers["x-actor-id"] || "").trim();
    const reason = String(request.body?.reason || "").trim();
    if (!actor || !reason) return reply.code(400).send({ error: "actor_and_reason_required" });
    const rejected = await sql.begin(async (tx) => {
      const rows = await tx`
        UPDATE transactions SET status='rejected', rejected_by=${actor}, rejected_at=now(),
        rejection_reason=${reason.slice(0,1000)}, updated_at=now()
        WHERE id=${request.params.id} AND status='draft_needs_approval' RETURNING *
      `;
      if (!rows.length) return null;
      await tx`INSERT INTO audit_events (transaction_id,event_type,actor,source,details)
        VALUES (${request.params.id},'rejected',${actor},'api',${tx.json({reason: reason.slice(0,1000)})})`;
      return rows[0];
    });
    if (!rejected) {
      const exists = await sql`SELECT status FROM transactions WHERE id=${request.params.id}`;
      return exists.length ? reply.code(409).send({ error: "invalid_state", status: exists[0].status }) : reply.code(404).send({ error: "not_found" });
    }
    return { record: toRecord(rejected) };
  });

  app.get("/v1/transactions/:id/audit", { preHandler: requireApproverAuth }, async (request, reply) => {
    const record = await sql`SELECT id FROM transactions WHERE id=${request.params.id}`;
    if (!record.length) return reply.code(404).send({ error: "not_found" });
    const events = await sql`SELECT id,event_type,actor,source,details,occurred_at FROM audit_events WHERE transaction_id=${request.params.id} ORDER BY occurred_at ASC`;
    return { events };
  });

  app.get("/v1/transactions/:id/document", { preHandler: requireApproverAuth }, async (request, reply) => {
    const rows = await sql`SELECT * FROM transactions WHERE id=${request.params.id}`;
    if (!rows.length) return reply.code(404).send({ error: "not_found" });
    if (rows[0].status !== "approved") return reply.code(409).send({ error: "document_requires_approval" });
    const html = transactionHtml(toRecord(rows[0]));
    return reply.type("text/html; charset=utf-8").header("content-disposition", `attachment; filename="llr-transaction-${rows[0].id}.html"`).send(html);
  });


  app.get("/v1/transactions/:id/document.docx", { preHandler: requireApproverAuth }, async (request, reply) => {
    const rows = await sql`SELECT * FROM transactions WHERE id=${request.params.id}`;
    if (!rows.length) return reply.code(404).send({ error: "not_found" });
    if (rows[0].status !== "approved") return reply.code(409).send({ error: "document_requires_approval" });
    const buffer = await transactionDocx(toRecord(rows[0]));
    return reply.type("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      .header("content-disposition", `attachment; filename="llr-transaction-${rows[0].id}.docx"`)
      .send(buffer);
  });

  app.get("/v1/reports/inventory", { preHandler: requireApproverAuth }, async () => {
    const rows = await sql`
      SELECT item->>'description' AS item, item->>'unit' AS unit,
        SUM(CASE
          WHEN t.transaction_type IN ('donation_received','purchase_received','equipment_received')
            AND t.status='approved' THEN COALESCE((item->>'quantity')::numeric,0)
          WHEN t.transaction_type='inventory_used' AND t.status='approved'
            THEN -COALESCE((item->>'quantity')::numeric,0)
          WHEN t.transaction_type='inventory_adjustment' AND t.status='approved' AND item->>'adjustment_direction'='increase'
            THEN COALESCE((item->>'quantity')::numeric,0)
          WHEN t.transaction_type='inventory_adjustment' AND t.status='approved' AND item->>'adjustment_direction'='decrease'
            THEN -COALESCE((item->>'quantity')::numeric,0)
          ELSE 0 END) AS quantity_on_hand
      FROM transactions t CROSS JOIN LATERAL jsonb_array_elements(t.items) item
      GROUP BY item->>'description', item->>'unit'
      ORDER BY item->>'description'
    `;
    return { inventory: rows.map((r) => ({ ...r, quantity_on_hand: Number(r.quantity_on_hand) })) };
  });

  app.get("/v1/reports/summary", { preHandler: requireApproverAuth }, async () => {
    const rows = await sql`SELECT status, transaction_type, COUNT(*)::int AS count, COALESCE(SUM(amount_paid),0)::numeric(12,2) AS amount_paid, COALESCE(SUM(amount_received),0)::numeric(12,2) AS amount_received FROM transactions GROUP BY status, transaction_type ORDER BY status, transaction_type`;
    return { summary: rows.map((r) => ({ ...r, amount_paid: Number(r.amount_paid), amount_received: Number(r.amount_received) })) };
  });


  // General administrative work intake. The LLM/n8n layer interprets the
  // request; this API stores the original source and a reviewable work plan.
  app.post("/v1/work-requests", { preHandler: requireIntakeAuth }, async (request, reply) => {
    const parsed = workRequestIntake.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_failed", details: parsed.error.issues });
    const input = parsed.data;
    const id = randomUUID();
    try {
      const result = await sql.begin(async (tx) => {
        if (input.idempotency_key) {
          await tx`SELECT pg_advisory_xact_lock(hashtext(${input.idempotency_key}))`;
          const prior = await tx`SELECT id FROM work_requests WHERE idempotency_key=${input.idempotency_key}`;
          if (prior.length) {
            const existing = await tx`SELECT * FROM work_requests WHERE id=${prior[0].id}`;
            return { duplicate: true, work_request: existing[0] };
          }
        }
        const rows = await tx`
          INSERT INTO work_requests (id,status,source_text,source_channel,source_message_id,submitted_by,idempotency_key)
          VALUES (${id},'received',${input.source_text},${input.source_channel},${input.source_message_id ?? null},${input.submitted_by ?? null},${input.idempotency_key ?? null})
          RETURNING *
        `;
        await tx`INSERT INTO work_request_events (work_request_id,event_type,actor,details)
          VALUES (${id},'received',${input.submitted_by ?? null},${tx.json({source_channel: input.source_channel})})`;
        return { duplicate: false, work_request: rows[0] };
      });
      return reply.code(result.duplicate ? 200 : 201).send(result);
    } catch (error) {
      if (error.code === "23505" && input.source_message_id) {
        const existing = await sql`SELECT * FROM work_requests WHERE source_message_id=${input.source_message_id}`;
        if (existing.length) return reply.code(200).send({ duplicate: true, work_request: existing[0] });
      }
      request.log.error({ err: error }, "work request intake failed");
      return reply.code(500).send({ error: "internal_error" });
    }
  });

  app.get("/v1/work-requests", { preHandler: requireApproverAuth }, async (request, reply) => {
    const allowed = ["received","planned","awaiting_clarification","ready_for_review","approved","rejected","completed","all"];
    const status = request.query.status || "all";
    if (!allowed.includes(status)) return reply.code(400).send({ error: "invalid_status" });
    const requestedLimit = Number(request.query.limit || 50);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit),1),200) : 50;
    const rows = status === "all"
      ? await sql`SELECT * FROM work_requests ORDER BY created_at DESC LIMIT ${limit}`
      : await sql`SELECT * FROM work_requests WHERE status=${status} ORDER BY created_at DESC LIMIT ${limit}`;
    return { work_requests: rows };
  });

  app.get("/v1/work-requests/:id", { preHandler: requireApproverAuth }, async (request, reply) => {
    const rows = await sql`SELECT * FROM work_requests WHERE id=${request.params.id}`;
    if (!rows.length) return reply.code(404).send({ error: "not_found" });
    const events = await sql`SELECT id,event_type,actor,details,occurred_at FROM work_request_events WHERE work_request_id=${request.params.id} ORDER BY occurred_at ASC`;
    return { work_request: rows[0], events };
  });

  app.put("/v1/work-requests/:id/plan", { preHandler: requireIntakeAuth }, async (request, reply) => {
    const parsed = workRequestPlan.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "validation_failed", details: parsed.error.issues });
    const plan = parsed.data;
    if (plan.deliverables.length === 0) return reply.code(400).send({ error: "at_least_one_deliverable_required" });
    const status = plan.open_questions.length ? "awaiting_clarification" : "ready_for_review";
    const updated = await sql.begin(async (tx) => {
      const rows = await tx`
        UPDATE work_requests SET status=${status},intent_summary=${plan.intent_summary},
          context=${tx.json(plan.context)},deliverables=${tx.json(plan.deliverables)},
          open_questions=${tx.json(plan.open_questions)},execution_plan=${tx.json(plan.execution_plan)},
          risk_flags=${tx.json(plan.risk_flags)},updated_at=now()
        WHERE id=${request.params.id} AND status IN ('received','planned','awaiting_clarification','ready_for_review')
        RETURNING *
      `;
      if (!rows.length) return null;
      await tx`INSERT INTO work_request_events (work_request_id,event_type,actor,details)
        VALUES (${request.params.id},'plan_recorded','n8n',${tx.json({status,deliverable_count:plan.deliverables.length,open_question_count:plan.open_questions.length})})`;
      return rows[0];
    });
    if (!updated) {
      const exists = await sql`SELECT status FROM work_requests WHERE id=${request.params.id}`;
      return exists.length ? reply.code(409).send({error:"invalid_state",status:exists[0].status}) : reply.code(404).send({error:"not_found"});
    }
    return { work_request: updated };
  });

  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: "not_found" }));
  return app;
}
