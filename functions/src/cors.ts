const RAW_ALLOWED_ORIGINS = [
  "https://ambassadors.t4leader.com",
  "https://t4l-ambassador-platform.vercel.app",
  "https://tier.t4leader.com",
];

export const normalizeOrigin = (origin: string): string =>
  origin.trim().replace(/\/+$/, "").toLowerCase();

export const ALLOWED_ORIGINS = new Set(RAW_ALLOWED_ORIGINS.map(normalizeOrigin));

export function applyCors(req: any, res: any) {
  const origin = (req.get("origin") ?? "").trim();
  const hasOrigin = origin.length > 0;
  const allowed = !hasOrigin || ALLOWED_ORIGINS.has(normalizeOrigin(origin));

  if (hasOrigin && allowed) {
    res.set("Access-Control-Allow-Origin", origin);
  }

  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Credentials", "true");
  res.set("Access-Control-Max-Age", "3600");
  res.set("Access-Control-Expose-Headers", "Content-Range, X-Total-Count");

  if (req.method === "OPTIONS") {
    res.status(allowed ? 204 : 403).send("");
    return { done: true, allowed };
  }

  if (!allowed) {
    res.status(403).json({ ok: false, error: "Origin not allowed." });
    return { done: true, allowed };
  }

  return { done: false, allowed };
}
