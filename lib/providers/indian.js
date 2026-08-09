// Indian Food Dataset provider — reads recipes from a local CSV file.
// No API key, no network: parsed once, then cached in memory.
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

const PROVIDER_ID = "indian";
const CSV_PATH = path.join(process.cwd(), "data", "IndianFoodDatasetCSV.csv");
const MAX_RESULTS = 50; // cap so a broad word like "chicken" doesn't flood the grid

let cache = null;

function load() {
  if (cache) return cache;
  const raw = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    relax_quotes: true,
    relax_column_count: true,
  });
  cache = rows.map(normalizeRow).filter((r) => r.title);
  return cache;
}

function normalizeRow(row) {
  const title = (row.TranslatedRecipeName || row.RecipeName || "").trim();

  const ingredientsRaw = row.TranslatedIngredients || row.Ingredients || "";
  const ingredients = ingredientsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => ({ name, measure: "" }));

  const tags = [row.Diet, `Serves ${row.Servings}`, `${row.TotalTimeInMins} min`]
    .map((t) => (t || "").trim())
    .filter((t) => t && t !== "Serves" && t !== "min");

  return {
    id: `${PROVIDER_ID}:${row.Srno}`,
    providerId: PROVIDER_ID,
    title,
    image: null,
    category: (row.Course || "").trim() || null,
    area: (row.Cuisine || "").trim() || null,
    tags,
    instructions: (row.TranslatedInstructions || row.Instructions || "").trim() || null,
    ingredients,
    sourceUrl: (row.URL || "").trim() || null,
    youtubeUrl: null,
    partial: false,
  };
}

export const indian = {
  id: PROVIDER_ID,
  label: "Indian Food Dataset",

  async searchByName(query) {
    const q = query.toLowerCase();
    const all = load();
    const hits = [];
    for (const r of all) {
      if (r.title.toLowerCase().includes(q)) {
        hits.push(r);
        if (hits.length >= MAX_RESULTS) break;
      }
    }
    return hits;
  },

  async getByNativeId(nativeId) {
    const all = load();
    return all.find((r) => r.id === `${PROVIDER_ID}:${nativeId}`) || null;
  },

  async searchByIngredient(ingredient) {
    const q = ingredient.trim().toLowerCase();
    if (!q) return [];
    const all = load();
    const hits = [];
    for (const r of all) {
      if (r.ingredients.some((i) => i.name.toLowerCase().includes(q))) {
        hits.push(r);
        if (hits.length >= 30) break;
      }
    }
    return hits;
  },
};