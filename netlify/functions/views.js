const crypto = require("crypto");

let getStore;
try {
  ({ getStore } = require("@netlify/blobs"));
} catch (e) {
  getStore = null;
}

function sha256(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

exports.handler = async (event) => {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,x-client-id",
    "access-control-allow-methods": "GET,OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const qs = event.queryStringParameters || {};
  // Accept multiple param names to avoid frontend mismatches.
  // Prefer numeric ids but keep as string key.
  const idRaw = (qs.id ?? qs.imageId ?? qs.itemId ?? qs.tutorialId ?? "");
  const id = String(idRaw).trim();
  if (!id) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing id" }) };
  }

  // Visitor identity: prefer Netlify-provided IP headers, fallback to forwarded-for, then client id.
  const h = (event.headers || {});
  const nfIp = h["x-nf-client-connection-ip"] || h["X-NF-Client-Connection-Ip"] || h["x-nf-client-connection-ipv6"] || h["X-NF-Client-Connection-Ipv6"] || "";
  const xff = h["x-forwarded-for"] || h["X-Forwarded-For"] || "";
  const ip = String(nfIp || xff).split(",")[0].trim();
  const clientId = h["x-client-id"] || h["X-Client-Id"] || "";
  const ua = h["user-agent"] || h["User-Agent"] || "";
  const visitorRaw = ip || clientId || ua || "unknown";
  const visitor = sha256(visitorRaw);

  // If blobs are unavailable, degrade gracefully to per-request 0 (client cache still works)
  if (!getStore) {
    return { statusCode: 200, headers, body: JSON.stringify({ views: 0, degraded: true }) };
  }

  const store = getStore("oa-views");

  const seenKey = `seen:${id}:${visitor}`;
  const countKey = `count:${id}`;

  try {
    const already = await store.get(seenKey, { type: "text" });
    let count = Number(await store.get(countKey, { type: "text" })) || 0;

    if (!already) {
      // mark seen
      await store.set(seenKey, "1");
      // increment (not strictly atomic, but OK for this use)
      count = count + 1;
      await store.set(countKey, String(count));
    }

    return { statusCode: 200, headers, body: JSON.stringify({ views: count }) };
  } catch (e) {
    // Fail soft
    return { statusCode: 200, headers, body: JSON.stringify({ views: 0, error: "storage_error" }) };
  }
};
