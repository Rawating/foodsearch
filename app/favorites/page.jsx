"use client";

import Link from "next/link";
import { useFavorites } from "@/components/FavoritesProvider";
import RecipeGrid from "@/components/RecipeGrid";

export default function FavoritesPage() {
  const { favorites, loaded } = useFavorites();

  return (
    <div className="shell">
      <header className="masthead">
        <p className="eyebrow">Saved recipes</p>
        <h1 className="title">Your saved recipes</h1>
        <p className="lede">
          Recipes you have saved are listed here.
        </p>
        <Link href="/" className="back" style={{ margin: "18px 0 0" }}>
          ← Back to search
        </Link>
      </header>

      {!loaded ? null : favorites.length > 0 ? (
        <>
          <p className="status">
            {favorites.length} saved recipe{favorites.length === 1 ? "" : "s"}
          </p>
          <RecipeGrid recipes={favorites} />
        </>
      ) : (
        <div className="empty" style={{ marginTop: 26 }}>
          You have not saved any recipes yet. Select the heart icon on a recipe to save it here.
        </div>
      )}
    </div>
  );
}