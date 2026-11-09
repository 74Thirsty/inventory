import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(new URL("../" + path, import.meta.url), "utf8"));
const schema = await readJson("schemas/transaction.schema.json");
const intake = await readJson("workflows/n8n-dictated-teams-intake.json");
const starter = await readJson("workflows/n8n-voice-intake-starter.json");

if (!schema.$schema || !Array.isArray(schema.required)) throw new Error("Transaction JSON Schema is incomplete.");
for (const name of ["Receive dictated Teams message", "Authenticate intake request", "Extract structured transaction", "Build draft envelope", "Create pending inventory record"]) {
  if (!intake.nodes.some((node) => node.name === name)) throw new Error("Missing n8n node: " + name);
}
const codeNodes = intake.nodes.filter((node) => node.type === "n8n-nodes-base.code");
for (const node of codeNodes) new Function(node.parameters.jsCode);
if (intake.settings.saveDataSuccessExecution !== "none" || intake.settings.saveDataErrorExecution !== "none") {
  throw new Error("n8n execution payload retention must remain disabled for sensitive intake data.");
}
if (!starter.nodes?.length) throw new Error("Starter workflow contains no nodes.");
process.stdout.write("Schemas and n8n workflow artifacts validated.\n");
