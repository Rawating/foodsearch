// The single shape every provider must return. Keeping all sources normalized
// to this means the UI never has to know which API a recipe came from.

/**
 * @typedef {Object} Ingredient
 * @property {string} name    - e.g. "Flour"
 * @property {string} measure - e.g. "2 cups"
 */

/**
 * @typedef {Object} Recipe
 * @property {string}  id           - Globally unique: "<providerId>:<nativeId>", e.g. "themealdb:52772"
 * @property {string}  providerId   - Which source it came from, e.g. "themealdb"
 * @property {string}  title
 * @property {string|null} image
 * @property {string|null} category - e.g. "Seafood"
 * @property {string|null} area     - Cuisine, e.g. "Japanese"
 * @property {string[]} tags
 * @property {string|null} instructions
 * @property {Ingredient[]} ingredients
 * @property {string|null} sourceUrl
 * @property {string|null} youtubeUrl
 * @property {boolean} partial      - true when it's a lightweight card (no instructions yet)
 */

// This file has no runtime exports on purpose — it's here for editor
// autocomplete and to document the contract new providers must satisfy.
export {};
