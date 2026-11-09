import { Document, Packer, Paragraph, Table, TableRow, TableCell, HeadingLevel, WidthType } from "docx";
import { config } from "./config.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));

export function transactionHtml(record) {
  const rows = record.items.map((item) => "<tr><td>" + esc(item.description) + "</td><td>" + esc(item.quantity) + " " + esc(item.unit) + "</td><td>" + esc(item.category || "Not specified") + "</td><td>" + esc(item.condition || "Not recorded") + "</td></tr>").join("");
  return "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Inventory record</title><style>body{font:15px/1.5 Arial,sans-serif;max-width:850px;margin:40px auto;padding:0 24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccd3dd;padding:8px;text-align:left}</style></head><body>" +
    "<h1>" + esc(config.organizationName) + "</h1><h2>Inventory transaction record</h2>" +
    "<p>Record ID: " + esc(record.id) + "<br>Status: " + esc(record.status) + "<br>Type: " + esc(record.transaction_type) + "<br>Date: " + esc(record.occurred_at || "Not provided") + "<br>Donor/supplier: " + esc(record.counterparty?.name || "Not provided") + "<br>Purpose: " + esc(record.purpose || "Not provided") + "<br>Received by: " + esc(record.received_by || "Not provided") + "<br>Amount paid: " + esc(record.amount_paid === null ? "Not provided" : record.amount_paid + " " + (record.currency || "USD")) + "</p>" +
    "<table><thead><tr><th>Item</th><th>Quantity</th><th>Category</th><th>Condition</th></tr></thead><tbody>" + rows + "</tbody></table>" +
    "<p>Notes: " + esc(record.notes || "None") + "</p><p>Original voice transcript: " + esc(record.source_transcript || "Not captured") + "</p>" +
    "<footer>This is an operational record, not a tax receipt, valuation, or acknowledgment of a tax-deductible contribution.</footer></body></html>";
}

export async function transactionDocx(record) {
  const lines = [
    new Paragraph({ text: config.organizationName, heading: HeadingLevel.TITLE }),
    new Paragraph({ text: "Inventory transaction record", heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: "Record ID: " + record.id + " | Status: " + record.status.toUpperCase() }),
    new Paragraph({ text: "Transaction type: " + record.transaction_type }),
    new Paragraph({ text: "Date: " + (record.occurred_at || "Not provided") }),
    new Paragraph({ text: "Donor / supplier: " + (record.counterparty?.name || "Not provided") }),
    new Paragraph({ text: "Purpose: " + (record.purpose || "Not provided") }),
    new Paragraph({ text: "Received by: " + (record.received_by || "Not provided") }),
    new Paragraph({ text: "Amount paid: " + (record.amount_paid === null ? "Not applicable" : record.amount_paid + " " + (record.currency || "USD")) }),
    new Paragraph({ text: "Cash received: " + (record.amount_received === null ? "Not applicable" : record.amount_received + " " + (record.currency || "USD")) })
  ];
  const rows = [
    new TableRow({ children: ["Item", "Quantity", "Category", "Condition"].map((v) => new TableCell({ children: [new Paragraph({ text: v })] })) }),
    ...record.items.map((item) => new TableRow({ children: [item.description, String(item.quantity) + " " + item.unit, item.category || "Not specified", item.condition || "Not recorded"].map((v) => new TableCell({ children: [new Paragraph({ text: String(v) })] })) }))
  ];
  const doc = new Document({ sections: [{ children: [...lines, new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }), new Paragraph({ text: "Notes: " + (record.notes || "None") }), new Paragraph({ text: "Original voice transcript: " + (record.source_transcript || "Not captured") }), new Paragraph({ text: "This is an operational record, not a tax receipt, valuation, or acknowledgment of a tax-deductible contribution." })] }] });
  return Packer.toBuffer(doc);
}
