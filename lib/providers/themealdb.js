// TheMealDB provider.
// Docs: https://www.themealdb.com/api.php
//
// To add another source (Spoonacular, Edamam, Grok-generated, ...), copy the
// shape of this file: export the same set of functions, each returning the
// normalized Recipe shape from ../types.js. Register it in ./index.js.

const PROVIDER_ID = "themealdb";
const KEY = process.env.THEMEALDB_KEY || "1";
const BASE = `https://www.themealdb.com/api/json/v1/${KEY}`;

/** Turn one raw TheMealDB meal object into our normalized Recipe. */
function normalizeMeal(meal) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = (meal[`strIngredient${i}`] || "").trim();
    const measure = (meal[`strMeasure${i}`] || "").trim();
    if (name) ingredients.push({ name, measure });
  }

  return {
    id: `${PROVIDER_ID}:${meal.idMeal}`,
    providerId: PROVIDER_ID,
    title: meal.strMeal,
    image: meal.strMealThumb || null,
    category: meal.strCategory || null,
    area: meal.strArea || null,
    tags: meal.strTags ? meal.strTags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    instructions: meal.strInstructions || null,
    ingredients,
    sourceUrl: meal.strSource || null,
    youtubeUrl: meal.strYoutube || null,
    partial: false,
  };
}

/** Lightweight card from the filter endpoint (no ingredients/instructions). */
function normalizeStub(meal) {
  return {
    id: `${PROVIDER_ID}:${meal.idMeal}`,
    providerId: PROVIDER_ID,
    title: meal.strMeal,
    image: meal.strMealThumb || null,
    category: null,
    area: null,
    tags: [],
    instructions: null,
    ingredients: [],
    sourceUrl: null,
    youtubeUrl: null,
    partial: true,
  };
}

async function getJson(url) {
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TheMealDB responded ${res.status}`);
  return res.json();
}

export const themealdb = {
  id: PROVIDER_ID,
  label: "TheMealDB",

  async searchByName(query) {
    const data = await getJson(`${BASE}/search.php?s=${encodeURIComponent(query)}`);
    return (data.meals || []).map(normalizeMeal);
  },

  async getByNativeId(nativeId) {
    const data = await getJson(`${BASE}/lookup.php?i=${encodeURIComponent(nativeId)}`);
    const meal = data.meals && data.meals[0];
    return meal ? normalizeMeal(meal) : null;
  },

  async listCategories() {
    const data = await getJson(`${BASE}/list.php?c=list`);
    return (data.meals || []).map((m) => m.strCategory).filter(Boolean);
  },

  async searchByCategory(category) {
    const data = await getJson(`${BASE}/filter.php?c=${encodeURIComponent(category)}`);
    return (data.meals || []).map(normalizeStub);
  },

  async searchByIngredient(ingredient) {
    const term = ingredient.trim().replace(/ /g, "_");
    const data = await getJson(`${BASE}/filter.php?i=${encodeURIComponent(term)}`);
    return (data.meals || []).map(normalizeStub);
  },
};