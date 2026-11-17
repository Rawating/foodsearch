import { createHash, randomUUID } from "node:crypto";

const DEFAULT_MONTHLY_TOKEN_BUDGET = 50_000;
const DEFAULT_DAILY_REQUEST_LIMIT = 7;
const DEFAULT_MAX_OUTPUT_TOKENS = 256;

const RESERVE_SCRIPT = `
local used = tonumber(redis.call("HGET", KEYS[1], "used") or "0")
local reserved = tonumber(redis.call("HGET", KEYS[1], "reserved") or "0")
local daily = tonumber(redis.call("GET", KEYS[2]) or "0")
local daily_limit = tonumber(ARGV[1])
local monthly_limit = tonumber(ARGV[2])
local reservation = tonumber(ARGV[3])

if daily >= daily_limit then
  return {0, "visitor_limit"}
end
if used + reserved + reservation > monthly_limit then
  return {0, "monthly_limit"}
end

redis.call("HINCRBY", KEYS[1], "reserved", reservation)
redis.call("EXPIRE", KEYS[1], ARGV[4])
redis.call("INCR", KEYS[2])
if redis.call("TTL", KEYS[2]) < 0 then
  redis.call("EXPIRE", KEYS[2], ARGV[5])
end
redis.call("SET", KEYS[3], reservation, "EX", ARGV[4])
return {1, reservation}
`;

const SETTLE_SCRIPT = `
local reservation = tonumber(redis.call("GET", KEYS[2]))
if not reservation then
  return 0
end

redis.call("HINCRBY", KEYS[1], "reserved", -reservation)
redis.call("HINCRBY", KEYS[1], "used", tonumber(ARGV[1]))
redis.call("DEL", KEYS[2])
return 1
`;

const RELEASE_SCRIPT = `
local reservation = tonumber(redis.call("GET", KEYS[2]))
if not reservation then
  return 0
end

redis.call("HINCRBY", KEYS[1], "reserved", -reservation)
redis.call("DEL", KEYS[2])
return 1
`;

function readPositiveInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

export function getAiLimits() {
  return {
    monthlyTokenBudget: readPositiveInteger(
      "AI_MONTHLY_TOKEN_BUDGET",
      DEFAULT_MONTHLY_TOKEN_BUDGET
    ),
    dailyRequestLimit: readPositiveInteger(
      "AI_DAILY_REQUEST_LIMIT",
      DEFAULT_DAILY_REQUEST_LIMIT
    ),
    maxOutputTokens: readPositiveInteger(
      "AI_MAX_OUTPUT_TOKENS",
      DEFAULT_MAX_OUTPUT_TOKENS
    ),
  };
}

export function estimateMaxRequestTokens(messages, maxOutputTokens) {
  const serializedMessages = JSON.stringify(messages);
  const messageOverhead = messages.length * 32;
  return Buffer.byteLength(serializedMessages, "utf8") + messageOverhead + maxOutputTokens;
}

function getUtcWindows(now = new Date()) {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return {
    month: now.toISOString().slice(0, 7),
    day: now.toISOString().slice(0, 10),
    monthTtl: Math.max(1, Math.ceil((monthStart - now) / 1000)),
    dayTtl: Math.max(1, Math.ceil((dayStart - now) / 1000)),
  };
}

function getVisitorHash(ipAddress) {
  return createHash("sha256")
    .update(`${process.env.XAI_API_KEY}:${ipAddress}`)
    .digest("hex");
}

async function runRedisScript(script, keys, args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Upstash Redis is not configured.");

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        "EVAL",
        script,
        String(keys.length),
        ...keys,
        ...args.map(String),
      ]),
    });
  } catch {
    throw new Error("Could not reach the AI usage quota store.");
  }

  if (!response.ok) throw new Error("The AI usage quota store returned an error.");

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The AI usage quota store returned an invalid response.");
  }
  if (!data || typeof data !== "object" || !Object.prototype.hasOwnProperty.call(data, "result")) {
    throw new Error("The AI usage quota store returned an invalid response.");
  }
  return data.result;
}

export async function reserveAiUsage(ipAddress, estimatedTokens) {
  if (!ipAddress) throw new Error("Visitor IP is unavailable.");
  if (!Number.isSafeInteger(estimatedTokens) || estimatedTokens <= 0) {
    throw new Error("Invalid AI token reservation.");
  }

  const limits = getAiLimits();
  const windows = getUtcWindows();
  const visitorHash = getVisitorHash(ipAddress);
  const reservationId = randomUUID();
  const monthlyKey = `recipe-search:ai:monthly:${windows.month}`;
  const dailyKey = `recipe-search:ai:visitor:${windows.day}:${visitorHash}`;
  const reservationKey = `recipe-search:ai:reservation:${reservationId}`;
  const result = await runRedisScript(
    RESERVE_SCRIPT,
    [monthlyKey, dailyKey, reservationKey],
    [
      limits.dailyRequestLimit,
      limits.monthlyTokenBudget,
      estimatedTokens,
      windows.monthTtl,
      windows.dayTtl,
    ]
  );

  if (!Array.isArray(result) || result.length < 2) {
    throw new Error("The AI usage quota store returned an invalid reservation.");
  }
  if (Number(result[0]) !== 1) {
    return { allowed: false, reason: String(result[1]) };
  }
  return { allowed: true, monthlyKey, reservationKey };
}

export async function settleAiUsage(reservation, actualTokens) {
  if (!Number.isSafeInteger(actualTokens) || actualTokens <= 0) {
    throw new Error("Invalid AI usage total.");
  }
  const result = await runRedisScript(
    SETTLE_SCRIPT,
    [reservation.monthlyKey, reservation.reservationKey],
    [actualTokens]
  );
  if (Number(result) !== 1) {
    throw new Error("The AI token reservation could not be settled.");
  }
}

export async function releaseAiUsage(reservation) {
  const result = await runRedisScript(
    RELEASE_SCRIPT,
    [reservation.monthlyKey, reservation.reservationKey],
    []
  );
  if (Number(result) !== 1) {
    throw new Error("The AI token reservation could not be released.");
  }
}
