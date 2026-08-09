"use client";

import { createContext, useContext, useEffect, useState } from "react";

const FavoritesContext = createContext(null);
const STORAGE_KEY = "bubba:favorites";

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setFavorites(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {}
  }, [favorites, loaded]);

  function toggle(recipe) {
    setFavorites((prev) => {
      if (prev.some((r) => r.id === recipe.id)) {
        return prev.filter((r) => r.id !== recipe.id);
      }
      const stub = {
        id: recipe.id,
        providerId: recipe.providerId,
        title: recipe.title,
        image: recipe.image ?? null,
        category: recipe.category ?? null,
        area: recipe.area ?? null,
      };
      return [stub, ...prev];
    });
  }

  const isSaved = (id) => favorites.some((r) => r.id === id);

  return (
    <FavoritesContext.Provider value={{ favorites, toggle, isSaved, loaded }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used inside FavoritesProvider");
  return ctx;
}