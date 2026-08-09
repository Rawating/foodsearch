// The registry. Everything in the app talks to recipes through here, never to
// a specific provider directly. Add a source in ONE place: the array below.

import { themealdb } from "./themealdb";
import { indian } from "./indian";

const providers = [themealdb, indian];// Later: import { spoonacular } from "./spoonacular";
//        const providers = [themealdb, spoonacular];

const byId = Object.fromEntries(providers.map((p) => [p.id, p]));

/**
 * Search every provider in parallel and merge the results.
 * One provider failing (down, rate-limited) never breaks the whole search.
 * @param {string} query
 * @returns {Promise<{recipes: import("../types").Recipe[], errors: string[]}>}
 */
export async function searchAll(query) {
  const settled = await Promise.allSettled(
    providers.map((p) => p.searchByName(query))
  );

  const recipes = [];
  const errors = [];
  settled.forEach((result, i) => {
    if (result.status === "fulfilled") {
      recipes.push(...result.value);
    } else {
      errors.push(`${providers[i].label}: ${result.reason?.message || "failed"}`);
    }
  });

  return { recipes, errors };
}

/**
 * Look up one recipe by its global id ("<providerId>:<nativeId>").
 * @param {string} globalId
 */
export async function getRecipe(globalId) {
  const sep = globalId.indexOf(":");
  if (sep === -1) return null;
  const providerId = globalId.slice(0, sep);
  const nativeId = globalId.slice(sep + 1);
  const provider = byId[providerId];
  if (!provider) return null;
  return provider.getByNativeId(nativeId);
}

/** Union of categories offered by every provider that supports them. */
export async function listAllCategories() {
  const settled = await Promise.allSettled(
    providers
      .filter((p) => typeof p.listCategories === "function")
      .map((p) => p.listCategories())
  );
  const set = new Set();
  settled.forEach((r) => {
    if (r.status === "fulfilled") r.value.forEach((c) => set.add(c));
  });
  return [...set].sort();
}

/** Browse one category across providers that support filtering. */
export async function searchByCategory(category) {
  const settled = await Promise.allSettled(
    providers
      .filter((p) => typeof p.searchByCategory === "function")
      .map((p) => p.searchByCategory(category))
  );
  const recipes = [];
  settled.forEach((r) => {
    if (r.status === "fulfilled") recipes.push(...r.value);
  });
  return recipes;
}
/**
 * Find recipes that use ANY of the given ingredients (union, deduped).
 */
export async function searchByIngredients(ingredients) {
  const provs = providers.filter((p) => typeof p.searchByIngredient === "function");
  const tasks = [];
  for (const ing of ingredients) {
    for (const p of provs) tasks.push(p.searchByIngredient(ing));
  }

  const settled = await Promise.allSettled(tasks);
  const seen = new Set();
  const out = [];
  for (const r of settled) {
    if (r.status === "fulfilled") {
      for (const rec of r.value) {
        if (!seen.has(rec.id)) {
          seen.add(rec.id);
          out.push(rec);
        }
      }
    }
  }
  return out.slice(0, 60);
}