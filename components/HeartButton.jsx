"use client";

import { useFavorites } from "./FavoritesProvider";

export default function HeartButton({ recipe, className = "" }) {
  const { isSaved, toggle } = useFavorites();
  const saved = isSaved(recipe.id);

  return (
    <button
      type="button"
      className={`heart ${saved ? "is-saved" : ""} ${className}`}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save recipe"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(recipe);
      }}
    >
      {saved ? "♥" : "♡"}
    </button>
  );
}