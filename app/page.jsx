"use client";

import { useEffect, useState } from "react";
import RecipeGrid from "@/components/RecipeGrid";

// Public flag: only shows the AI box after you've added a key and flipped this on.
const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === "true";

export default function Home() {
  const [query, setQuery] = useState("");
  const [recipes, setRecipes] = useState([]);
  const categories = [
    { label: "Chicken", value: "Chicken" },
    { label: "Vegetarian", value: "Vegetarian" },
    { label: "Pasta", value: "Pasta" },
    { label: "Seafood", value: "Seafood" },
    { label: "Dessert", value: "Dessert" },
    { label: "Miscellaneous", value: "Miscellaneous" },
  ];
  const [activeCat, setActiveCat] = useState(null);
  const [status, setStatus] = useState("Search by name, or pick a category.");
  const [loading, setLoading] = useState(false);

  // AI smart-search state
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  async function runSearch(e) {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setActiveCat(null);
    setStatus(`Searching for "${query}"…`);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setRecipes(data.recipes || []);
      setStatus(
        data.recipes?.length
          ? `${data.recipes.length} result${data.recipes.length === 1 ? "" : "s"} for "${query}"`
          : `No recipes found for "${query}".`
      );
    } catch {
      setStatus("Search failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function pickCategory(cat) {
    setLoading(true);
    setActiveCat(cat);
    setStatus(`Loading ${cat}…`);
    try {
      const res = await fetch(`/api/categories?c=${encodeURIComponent(cat)}`);
      const data = await res.json();
      setRecipes(data.recipes || []);
      setStatus(`${data.recipes?.length || 0} recipes in ${cat}`);
    } catch {
      setStatus("Could not load that category.");
    } finally {
      setLoading(false);
    }
  }

  async function runSmartSearch() {
    if (!aiText.trim()) return;
    setAiLoading(true);
    setStatus("Asking the AI to interpret your request…");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "smart-search", text: aiText }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(data.error || "AI request failed.");
        return;
      }
      setRecipes(data.recipes || []);
      setActiveCat(null);
      const note = data.intent?.notes ? ` (${data.intent.notes})` : "";
      setStatus(
        `${data.recipes?.length || 0} results for "${data.intent?.keywords || aiText}"${note}`
      );
    } catch {
      setStatus("AI request failed.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="shell">
      <header className="masthead">
        <p className="eyebrow">PantryUp recipe finder</p>
        <h1 className="title">Discover your next meal.</h1>
        <h2>Find recipes with the ingredients you have.</h2>
        <p className="lede">
          Search thousands of recipes by name or browse by category, including Indian dishes.
        </p>

        <form className="searchbar" onSubmit={runSearch}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try “chicken” or “paneer”…"
            aria-label="Search recipes by name"
          />
          <button className="btn" type="submit" disabled={loading}>
            {loading ? "…" : "Search"}
          </button>
        </form>

        <div className="chips">
          {categories.map((c) => (
            <button
              key={c.value}
              className="chip"
              data-active={activeCat === c.value}
              onClick={() => pickCategory(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>

        {AI_ENABLED && (
          <div className="ai-assist">
            <p className="eyebrow">AI-powered recipe search</p>
            <textarea
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder='Enter the ingredients you have, such as "lettuce and sour cream."'
            />
            <button
              className="btn"
              style={{ marginTop: 10, padding: "10px 22px" }}
              onClick={runSmartSearch}
              disabled={aiLoading}
            >
              {aiLoading ? "Thinking…" : "Ask AI"}
            </button>
          </div>
        )}
      </header>

      <p className="status">{status}</p>

      {recipes.length > 0 ? (
        <RecipeGrid recipes={recipes} />
      ) : (
        !loading && (
          <div className="empty">No recipes to display yet. Search for a recipe or select a category to get started.</div>
        )
      )}
    </div>
  );
}
