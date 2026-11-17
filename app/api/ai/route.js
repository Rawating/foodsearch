import { NextResponse } from "next/server";
import {
  AiConfigurationError,
  AiProviderError,
  AiQuotaUnavailableError,
  AiUsageLimitError,
  isAiConfigured,
  parseQuery,
  askAboutRecipe,
} from "@/lib/ai/xai";
import { searchByIngredients } from "@/lib/providers";

// POST /api/ai
//   { mode: "smart-search", text: "..." }
//   { mode: "ask", recipe: {...}, question: "..." }
const MAX_BODY_BYTES = 12_000;
const MAX_SMART_SEARCH_LENGTH = 500;
const MAX_QUESTION_LENGTH = 500;
const MAX_RECIPE_TITLE_LENGTH = 160;
const MAX_RECIPE_INSTRUCTIONS_LENGTH = 3_000;
const MAX_RECIPE_INGREDIENTS = 20;

function getVisitorIp(request) {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    (process.env.NODE_ENV !== "production" ? "local-development" : null)
  );
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateRecipe(value) {
  if (
    !isRecord(value) ||
    typeof value.title !== "string" ||
    value.title.length > MAX_RECIPE_TITLE_LENGTH ||
    !Array.isArray(value.ingredients) ||
    value.ingredients.length > MAX_RECIPE_INGREDIENTS ||
    (value.instructions !== null &&
      value.instructions !== undefined &&
      (typeof value.instructions !== "string" ||
        value.instructions.length > MAX_RECIPE_INSTRUCTIONS_LENGTH))
  ) {
    return null;
  }

  const ingredients = [];
  for (const ingredient of value.ingredients) {
    if (
      !isRecord(ingredient) ||
      typeof ingredient.name !== "string" ||
      ingredient.name.length > 80 ||
      typeof ingredient.measure !== "string" ||
      ingredient.measure.length > 80
    ) {
      return null;
    }
    ingredients.push({ name: ingredient.name, measure: ingredient.measure });
  }

  return {
    title: value.title,
    instructions: value.instructions || "",
    ingredients,
  };
}

export async function POST(request) {
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "Grok is not configured on the server." },
      { status: 503 }
    );
  }

  let body;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request body is too large." }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const visitorIp = getVisitorIp(request);
  if (!visitorIp) {
    return NextResponse.json(
      { error: "Could not determine the visitor for AI usage limits." },
      { status: 503 }
    );
  }

  try {
    if (body.mode === "smart-search") {
      if (typeof body.text !== "string" || !body.text.trim()) {
        return NextResponse.json({ error: "Missing text." }, { status: 400 });
      }
      if (body.text.length > MAX_SMART_SEARCH_LENGTH) {
        return NextResponse.json({ error: "Search text is too long." }, { status: 400 });
      }
      const intent = await parseQuery(body.text.trim(), visitorIp);
      const list = Array.isArray(intent.ingredients) ? intent.ingredients : [];
      const recipes = list.length ? await searchByIngredients(list) : [];
      return NextResponse.json({ intent, recipes });
    }

    if (body.mode === "ask") {
      if (typeof body.question !== "string" || !body.question.trim()) {
        return NextResponse.json(
          { error: "Missing question." },
          { status: 400 }
        );
      }
      if (body.question.length > MAX_QUESTION_LENGTH) {
        return NextResponse.json({ error: "Question is too long." }, { status: 400 });
      }
      const recipe = validateRecipe(body.recipe);
      if (!recipe) {
        return NextResponse.json({ error: "Invalid recipe." }, { status: 400 });
      }
      const answer = await askAboutRecipe(recipe, body.question.trim(), visitorIp);
      return NextResponse.json({ answer });
    }

    return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
  } catch (err) {
    if (err instanceof AiConfigurationError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof AiUsageLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    if (err instanceof AiProviderError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    if (err instanceof AiQuotaUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: "AI request failed." },
      { status: 500 }
    );
  }
}
