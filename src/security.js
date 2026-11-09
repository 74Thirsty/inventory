import { timingSafeEqual } from "node:crypto";

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function bearer(request) {
  const value = request.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

export async function requireIntakeAuth(request, reply) {
  if (!safeEqual(bearer(request), process.env.API_TOKEN || "")) {
    return reply.code(401).send({ error: "unauthorized" });
  }
}

export async function requireApproverAuth(request, reply) {
  if (!safeEqual(bearer(request), process.env.APPROVER_TOKEN || "")) {
    return reply.code(401).send({ error: "unauthorized" });
  }
}
