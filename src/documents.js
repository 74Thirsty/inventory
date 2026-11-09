import { Document, Packer, Paragraph, Table, TableRow, TableCell, HeadingLevel, WidthType, TextRun } from "docx";
import { config } from "./config.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

export function transactionHtml(record) {
  const rows = record.items.map((item) => `<tr><td>${esc(item.description)}</td><td>${esc(item.quantity)} ${esc(item.unit)}</td><td>${esc(item.category || "Not specified")}</td><td>${esc(item.condition || "Not recorded")}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Inventory record ${esc(record.id)}</title><style>body{font:15px/1.5 Arial,sans-serif;color:#172033;max-width:850px;margin:40px auto;padding:0 24px}h1{margin-bottom:4px}small{color:#596579}.status{padding:8px 12px;border:1px solid #aab4c3;display:inline-block;margin:16px 0}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{border:1px solid #ccd3dd;padding:9px;text-align:left}footer{margin-top:40px;border-top:1px solid #ccd3dd;padding-top:12px;color:#596579;font-size:12px}@media print{body{margin:0}}</style></head><body><h1>${esc(config.organizationName)}</h1><h2>Inventory transaction record</h2><small>Record ID: ${esc(record.id)} · Created: ${esc(record.created_at)}</small><p class="status">Status: ${esc(record.status).toUpperCase()}</p><p><b>Type:</b> ${esc(record.transaction_type)}<br><b>Date received/occurred:</b> ${esc(record.occurred_at || "Not provided")}<br><b>Donor / supplier / person:</b> ${esc(record.counterparty?.name || "Not provided")}<br><b>Purpose:</b> ${esc(record.purpose || "Not provided")}<br><b>Received by:</b> ${esc(record.received_by || "Not provided")}<br><b>Amount paid:</b> ${record.amount_paid === null ? "Not provided" : esc(record.amount_paid) + " " + esc(record.currency || "USD")}</p><table><thead><tr><th>Item</th><th>Quantity</th><th>Category</th><th>Condition</th></tr></thead><tbody>${rows}</tbody></table><p><b>Notes:</b> ${esc(record.notes || "None")}</p><p><b>Original voice transcript:</b><br>${esc(record.source_transcript || "Not captured")}</p><footer>Generated from an administrative record. This document is not a tax receipt, valuation, or acknowledgment of a tax-deductible contribution. Supporting evidence and approval details must be retained separately.</footer></body></html>`;
}

export async function transactionDocx(record) {
  const p = (label, value) => new Paragraph({ children: [new TextRun({ text: label, bold: true }), new (awaitImportTextRun())({ text: String(value ?? "Not provided") })] });
  const rows = [
    new TableRow({ children: ["Item", "Quantity", "Category", "Condition"].map((v) => new TableCell({ children: [new Paragraph({ text: v })] })) }),
    ...record.items.map((item) => new TableRow({ children: [
      item.description, `${item.quantity} ${item.unit}`, item.category || "Not specified", item.condition || "Not recorded"
    ].map((v) => new TableCell({ children: [new Paragraph({ text: String(v) })] })) }))
  ];
  const doc = new Document({ sections: [{ children: [
    new Paragraph({ text: config.organizationName, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: "Inventory transaction record", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: `Record ID: ${record.id} | Status: ${record.status.toUpperCase()}` }),
    new Paragraph({ children: [new (awaitImportTextRun())({ text: "Transaction type: ", bold: true }), new (awaitImportTextRun())({ text: record.transaction_type })] }),
    new Paragraph({ children: [new (awaitImportTextRun())({ text: "Date: ", bold: true }), new (awaitImportTextRun())({ text: record.occurred_at || "Not provided" })] }),
    new Paragraph({ children: [new (awaitImportTextRun())({ text: "Donor / supplier: ", bold: true }), new (awaitImportTextRun())({ text: record.counterparty?.name || "Not provided" })] }),
    new Paragraph({ children: [new (awaitImportTextRun())({ text: "Purpose: ", bold: true }), new (awaitImportTextRun())({ text: record.purpose || "Not provided" })] }),
    new Paragraph({ children: [new (awaitImportTextRun())({ text: "Received by: ", bold: true }), new (awaitImportTextRun())({ text: record.received_by || "Not provided" })] }),
    new Paragraph({ children: [new (awaitImportTextRun())({ text: "Amount paid: ", bold: true }), new (awaitImportTextRun())({ text: record.amount_paid === null ? "Not provided" : `${record.amount_paid} ${record.currency || "USD"}` })] }),
    new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
    new Paragraph({ text: `Notes: ${record.notes || "None"}` }),
    new Paragraph({ text: `Original voice transcript: ${record.source_transcript || "Not captured"}` }),
    new Paragraph({ text: "This is an operational record, not a tax receipt, valuation, or acknowledgment of a tax-deductible contribution." })
  ] }] });
  return Packer.toBuffer(doc);
}

