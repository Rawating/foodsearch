import { NextResponse } from "next/server";
import { isAiConfigured, parseQuery, askAboutRecipe } from "@/lib/ai/gemini";
import { searchByIngredients } from "@/lib/providers";

// POST /api/ai
//   { mode: "smart-search", text: "..." }
//   { mode: "ask", recipe: {...}, question: "..." }
//
// If no GEMINI_API_KEY is set, this returns 503 with a clear message rather
// than crashing — the frontend hides AI controls in that case anyway.
export async function POST(request) {
  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "AI is not configured on the server." },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    if (body.mode === "smart-search") {
      if (!body.text?.trim()) {
        return NextResponse.json({ error: "Missing text." }, { status: 400 });
      }
      const intent = await parseQuery(body.text);
      const list = Array.isArray(intent.ingredients) ? intent.ingredients : [];
      const recipes = list.length ? await searchByIngredients(list) : [];
      return NextResponse.json({ intent, recipes });
    }

    if (body.mode === "ask") {
      if (!body.recipe || !body.question?.trim()) {
        return NextResponse.json(
          { error: "Missing recipe or question." },
          { status: 400 }
        );
      }
      const answer = await askAboutRecipe(body.recipe, body.question);
      return NextResponse.json({ answer });
    }

    return NextResponse.json({ error: "Unknown mode." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "AI request failed." },
      { status: 500 }
    );
  }
}
