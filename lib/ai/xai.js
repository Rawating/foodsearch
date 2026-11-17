import {
  estimateMaxRequestTokens,
  getAiLimits,
  releaseAiUsage,
  reserveAiUsage,
  settleAiUsage,
} from "./quota.js";

const XAI_URL = "https://api.x.ai/v1/responses";
const DEFAULT_MODEL = "grok-4.20-0309-non-reasoning";

export class AiUsageLimitError extends Error {
  constructor(reason) {
    super(
      reason === "visitor_limit"
        ? "You've reached the daily AI request limit. Try again tomorrow."
        : "The shared monthly AI token limit has been reached."
    );
    this.name = "AiUsageLimitError";
    this.reason = reason;
  }
}

export class AiProviderError extends Error {
  constructor(message) {
    super(message);
    this.name = "AiProviderError";
  }
}

export class AiConfigurationError extends Error {
  constructor() {
    super("XAI_MODEL must be a non-reasoning Grok model to enforce token limits.");
    this.name = "AiConfigurationError";
  }
}

export class AiQuotaUnavailableError extends Error {
  constructor() {
    super("AI usage limits are unavailable; try again later.");
    this.name = "AiQuotaUnavailableError";
  }
}

export function isAiConfigured() {
  return Boolean(process.env.XAI_API_KEY);
}

function getModel() {
  const model = process.env.XAI_MODEL || DEFAULT_MODEL;
  if (!model.includes("non-reasoning")) throw new AiConfigurationError();
  return model;
}

function readResponseText(data) {
  const content = (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => typeof item.text === "string")
    .map((item) => item.text);

  return (data.output_text || content.join("")).trim();
}

async function generate(messages, { json = false, visitorIp }) {
  if (!isAiConfigured()) throw new AiProviderError("AI is not configured.");

  const model = getModel();
  let limits;
  let reservation;
  try {
    limits = getAiLimits();
    const estimatedTokens = estimateMaxRequestTokens(messages, limits.maxOutputTokens);
    reservation = await reserveAiUsage(visitorIp, estimatedTokens);
  } catch {
    throw new AiQuotaUnavailableError();
  }
  if (!reservation.allowed) throw new AiUsageLimitError(reservation.reason);

  let response;
  try {
    response = await fetch(XAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: messages,
        max_output_tokens: limits.maxOutputTokens,
        store: false,
        temperature: 0.4,
        ...(json ? { text: { format: { type: "json_object" } } } : {}),
      }),
    });
  } catch {
    throw new AiProviderError("Could not reach the Grok API.");
  }

  if (!response.ok) {
    if (response.status < 500) {
      try {
        await releaseAiUsage(reservation);
      } catch {
        throw new AiQuotaUnavailableError();
      }
    }
    throw new AiProviderError(`Grok responded with status ${response.status}.`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new AiProviderError("Grok returned an invalid response.");
  }

  const content = readResponseText(data);
  const actualTokens = Number(data.usage?.total_tokens);
  if (!content || !Number.isSafeInteger(actualTokens) || actualTokens <= 0) {
    throw new AiProviderError("Grok returned a response without usable text or token usage.");
  }

  try {
    await settleAiUsage(reservation, actualTokens);
  } catch {
    throw new AiQuotaUnavailableError();
  }
  return content;
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      throw new AiProviderError("Grok did not return valid JSON.");
    }
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      throw new AiProviderError("Grok did not return valid JSON.");
    }
  }
}

export async function parseQuery(text, visitorIp) {
  const content = await generate(
    [
      {
        role: "system",
        content:
          'Pull the food ingredients out of what the user wants to cook. Reply with ONLY a JSON object like {"ingredients": ["chicken", "rice"], "notes": "extra vibe like spicy or quick, or null"}. Use simple, lowercase, single ingredient names.',
      },
      { role: "user", content: text },
    ],
    { json: true, visitorIp }
  );
  const intent = safeParseJson(content);
  if (
    !intent ||
    typeof intent !== "object" ||
    Array.isArray(intent) ||
    !Array.isArray(intent.ingredients) ||
    !intent.ingredients.every((ingredient) => typeof ingredient === "string")
  ) {
    throw new AiProviderError("Grok returned an invalid ingredient response.");
  }
  return intent;
}

export async function askAboutRecipe(recipe, question, visitorIp) {
  const ingredientList = recipe.ingredients
    .map((ingredient) => `- ${ingredient.measure} ${ingredient.name}`.trim())
    .join("\n");

  return generate(
    [
      {
        role: "system",
        content:
          "You're a chill, helpful cooking buddy. Keep answers short and casual, and actually useful. If the recipe doesn't say, just be honest about it.",
      },
      {
        role: "user",
        content: `Recipe: ${recipe.title}\nIngredients:\n${ingredientList}\nInstructions:\n${recipe.instructions || "(none provided)"}\n\nQuestion: ${question}`,
      },
    ],
    { visitorIp }
  );
}
