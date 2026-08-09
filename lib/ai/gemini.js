// Optional AI layer, powered by Groq (OpenAI-compatible chat completions API).
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export function isAiConfigured() {
  return Boolean(process.env.GROQ_API_KEY);
}

async function chat(messages, { json = false } = {}) {
  if (!isAiConfigured()) throw new Error("AI is not configured");

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages,
      temperature: 0.4,
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Groq responded ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content || "").trim();
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("No JSON in AI response");
    return JSON.parse(text.slice(start, end + 1));
  }
}

export async function parseQuery(text) {
  const content = await chat(
    [
      {
        role: "system",
        content:
          'Pull the food ingredients out of what the user wants to cook. Reply with ONLY a JSON object like {"ingredients": ["chicken", "rice"], "notes": "extra vibe like spicy or quick, or null"}. Use simple, lowercase, single ingredient names.',
      },
      { role: "user", content: text },
    ],
    { json: true }
  );
  return safeParseJson(content);
}

export async function askAboutRecipe(recipe, question) {
  const ingredientList = recipe.ingredients
    .map((i) => `- ${i.measure} ${i.name}`.trim())
    .join("\n");

  return chat([
    {
      role: "system",
      content:
        "You're a chill, helpful cooking buddy. Keep answers short and casual, and actually useful. If the recipe doesn't say, just be honest about it.",
    },
    {
      role: "user",
      content: `Recipe: ${recipe.title}\nIngredients:\n${ingredientList}\nInstructions:\n${recipe.instructions || "(none provided)"}\n\nQuestion: ${question}`,
    },
  ]);
}