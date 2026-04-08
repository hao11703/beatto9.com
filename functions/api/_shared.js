const ALLOWED_GAMES = new Set(["tap-sprint", "find-the-one", "one-move-left"]);

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json; charset=utf-8");

  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "no-store");
  }

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function isAllowedGame(gameId) {
  return ALLOWED_GAMES.has(gameId);
}

export function sanitizeDisplayName(name, fallbackId = "anon") {
  const trimmed = String(name || "").trim().replace(/\s+/g, " ");
  if (trimmed) {
    return trimmed.slice(0, 18);
  }

  return `Player ${String(fallbackId).slice(-4).toUpperCase()}`;
}

export function clampInteger(value, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    return min;
  }
  return Math.max(min, Math.min(max, parsed));
}

export function safeJsonString(value) {
  try {
    const encoded = JSON.stringify(value || {});
    return encoded.length <= 2000 ? encoded : JSON.stringify({ truncated: true });
  } catch {
    return JSON.stringify({ invalid: true });
  }
}

export function hasDb(context) {
  return Boolean(context.env && context.env.DB);
}

export function getClientIp(request) {
  const header =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "";

  return header.split(",")[0].trim() || "unknown";
}

export function getRateBucketKey(prefix, request, extra = "") {
  const ip = getClientIp(request);
  return `${prefix}:${ip}:${extra}`;
}

export async function rateLimit(context, key, limit, windowSeconds) {
  if (!context.env || !context.env.RATE_LIMITS) {
    return { allowed: true, remaining: limit, source: "none" };
  }

  const currentRaw = await context.env.RATE_LIMITS.get(key);
  const current = currentRaw ? Number.parseInt(currentRaw, 10) : 0;

  if (current >= limit) {
    return { allowed: false, remaining: 0, source: "kv" };
  }

  const next = current + 1;
  await context.env.RATE_LIMITS.put(key, String(next), {
    expirationTtl: windowSeconds,
  });

  return {
    allowed: true,
    remaining: Math.max(0, limit - next),
    source: "kv",
  };
}

export function isValidAnonymousUserId(value) {
  return typeof value === "string" && /^u_[a-z0-9_]+$/i.test(value) && value.length <= 80;
}

export function isValidSessionId(value) {
  return typeof value === "string" && /^s_[a-z0-9_]+$/i.test(value) && value.length <= 80;
}

function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function importSecret(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signRunToken(payload, secret) {
  const encodedPayload = encodeBase64Url(new TextEncoder().encode(JSON.stringify(payload)));

  if (!secret) {
    return `${encodedPayload}.stub`;
  }

  const key = await importSecret(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encodedPayload));
  const encodedSignature = encodeBase64Url(new Uint8Array(signature));
  return `${encodedPayload}.${encodedSignature}`;
}

export async function verifyRunToken(token, secret) {
  if (typeof token !== "string" || !token.includes(".")) {
    return { valid: false, payload: null };
  }

  const [encodedPayload, encodedSignature] = token.split(".", 2);

  try {
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload)));

    if (!secret) {
      return {
        valid: encodedSignature === "stub",
        payload,
      };
    }

    const key = await importSecret(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(encodedPayload)
    );

    return { valid, payload };
  } catch {
    return { valid: false, payload: null };
  }
}
